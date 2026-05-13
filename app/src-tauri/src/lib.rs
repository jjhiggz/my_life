use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use std::thread;

use portable_pty::{CommandBuilder, MasterPty, PtySize, native_pty_system};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

struct PtyState {
    master: Mutex<Option<Box<dyn MasterPty + Send>>>,
    writer: Mutex<Option<Box<dyn Write + Send>>>,
}

#[tauri::command]
fn pty_open(
    app: AppHandle,
    state: State<'_, PtyState>,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    // Spawn the user's shell so they can type `claude` themselves for now.
    // Later: detect `claude` binary and spawn directly.
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let mut cmd = CommandBuilder::new(shell);
    cmd.env("TERM", "xterm-256color");
    if let Ok(home) = std::env::var("HOME") {
        cmd.cwd(home);
    }

    let _child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    *state.master.lock().unwrap() = Some(pair.master);
    *state.writer.lock().unwrap() = Some(writer);

    // Stream PTY output → frontend
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).into_owned();
                    let _ = app.emit("pty-output", chunk);
                }
                Err(_) => break,
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn pty_write(state: State<'_, PtyState>, data: String) -> Result<(), String> {
    let mut guard = state.writer.lock().unwrap();
    if let Some(writer) = guard.as_mut() {
        writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn pty_resize(state: State<'_, PtyState>, rows: u16, cols: u16) -> Result<(), String> {
    let guard = state.master.lock().unwrap();
    if let Some(master) = guard.as_ref() {
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ============================================================
// Food log (reads from ~/.higgzlife/data.db — same DB as MCP server)
// ============================================================

fn db_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".higgzlife").join("data.db")
}

/// Open the shared SQLite DB and apply any pending schema migrations.
/// The migration runs are idempotent and gated on `PRAGMA user_version`,
/// so the cost on already-current DBs is a single PRAGMA query.
fn open_db() -> Result<rusqlite::Connection, String> {
    higgzlife_db::open_and_migrate(db_path()).map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct LoggedMeal {
    activity_id: String,
    meal_type: String,
    created_at: String,
    total_calories: Option<i32>,
    total_protein_g: Option<f64>,
    items: Vec<LoggedMealItem>,
}

#[derive(Serialize)]
struct LoggedMealItem {
    id: String,
    food_name: String,
    serving_size: Option<String>,
    calories: Option<i32>,
    protein_g: Option<f64>,
    carbs_g: Option<f64>,
    fat_g: Option<f64>,
    quantity: Option<f64>,
    food_id: Option<String>,
    serving_id: Option<String>,
}

#[derive(Serialize)]
struct DailyTotals {
    calories: i32,
    protein_g: f64,
    carbs_g: f64,
    fat_g: f64,
    calorie_target: i32,
    protein_target_g: f64,
}

#[derive(Serialize)]
struct TodayFood {
    date: String,
    totals: DailyTotals,
    meals: Vec<LoggedMeal>,
}

#[derive(Serialize)]
struct FoodRow {
    id: String,
    display_name: String,
    use_count: i32,
    default_serving: Option<ServingRow>,
}

#[derive(Serialize)]
struct ServingRow {
    id: String,
    label: String,
    calories: Option<f64>,
    protein_g: Option<f64>,
}

#[tauri::command]
fn list_food_for_date(date: Option<String>) -> Result<TodayFood, String> {
    let conn = open_db()?;
    let today = date.unwrap_or_else(|| {
        chrono::Local::now().format("%Y-%m-%d").to_string()
    });

    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.created_at, m.meal_type, m.total_calories, m.total_protein_g,
                    m.total_carbs_g, m.total_fat_g
             FROM activities a
             JOIN meals m ON a.id = m.activity_id
             WHERE date(a.created_at) = ?1
             ORDER BY a.created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let meal_rows: Vec<(String, String, String, Option<i32>, Option<f64>, Option<f64>, Option<f64>)> = stmt
        .query_map([&today], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut meals: Vec<LoggedMeal> = Vec::with_capacity(meal_rows.len());
    let mut total_carbs: f64 = 0.0;
    let mut total_fat: f64 = 0.0;
    for (id, created, meal_type, cal, p, c, f) in meal_rows {
        total_carbs += c.unwrap_or(0.0);
        total_fat += f.unwrap_or(0.0);
        let mut items_stmt = conn
            .prepare(
                "SELECT id, food_name, serving_size, calories, protein_g, carbs_g, fat_g,
                        quantity, food_id, serving_id
                 FROM meal_items WHERE meal_id = ?1 ORDER BY rowid",
            )
            .map_err(|e| e.to_string())?;
        let items: Vec<LoggedMealItem> = items_stmt
            .query_map([&id], |row| {
                Ok(LoggedMealItem {
                    id: row.get(0)?,
                    food_name: row.get(1)?,
                    serving_size: row.get(2)?,
                    calories: row.get(3)?,
                    protein_g: row.get(4)?,
                    carbs_g: row.get(5)?,
                    fat_g: row.get(6)?,
                    quantity: row.get(7)?,
                    food_id: row.get(8)?,
                    serving_id: row.get(9)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        meals.push(LoggedMeal {
            activity_id: id,
            meal_type,
            created_at: created,
            total_calories: cal,
            total_protein_g: p,
            items,
        });
    }

    let total_cal: i32 = meals.iter().filter_map(|m| m.total_calories).sum();
    let total_p: f64 = meals.iter().filter_map(|m| m.total_protein_g).sum();

    Ok(TodayFood {
        date: today,
        totals: DailyTotals {
            calories: total_cal,
            protein_g: total_p,
            carbs_g: total_carbs,
            fat_g: total_fat,
            calorie_target: 2200,
            protein_target_g: 150.0,
        },
        meals,
    })
}

fn current_meal_type() -> &'static str {
    let h = chrono::Local::now().format("%H").to_string();
    let hour: u32 = h.parse().unwrap_or(0);
    match hour {
        5..=10 => "breakfast",
        11..=14 => "lunch",
        17..=20 => "dinner",
        _ => "snack",
    }
}

/// Quick-log a single food item. Adds it to today's meal of the appropriate
/// meal_type (creating one if none exists). Quantity defaults to 1.
#[tauri::command]
fn log_quick_add(
    food_id: String,
    serving_id: Option<String>,
    quantity: Option<f64>,
    meal_type: Option<String>,
) -> Result<(), String> {
    let mut conn = open_db()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Fetch the serving (or pick the food's default / first)
    let serving_id = match serving_id {
        Some(s) => s,
        None => tx
            .query_row(
                "SELECT COALESCE(f.default_serving_id,
                                 (SELECT s.id FROM servings s WHERE s.food_id = f.id
                                  ORDER BY s.is_default DESC, s.rowid LIMIT 1))
                 FROM foods f WHERE f.id = ?1",
                [&food_id],
                |r| r.get::<_, Option<String>>(0),
            )
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Food has no serving".to_string())?,
    };

    let (label, s_cal, s_protein, s_carbs, s_fat) = tx
        .query_row(
            "SELECT label, calories, protein_g, carbs_g, fat_g FROM servings WHERE id = ?1",
            [&serving_id],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, Option<f64>>(1)?,
                    r.get::<_, Option<f64>>(2)?,
                    r.get::<_, Option<f64>>(3)?,
                    r.get::<_, Option<f64>>(4)?,
                ))
            },
        )
        .map_err(|e| e.to_string())?;

    let qty = quantity.unwrap_or(1.0);
    let cal = s_cal.map(|c| (c * qty).round() as i32);
    let protein = s_protein.map(|p| p * qty);
    let carbs = s_carbs.map(|c| c * qty);
    let fat = s_fat.map(|f| f * qty);

    let food_display: String = tx
        .query_row("SELECT display_name FROM foods WHERE id = ?1", [&food_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let mt = meal_type.unwrap_or_else(|| current_meal_type().to_string());
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // Find existing meal of this type today, or create a new one
    let existing: Option<String> = tx
        .query_row(
            "SELECT a.id FROM activities a
             JOIN meals m ON a.id = m.activity_id
             WHERE date(a.created_at) = ?1 AND m.meal_type = ?2
             ORDER BY a.created_at DESC LIMIT 1",
            [&today, &mt],
            |r| r.get(0),
        )
        .ok();

    let now = chrono::Utc::now().to_rfc3339();
    let meal_activity_id = if let Some(id) = existing {
        id
    } else {
        let new_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO activities (id, activity_type, created_at, updated_at, status, title)
             VALUES (?1, 'meal', ?2, ?2, 'done', ?3)",
            rusqlite::params![&new_id, &now, &mt],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO meals (activity_id, meal_type, total_calories, total_protein_g,
                                total_carbs_g, total_fat_g)
             VALUES (?1, ?2, 0, 0, 0, 0)",
            rusqlite::params![&new_id, &mt],
        )
        .map_err(|e| e.to_string())?;
        new_id
    };

    // Insert the meal item
    let item_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO meal_items (id, meal_id, food_name, serving_size, calories, protein_g,
                                 carbs_g, fat_g, food_id, serving_id, quantity)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            &item_id,
            &meal_activity_id,
            &food_display,
            &label,
            cal,
            protein,
            carbs,
            fat,
            &food_id,
            &serving_id,
            qty,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Bump food usage
    tx.execute(
        "UPDATE foods SET use_count = use_count + 1, last_used_at = ?1 WHERE id = ?2",
        rusqlite::params![&now, &food_id],
    )
    .map_err(|e| e.to_string())?;

    // Recompute totals for the meal
    recompute_meal_totals(&tx, &meal_activity_id).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

fn recompute_meal_totals(
    conn: &rusqlite::Connection,
    meal_id: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE meals SET
            total_calories = COALESCE((SELECT SUM(calories) FROM meal_items WHERE meal_id = ?1), 0),
            total_protein_g = COALESCE((SELECT SUM(protein_g) FROM meal_items WHERE meal_id = ?1), 0),
            total_carbs_g = COALESCE((SELECT SUM(carbs_g) FROM meal_items WHERE meal_id = ?1), 0),
            total_fat_g = COALESCE((SELECT SUM(fat_g) FROM meal_items WHERE meal_id = ?1), 0)
         WHERE activity_id = ?1",
        [meal_id],
    )?;
    Ok(())
}

/// Edit a meal item — change its serving and/or quantity. Recomputes
/// calories/protein/carbs/fat from the new (serving × quantity).
#[tauri::command]
fn update_meal_item(
    item_id: String,
    serving_id: String,
    quantity: f64,
) -> Result<(), String> {
    let mut conn = open_db()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let (label, s_cal, s_protein, s_carbs, s_fat) = tx
        .query_row(
            "SELECT label, calories, protein_g, carbs_g, fat_g FROM servings WHERE id = ?1",
            [&serving_id],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, Option<f64>>(1)?,
                    r.get::<_, Option<f64>>(2)?,
                    r.get::<_, Option<f64>>(3)?,
                    r.get::<_, Option<f64>>(4)?,
                ))
            },
        )
        .map_err(|e| e.to_string())?;

    let cal = s_cal.map(|c| (c * quantity).round() as i32);
    let protein = s_protein.map(|p| p * quantity);
    let carbs = s_carbs.map(|c| c * quantity);
    let fat = s_fat.map(|f| f * quantity);

    let meal_id: String = tx
        .query_row(
            "SELECT meal_id FROM meal_items WHERE id = ?1",
            [&item_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE meal_items
         SET serving_id = ?1, serving_size = ?2, quantity = ?3,
             calories = ?4, protein_g = ?5, carbs_g = ?6, fat_g = ?7
         WHERE id = ?8",
        rusqlite::params![
            &serving_id,
            &label,
            quantity,
            cal,
            protein,
            carbs,
            fat,
            &item_id,
        ],
    )
    .map_err(|e| e.to_string())?;

    recompute_meal_totals(&tx, &meal_id).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_food_month(year: i32, month: u32) -> Result<Vec<DaySummary>, String> {
    let conn = open_db()?;

    let first = chrono::NaiveDate::from_ymd_opt(year, month, 1)
        .ok_or_else(|| format!("invalid year/month {}/{}", year, month))?;
    // Find first day of next month
    let (ny, nm) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    let next_first = chrono::NaiveDate::from_ymd_opt(ny, nm, 1).unwrap();
    let days_in_month = (next_first - first).num_days() as i64;

    let mut out = Vec::with_capacity(days_in_month as usize);
    for offset in 0..days_in_month {
        let date = first + chrono::Duration::days(offset);
        let date_str = date.format("%Y-%m-%d").to_string();
        let row: Option<(Option<i32>, Option<f64>, i32)> = conn
            .query_row(
                "SELECT SUM(m.total_calories), SUM(m.total_protein_g), COUNT(*)
                 FROM activities a
                 JOIN meals m ON a.id = m.activity_id
                 WHERE date(a.created_at) = ?1",
                [&date_str],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .ok();
        let (cal, p, count) = row.unwrap_or((None, None, 0));
        out.push(DaySummary {
            date: date_str,
            calories: cal.unwrap_or(0),
            protein_g: p.unwrap_or(0.0),
            meal_count: count,
        });
    }
    Ok(out)
}

#[tauri::command]
fn delete_meal_item(item_id: String) -> Result<(), String> {
    let mut conn = open_db()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let meal_id: Option<String> = tx
        .query_row(
            "SELECT meal_id FROM meal_items WHERE id = ?1",
            [&item_id],
            |r| r.get(0),
        )
        .ok();

    tx.execute("DELETE FROM meal_items WHERE id = ?1", [&item_id])
        .map_err(|e| e.to_string())?;

    if let Some(mid) = meal_id {
        recompute_meal_totals(&tx, &mid).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_food_servings(food_id: String) -> Result<Vec<ServingRow>, String> {
    let conn = open_db()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, label, calories, protein_g
             FROM servings WHERE food_id = ?1
             ORDER BY is_default DESC, rowid",
        )
        .map_err(|e| e.to_string())?;
    let servings: Vec<ServingRow> = stmt
        .query_map([&food_id], |row| {
            Ok(ServingRow {
                id: row.get(0)?,
                label: row.get(1)?,
                calories: row.get(2)?,
                protein_g: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(servings)
}

// ============================================================
// Saved meals (meal templates)
// ============================================================

#[derive(Serialize)]
struct MealTemplate {
    id: String,
    name: String,
    use_count: i32,
    total_calories: i32,
    total_protein_g: f64,
    items: Vec<MealTemplateItem>,
}

#[derive(Serialize)]
struct MealTemplateItem {
    food_id: String,
    food_name: String,
    serving_id: Option<String>,
    serving_label: Option<String>,
    quantity: f64,
    calories: Option<f64>,
    protein_g: Option<f64>,
}

#[tauri::command]
fn save_meal_as_template(meal_id: String, name: String) -> Result<String, String> {
    let mut conn = open_db()?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let template_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    tx.execute(
        "INSERT INTO meal_templates (id, name, created_at, use_count) VALUES (?1, ?2, ?3, 0)",
        rusqlite::params![&template_id, name.trim(), &now],
    )
    .map_err(|e| e.to_string())?;

    let mut item_stmt = tx
        .prepare(
            "SELECT food_id, serving_id, quantity FROM meal_items
             WHERE meal_id = ?1 AND food_id IS NOT NULL
             ORDER BY rowid",
        )
        .map_err(|e| e.to_string())?;

    let raw: Vec<(String, Option<String>, Option<f64>)> = item_stmt
        .query_map([&meal_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(item_stmt);

    if raw.is_empty() {
        return Err("Meal has no items linked to foods".to_string());
    }

    for (idx, (food_id, serving_id, qty)) in raw.iter().enumerate() {
        tx.execute(
            "INSERT INTO meal_template_items
             (id, template_id, food_id, serving_id, quantity, item_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                &template_id,
                food_id,
                serving_id,
                qty.unwrap_or(1.0),
                idx as i32,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(template_id)
}

#[tauri::command]
fn list_meal_templates() -> Result<Vec<MealTemplate>, String> {
    let conn = open_db()?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, use_count FROM meal_templates
             ORDER BY use_count DESC, last_used_at DESC NULLS LAST, name",
        )
        .map_err(|e| e.to_string())?;
    let raw: Vec<(String, String, i32)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut out: Vec<MealTemplate> = Vec::with_capacity(raw.len());
    for (id, name, use_count) in raw {
        let mut items_stmt = conn
            .prepare(
                "SELECT ti.food_id, f.display_name, ti.serving_id, s.label,
                        ti.quantity, s.calories, s.protein_g
                 FROM meal_template_items ti
                 JOIN foods f ON f.id = ti.food_id
                 LEFT JOIN servings s ON s.id = ti.serving_id
                 WHERE ti.template_id = ?1
                 ORDER BY ti.item_order",
            )
            .map_err(|e| e.to_string())?;
        let items: Vec<MealTemplateItem> = items_stmt
            .query_map([&id], |row| {
                Ok(MealTemplateItem {
                    food_id: row.get(0)?,
                    food_name: row.get(1)?,
                    serving_id: row.get(2)?,
                    serving_label: row.get(3)?,
                    quantity: row.get(4)?,
                    calories: row.get(5)?,
                    protein_g: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let total_cal: i32 = items
            .iter()
            .map(|i| ((i.calories.unwrap_or(0.0)) * i.quantity).round() as i32)
            .sum();
        let total_protein: f64 = items
            .iter()
            .map(|i| (i.protein_g.unwrap_or(0.0)) * i.quantity)
            .sum();

        out.push(MealTemplate {
            id,
            name,
            use_count,
            total_calories: total_cal,
            total_protein_g: total_protein,
            items,
        });
    }

    Ok(out)
}

#[tauri::command]
fn apply_meal_template(template_id: String, meal_type: Option<String>) -> Result<(), String> {
    let mut conn = open_db()?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let items: Vec<(String, Option<String>, f64)> = {
        let mut stmt = tx
            .prepare(
                "SELECT food_id, serving_id, quantity FROM meal_template_items
                 WHERE template_id = ?1 ORDER BY item_order",
            )
            .map_err(|e| e.to_string())?;
        let v: Vec<(String, Option<String>, f64)> = stmt
            .query_map([&template_id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        v
    };

    if items.is_empty() {
        return Err("Template has no items".to_string());
    }

    let mt = meal_type.unwrap_or_else(|| current_meal_type().to_string());
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Find or create today's meal of this type
    let existing: Option<String> = tx
        .query_row(
            "SELECT a.id FROM activities a
             JOIN meals m ON a.id = m.activity_id
             WHERE date(a.created_at) = ?1 AND m.meal_type = ?2
             ORDER BY a.created_at DESC LIMIT 1",
            [&today, &mt],
            |r| r.get(0),
        )
        .ok();

    let meal_activity_id = if let Some(id) = existing {
        id
    } else {
        let new_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO activities (id, activity_type, created_at, updated_at, status, title)
             VALUES (?1, 'meal', ?2, ?2, 'done', ?3)",
            rusqlite::params![&new_id, &now, &mt],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO meals (activity_id, meal_type, total_calories, total_protein_g,
                                total_carbs_g, total_fat_g)
             VALUES (?1, ?2, 0, 0, 0, 0)",
            rusqlite::params![&new_id, &mt],
        )
        .map_err(|e| e.to_string())?;
        new_id
    };

    for (food_id, serving_id, qty) in items {
        let serving_id = match serving_id {
            Some(s) => s,
            None => tx
                .query_row(
                    "SELECT COALESCE(f.default_serving_id,
                             (SELECT s.id FROM servings s WHERE s.food_id = f.id
                              ORDER BY s.is_default DESC, s.rowid LIMIT 1))
                     FROM foods f WHERE f.id = ?1",
                    [&food_id],
                    |r| r.get::<_, Option<String>>(0),
                )
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "Food has no serving".to_string())?,
        };

        let (label, s_cal, s_protein, s_carbs, s_fat) = tx
            .query_row(
                "SELECT label, calories, protein_g, carbs_g, fat_g FROM servings WHERE id = ?1",
                [&serving_id],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, Option<f64>>(1)?,
                        r.get::<_, Option<f64>>(2)?,
                        r.get::<_, Option<f64>>(3)?,
                        r.get::<_, Option<f64>>(4)?,
                    ))
                },
            )
            .map_err(|e| e.to_string())?;

        let cal = s_cal.map(|c| (c * qty).round() as i32);
        let protein = s_protein.map(|p| p * qty);
        let carbs = s_carbs.map(|c| c * qty);
        let fat = s_fat.map(|f| f * qty);

        let food_display: String = tx
            .query_row("SELECT display_name FROM foods WHERE id = ?1", [&food_id], |r| {
                r.get(0)
            })
            .map_err(|e| e.to_string())?;

        let item_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO meal_items (id, meal_id, food_name, serving_size, calories, protein_g,
                                     carbs_g, fat_g, food_id, serving_id, quantity)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                &item_id,
                &meal_activity_id,
                &food_display,
                &label,
                cal,
                protein,
                carbs,
                fat,
                &food_id,
                &serving_id,
                qty,
            ],
        )
        .map_err(|e| e.to_string())?;

        tx.execute(
            "UPDATE foods SET use_count = use_count + 1, last_used_at = ?1 WHERE id = ?2",
            rusqlite::params![&now, &food_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Bump template usage
    tx.execute(
        "UPDATE meal_templates SET use_count = use_count + 1, last_used_at = ?1 WHERE id = ?2",
        rusqlite::params![&now, &template_id],
    )
    .map_err(|e| e.to_string())?;

    recompute_meal_totals(&tx, &meal_activity_id).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_meal_template(template_id: String) -> Result<(), String> {
    let mut conn = open_db()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM meal_template_items WHERE template_id = ?1",
        [&template_id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM meal_templates WHERE id = ?1", [&template_id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

// ============================================================
// Week view
// ============================================================

#[derive(Serialize)]
struct DaySummary {
    date: String,
    calories: i32,
    protein_g: f64,
    meal_count: i32,
}

// ============================================================================
// Food insights — typed per period (day / week / month)
//
// Each period has its own command + response struct. The frontend picks the
// right component to render based on the active view. Decoupled this way so
// adding period-specific stats (e.g. "streak" on day, "best week" on month)
// doesn't require changing a shared response shape.
// ============================================================================

const CAL_TARGET: i32 = 2200;
const PROTEIN_TARGET: f64 = 150.0;

#[derive(Serialize)]
struct DayInsights {
    date: String,
    has_data: bool,
    calories: i32,
    protein_g: f64,
    carbs_g: f64,
    fat_g: f64,
    cal_target: i32,
    protein_target: f64,
}

#[derive(Serialize)]
struct BestProteinDay {
    date: String,
    day_label: String,
    protein_g: f64,
}

#[derive(Serialize)]
struct MostLoggedFood {
    food_name: String,
    count: i32,
}

#[derive(Serialize)]
struct PeriodInsights {
    period_label: String, // "this week" | "this month"
    days_logged: i32,
    days_in_period: i32,
    avg_cal: f64,
    avg_protein_g: f64,
    cal_target: i32,
    protein_target: f64,
    best_protein_day: Option<BestProteinDay>,
    days_under_cal_target: i32,
    most_logged: Option<MostLoggedFood>,
}

#[tauri::command]
fn food_day_insights(date: Option<String>) -> Result<DayInsights, String> {
    let conn = open_db()?;
    let date = date.unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

    let (cal, p, c, f, has): (i32, f64, f64, f64, bool) = conn
        .query_row(
            "SELECT COALESCE(SUM(m.total_calories), 0),
                    COALESCE(SUM(m.total_protein_g), 0),
                    COALESCE(SUM(m.total_carbs_g), 0),
                    COALESCE(SUM(m.total_fat_g), 0),
                    COUNT(*) > 0
             FROM activities a JOIN meals m ON a.id = m.activity_id
             WHERE date(a.created_at) = ?1",
            [&date],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .map_err(|e| e.to_string())?;

    Ok(DayInsights {
        date,
        has_data: has,
        calories: cal,
        protein_g: p,
        carbs_g: c,
        fat_g: f,
        cal_target: CAL_TARGET,
        protein_target: PROTEIN_TARGET,
    })
}

/// Shared implementation for week + month. `start_date` is inclusive,
/// `end_date` is inclusive. Both expected as YYYY-MM-DD strings.
fn period_insights_for_range(
    start_date: &str,
    end_date: &str,
    period_label: &str,
) -> Result<PeriodInsights, String> {
    let conn = open_db()?;

    let (days_logged, cal_sum, p_sum): (i32, f64, f64) = conn
        .query_row(
            "SELECT COUNT(DISTINCT date(a.created_at)),
                    COALESCE(SUM(m.total_calories), 0),
                    COALESCE(SUM(m.total_protein_g), 0)
             FROM activities a JOIN meals m ON a.id = m.activity_id
             WHERE date(a.created_at) >= ?1 AND date(a.created_at) <= ?2",
            rusqlite::params![start_date, end_date],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    let days_in_period: i32 = conn
        .query_row(
            "SELECT CAST(julianday(?2) - julianday(?1) + 1 AS INTEGER)",
            rusqlite::params![start_date, end_date],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let (avg_cal, avg_protein_g) = if days_logged > 0 {
        (cal_sum / days_logged as f64, p_sum / days_logged as f64)
    } else {
        (0.0, 0.0)
    };

    let best_protein_day: Option<BestProteinDay> = conn
        .query_row(
            "SELECT date(a.created_at), SUM(m.total_protein_g) as p
             FROM activities a JOIN meals m ON a.id = m.activity_id
             WHERE date(a.created_at) >= ?1 AND date(a.created_at) <= ?2
             GROUP BY date(a.created_at)
             ORDER BY p DESC LIMIT 1",
            rusqlite::params![start_date, end_date],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?)),
        )
        .ok()
        .map(|(date, protein_g)| {
            let day_label = chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d")
                .map(|d| d.format("%a").to_string())
                .unwrap_or_else(|_| "?".to_string());
            BestProteinDay {
                date,
                day_label,
                protein_g,
            }
        });

    let days_under_cal_target: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM (
                SELECT date(a.created_at) as d, SUM(m.total_calories) as c
                FROM activities a JOIN meals m ON a.id = m.activity_id
                WHERE date(a.created_at) >= ?1 AND date(a.created_at) <= ?2
                GROUP BY d HAVING c <= ?3
             )",
            rusqlite::params![start_date, end_date, CAL_TARGET],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let most_logged: Option<MostLoggedFood> = conn
        .query_row(
            "SELECT mi.food_name, COUNT(*) as c
             FROM meal_items mi
             JOIN meals m ON mi.meal_id = m.activity_id
             JOIN activities a ON a.id = m.activity_id
             WHERE date(a.created_at) >= ?1 AND date(a.created_at) <= ?2
             GROUP BY LOWER(mi.food_name)
             ORDER BY c DESC LIMIT 1",
            rusqlite::params![start_date, end_date],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, i32>(1)?)),
        )
        .ok()
        .filter(|(_, c)| *c >= 2)
        .map(|(food_name, count)| MostLoggedFood { food_name, count });

    Ok(PeriodInsights {
        period_label: period_label.to_string(),
        days_logged,
        days_in_period,
        avg_cal,
        avg_protein_g,
        cal_target: CAL_TARGET,
        protein_target: PROTEIN_TARGET,
        best_protein_day,
        days_under_cal_target,
        most_logged,
    })
}

#[tauri::command]
fn food_week_insights(start_date: String) -> Result<PeriodInsights, String> {
    // Sunday-start, 7 days. start_date is the Sunday.
    let conn = open_db()?;
    let end: String = conn
        .query_row(
            "SELECT date(?1, '+6 days')",
            [&start_date],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    period_insights_for_range(&start_date, &end, "this week")
}

#[tauri::command]
fn food_month_insights(year: i32, month: u32) -> Result<PeriodInsights, String> {
    let first = format!("{:04}-{:02}-01", year, month);
    let conn = open_db()?;
    let last: String = conn
        .query_row(
            "SELECT date(?1, 'start of month', '+1 month', '-1 day')",
            [&first],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    period_insights_for_range(&first, &last, "this month")
}

#[tauri::command]
fn restore_meal_item(
    item_id: String,
    meal_id: String,
    food_id: Option<String>,
    food_name: String,
    serving_id: Option<String>,
    serving_size: Option<String>,
    calories: Option<i32>,
    protein_g: Option<f64>,
    carbs_g: Option<f64>,
    fat_g: Option<f64>,
    quantity: Option<f64>,
) -> Result<(), String> {
    let mut conn = open_db()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO meal_items (id, meal_id, food_name, serving_size, calories, protein_g,
                                 carbs_g, fat_g, food_id, serving_id, quantity)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            &item_id,
            &meal_id,
            &food_name,
            &serving_size,
            calories,
            protein_g,
            carbs_g,
            fat_g,
            &food_id,
            &serving_id,
            quantity,
        ],
    )
    .map_err(|e| e.to_string())?;

    recompute_meal_totals(&tx, &meal_id).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_food_week(start_date: String) -> Result<Vec<DaySummary>, String> {
    let conn = open_db()?;
    let start = chrono::NaiveDate::parse_from_str(&start_date, "%Y-%m-%d")
        .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(7);
    for offset in 0..7 {
        let date = start + chrono::Duration::days(offset);
        let date_str = date.format("%Y-%m-%d").to_string();
        let row: Option<(Option<i32>, Option<f64>, i32)> = conn
            .query_row(
                "SELECT SUM(m.total_calories), SUM(m.total_protein_g), COUNT(*)
                 FROM activities a
                 JOIN meals m ON a.id = m.activity_id
                 WHERE date(a.created_at) = ?1",
                [&date_str],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .ok();
        let (cal, p, count) = row.unwrap_or((None, None, 0));
        out.push(DaySummary {
            date: date_str,
            calories: cal.unwrap_or(0),
            protein_g: p.unwrap_or(0.0),
            meal_count: count,
        });
    }
    Ok(out)
}

#[tauri::command]
fn search_foods(query: String, limit: Option<i32>) -> Result<Vec<FoodRow>, String> {
    let conn = open_db()?;
    let lim = limit.unwrap_or(20).clamp(1, 100);
    let pattern = format!("%{}%", query.trim().to_lowercase());

    let mut stmt = conn
        .prepare(
            "SELECT id, display_name, use_count, default_serving_id
             FROM foods WHERE name LIKE ?1
             ORDER BY use_count DESC, last_used_at DESC NULLS LAST
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let raw: Vec<(String, String, i32, Option<String>)> = stmt
        .query_map(rusqlite::params![&pattern, lim], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut out = Vec::with_capacity(raw.len());
    for (id, display_name, use_count, default_serving_id) in raw {
        let default_serving = if let Some(sid) = default_serving_id.as_deref() {
            conn.query_row(
                "SELECT id, label, calories, protein_g FROM servings WHERE id = ?1",
                [sid],
                |row| {
                    Ok(ServingRow {
                        id: row.get(0)?,
                        label: row.get(1)?,
                        calories: row.get(2)?,
                        protein_g: row.get(3)?,
                    })
                },
            )
            .ok()
        } else {
            conn.query_row(
                "SELECT id, label, calories, protein_g FROM servings WHERE food_id = ?1
                 ORDER BY is_default DESC, rowid LIMIT 1",
                [&id],
                |row| {
                    Ok(ServingRow {
                        id: row.get(0)?,
                        label: row.get(1)?,
                        calories: row.get(2)?,
                        protein_g: row.get(3)?,
                    })
                },
            )
            .ok()
        };

        out.push(FoodRow {
            id,
            display_name,
            use_count,
            default_serving,
        });
    }

    Ok(out)
}

#[tauri::command]
fn list_foods(order: Option<String>, limit: Option<i32>) -> Result<Vec<FoodRow>, String> {
    let conn = open_db()?;
    let lim = limit.unwrap_or(20).clamp(1, 100);

    let order_clause = match order.as_deref() {
        Some("frequent") => "ORDER BY use_count DESC, last_used_at DESC",
        _ => "ORDER BY last_used_at DESC NULLS LAST, use_count DESC",
    };

    let sql = format!(
        "SELECT id, display_name, use_count, default_serving_id
         FROM foods
         WHERE last_used_at IS NOT NULL OR use_count > 0
         {}
         LIMIT ?1",
        order_clause
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let raw: Vec<(String, String, i32, Option<String>)> = stmt
        .query_map([lim], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut out = Vec::with_capacity(raw.len());
    for (id, display_name, use_count, default_serving_id) in raw {
        let default_serving = if let Some(sid) = default_serving_id.as_deref() {
            conn.query_row(
                "SELECT id, label, calories, protein_g FROM servings WHERE id = ?1",
                [sid],
                |row| {
                    Ok(ServingRow {
                        id: row.get(0)?,
                        label: row.get(1)?,
                        calories: row.get(2)?,
                        protein_g: row.get(3)?,
                    })
                },
            )
            .ok()
        } else {
            // Fall back to first serving for this food
            conn.query_row(
                "SELECT id, label, calories, protein_g FROM servings WHERE food_id = ?1
                 ORDER BY is_default DESC, rowid LIMIT 1",
                [&id],
                |row| {
                    Ok(ServingRow {
                        id: row.get(0)?,
                        label: row.get(1)?,
                        calories: row.get(2)?,
                        protein_g: row.get(3)?,
                    })
                },
            )
            .ok()
        };

        out.push(FoodRow {
            id,
            display_name,
            use_count,
            default_serving,
        });
    }

    Ok(out)
}

// ============================================================
// Activity logs (reads YAML files in <project>/logs/daily/)
// ============================================================

#[derive(Serialize)]
struct ActivityCard {
    id: String,
    name: String,
    goal: String,
    status: String,
    description: String,
    date: String,
    detail: Option<String>,
}

fn logs_dir() -> PathBuf {
    // Walk up from the running binary to find the project root, or fall back
    // to a sensible default for dev.
    let default = PathBuf::from("/Users/jonhigger/Projects/higgzlife/logs/daily");
    if default.exists() {
        return default;
    }
    PathBuf::from(".").join("logs").join("daily")
}

fn plans_dir() -> PathBuf {
    let default = PathBuf::from("/Users/jonhigger/Projects/higgzlife/plans/daily");
    if default.exists() {
        return default;
    }
    PathBuf::from(".").join("plans").join("daily")
}

fn notes_dir() -> PathBuf {
    let dir = PathBuf::from("/Users/jonhigger/Projects/higgzlife/notes");
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    dir
}

fn note_path(activity_id: &str) -> PathBuf {
    notes_dir().join(format!("{}.md", activity_id))
}

fn note_template(title: &str) -> String {
    if title.is_empty() {
        "# Untitled\n\n".to_string()
    } else {
        format!("# {}\n\n", title)
    }
}

#[tauri::command]
fn read_activity_note(activity_id: String) -> Result<String, String> {
    let path = note_path(&activity_id);
    if !path.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(&path).map_err(|e| format!("read {:?}: {}", path, e))
}

#[tauri::command]
fn open_activity_note(activity_id: String, title: String) -> Result<(), String> {
    let path = note_path(&activity_id);
    if !path.exists() {
        std::fs::write(&path, note_template(&title))
            .map_err(|e| format!("write template {:?}: {}", path, e))?;
    }
    spawn_editor(&path)
}

fn spawn_editor(path: &std::path::Path) -> Result<(), String> {
    let path_str = path.to_string_lossy().to_string();

    // Try $VISUAL, then $EDITOR. Spawn directly if it's a known GUI editor;
    // otherwise fall back to macOS `open` (uses the default .md app handler).
    let editor = std::env::var("VISUAL")
        .ok()
        .or_else(|| std::env::var("EDITOR").ok());

    if let Some(ed) = editor {
        let first = ed.split_whitespace().next().unwrap_or("");
        let known_gui = ["code", "code-insiders", "subl", "mate", "atom", "zed"];
        if known_gui.iter().any(|g| first.ends_with(g)) {
            std::process::Command::new(first)
                .arg(&path_str)
                .spawn()
                .map_err(|e| format!("spawn {}: {}", first, e))?;
            return Ok(());
        }
    }

    // Fallback: open with macOS default app for .md.
    std::process::Command::new("open")
        .arg(&path_str)
        .spawn()
        .map_err(|e| format!("open {:?}: {}", path, e))?;
    Ok(())
}

fn extract_from_log(
    date: &str,
    doc: &serde_yaml::Value,
    out: &mut Vec<ActivityCard>,
) {
    // Workouts are now stored in the DB (workouts/exercises/exercise_sets)
    // and emitted as cards in `list_logged_activities`, not here. The
    // yaml `workout:` block is the source for the one-shot importer
    // (`cargo run --example import_workouts`), so we deliberately skip
    // emitting per-exercise activity cards from yaml to avoid duplicates.

    // Garden quiz → gardening activity
    if let Some(quiz) = doc.get("garden_quiz") {
        let asked = quiz
            .get("questions_asked")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        if asked > 0 {
            let topics = quiz
                .get("topics")
                .and_then(|v| v.as_sequence())
                .map(|s| s.len())
                .unwrap_or(0);
            out.push(ActivityCard {
                id: format!("{}-quiz", date),
                name: "Garden Quiz".to_string(),
                goal: "gardening".to_string(),
                status: "done".to_string(),
                description: format!("{} questions, {} topics", asked, topics),
                date: date.to_string(),
                detail: None,
            });
        }
    }

    // Tasks → activities with status from `completed`
    if let Some(tasks) = doc.get("tasks").and_then(|v| v.as_sequence()) {
        for t in tasks {
            let Some(name) = t.get("task").and_then(|v| v.as_str()) else {
                continue;
            };
            let done = t
                .get("completed")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let status_text = t.get("status").and_then(|v| v.as_str()).unwrap_or("");
            out.push(ActivityCard {
                id: format!("{}-task-{}", date, slug(name)),
                name: name.to_string(),
                goal: "life".to_string(),
                status: if done { "done" } else { "in_progress" }.to_string(),
                description: status_text.to_string(),
                date: date.to_string(),
                detail: None,
            });
        }
    }
}

fn slug(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

// ============================================================================
// Workouts
// ============================================================================

#[derive(Serialize)]
struct LoggedSet {
    id: String,
    set_number: i32,
    reps: Option<i32>,
    weight_lbs: Option<f64>,
    duration_sec: Option<i32>,
    distance_m: Option<f64>,
    rpe: Option<i32>,
    notes: Option<String>,
}

#[derive(Serialize)]
struct LoggedExercise {
    id: String,
    exercise_name: String,
    exercise_order: i32,
    kind: String,
    exercise_lib_id: Option<String>,
    notes: Option<String>,
    sets: Vec<LoggedSet>,
}

#[derive(Serialize)]
struct LoggedWorkout {
    activity_id: String,
    created_at: String,
    kind: Option<String>,
    workout_type: String,
    modality: Option<String>,
    duration_min: Option<i32>,
    distance_m: Option<f64>,
    elevation_m: Option<f64>,
    avg_hr: Option<i32>,
    energy_before: Option<i32>,
    energy_after: Option<i32>,
    location: Option<String>,
    title: Option<String>,
    notes: Option<String>,
    exercises: Vec<LoggedExercise>,
}

#[derive(Serialize)]
struct WorkoutDay {
    date: String,
    workouts: Vec<LoggedWorkout>,
}

#[derive(Serialize)]
struct WorkoutDaySummary {
    date: String,
    workout_count: i32,
    total_duration_min: i32,
    total_sets: i32,
    kinds: String, // comma-joined list of kinds done that day
}

#[derive(Serialize)]
struct ExerciseLibraryRow {
    id: String,
    name: String,
    display_name: String,
    muscle_group: Option<String>,
    equipment: Option<String>,
    default_kind: String,
    use_count: i32,
    last_used_at: Option<String>,
}

#[derive(Serialize)]
struct ExerciseHistoryEntry {
    date: String,
    workout_activity_id: String,
    workout_title: Option<String>,
    sets: Vec<LoggedSet>,
}

fn read_workout(conn: &rusqlite::Connection, activity_id: &str) -> Result<LoggedWorkout, String> {
    let w = conn
        .query_row(
            "SELECT a.id, a.created_at, w.workout_type, w.kind, w.modality, w.duration_min,
                    w.distance_m, w.elevation_m, w.avg_hr, w.energy_before, w.energy_after,
                    w.location, a.title, a.notes
             FROM workouts w JOIN activities a ON a.id = w.activity_id
             WHERE a.id = ?1",
            [activity_id],
            |r| {
                Ok(LoggedWorkout {
                    activity_id: r.get(0)?,
                    created_at: r.get(1)?,
                    workout_type: r.get(2)?,
                    kind: r.get(3)?,
                    modality: r.get(4)?,
                    duration_min: r.get(5)?,
                    distance_m: r.get(6)?,
                    elevation_m: r.get(7)?,
                    avg_hr: r.get(8)?,
                    energy_before: r.get(9)?,
                    energy_after: r.get(10)?,
                    location: r.get(11)?,
                    title: r.get(12)?,
                    notes: r.get(13)?,
                    exercises: Vec::new(),
                })
            },
        )
        .map_err(|e| e.to_string())?;

    let mut workout = w;
    let mut ex_stmt = conn
        .prepare(
            "SELECT id, exercise_name, exercise_order, kind, exercise_lib_id, notes
             FROM exercises WHERE workout_id = ?1 ORDER BY exercise_order",
        )
        .map_err(|e| e.to_string())?;
    let ex_rows: Vec<(String, String, i32, String, Option<String>, Option<String>)> = ex_stmt
        .query_map([activity_id], |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    for (id, name, order, kind, lib_id, notes) in ex_rows {
        let mut set_stmt = conn
            .prepare(
                "SELECT id, set_number, reps, weight_lbs, duration_sec, distance_m, rpe, notes
                 FROM exercise_sets WHERE exercise_id = ?1 ORDER BY set_number",
            )
            .map_err(|e| e.to_string())?;
        let sets: Vec<LoggedSet> = set_stmt
            .query_map([&id], |r| {
                Ok(LoggedSet {
                    id: r.get(0)?,
                    set_number: r.get(1)?,
                    reps: r.get(2)?,
                    weight_lbs: r.get(3)?,
                    duration_sec: r.get(4)?,
                    distance_m: r.get(5)?,
                    rpe: r.get(6)?,
                    notes: r.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        workout.exercises.push(LoggedExercise {
            id,
            exercise_name: name,
            exercise_order: order,
            kind,
            exercise_lib_id: lib_id,
            notes,
            sets,
        });
    }
    Ok(workout)
}

#[tauri::command]
fn list_workouts_for_date(date: Option<String>) -> Result<WorkoutDay, String> {
    let conn = open_db()?;
    let today = date.unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
    let mut ids_stmt = conn
        .prepare(
            "SELECT a.id FROM activities a JOIN workouts w ON w.activity_id = a.id
             WHERE date(a.created_at) = ?1 ORDER BY a.created_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let ids: Vec<String> = ids_stmt
        .query_map([&today], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    let mut workouts = Vec::with_capacity(ids.len());
    for id in ids {
        workouts.push(read_workout(&conn, &id)?);
    }
    Ok(WorkoutDay {
        date: today,
        workouts,
    })
}

#[tauri::command]
fn list_workouts_week(start_date: String) -> Result<Vec<WorkoutDaySummary>, String> {
    let conn = open_db()?;
    let mut stmt = conn
        .prepare(
            "WITH days(date) AS (
                SELECT date(?1) UNION ALL SELECT date(date, '+1 day') FROM days
                WHERE date < date(?1, '+6 days')
             )
             SELECT d.date,
                    COUNT(w.activity_id) as workout_count,
                    COALESCE(SUM(w.duration_min), 0) as total_duration,
                    COALESCE((SELECT COUNT(*) FROM exercise_sets s
                              JOIN exercises e ON e.id = s.exercise_id
                              JOIN workouts w2 ON w2.activity_id = e.workout_id
                              JOIN activities a2 ON a2.id = w2.activity_id
                              WHERE date(a2.created_at) = d.date), 0) as total_sets,
                    COALESCE(GROUP_CONCAT(DISTINCT w.kind), '') as kinds
             FROM days d
             LEFT JOIN activities a ON date(a.created_at) = d.date
             LEFT JOIN workouts w ON w.activity_id = a.id
             GROUP BY d.date ORDER BY d.date",
        )
        .map_err(|e| e.to_string())?;
    let rows: Vec<WorkoutDaySummary> = stmt
        .query_map([&start_date], |r| {
            Ok(WorkoutDaySummary {
                date: r.get(0)?,
                workout_count: r.get(1)?,
                total_duration_min: r.get(2)?,
                total_sets: r.get(3)?,
                kinds: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
fn list_workouts_month(year: i32, month: u32) -> Result<Vec<WorkoutDaySummary>, String> {
    let conn = open_db()?;
    let first = format!("{:04}-{:02}-01", year, month);
    let mut stmt = conn
        .prepare(
            "WITH days(date) AS (
                SELECT date(?1) UNION ALL SELECT date(date, '+1 day') FROM days
                WHERE date < date(?1, 'start of month', '+1 month', '-1 day')
             )
             SELECT d.date,
                    COUNT(w.activity_id),
                    COALESCE(SUM(w.duration_min), 0),
                    COALESCE((SELECT COUNT(*) FROM exercise_sets s
                              JOIN exercises e ON e.id = s.exercise_id
                              JOIN workouts w2 ON w2.activity_id = e.workout_id
                              JOIN activities a2 ON a2.id = w2.activity_id
                              WHERE date(a2.created_at) = d.date), 0),
                    COALESCE(GROUP_CONCAT(DISTINCT w.kind), '')
             FROM days d
             LEFT JOIN activities a ON date(a.created_at) = d.date
             LEFT JOIN workouts w ON w.activity_id = a.id
             GROUP BY d.date ORDER BY d.date",
        )
        .map_err(|e| e.to_string())?;
    let rows: Vec<WorkoutDaySummary> = stmt
        .query_map([&first], |r| {
            Ok(WorkoutDaySummary {
                date: r.get(0)?,
                workout_count: r.get(1)?,
                total_duration_min: r.get(2)?,
                total_sets: r.get(3)?,
                kinds: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
fn list_exercises(
    order: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<ExerciseLibraryRow>, String> {
    let conn = open_db()?;
    let order_sql = match order.as_deref().unwrap_or("recent") {
        "frequent" => "use_count DESC, last_used_at DESC",
        _ => "last_used_at DESC, use_count DESC",
    };
    let lim = limit.unwrap_or(20);
    let sql = format!(
        "SELECT id, name, display_name, muscle_group, equipment, default_kind,
                use_count, last_used_at
         FROM exercise_library ORDER BY {} LIMIT ?1",
        order_sql
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows: Vec<ExerciseLibraryRow> = stmt
        .query_map([lim], |r| {
            Ok(ExerciseLibraryRow {
                id: r.get(0)?,
                name: r.get(1)?,
                display_name: r.get(2)?,
                muscle_group: r.get(3)?,
                equipment: r.get(4)?,
                default_kind: r.get(5)?,
                use_count: r.get(6)?,
                last_used_at: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
fn search_exercises(
    query: String,
    limit: Option<i32>,
) -> Result<Vec<ExerciseLibraryRow>, String> {
    let conn = open_db()?;
    let pat = format!("%{}%", query.to_lowercase());
    let lim = limit.unwrap_or(15);
    let mut stmt = conn
        .prepare(
            "SELECT id, name, display_name, muscle_group, equipment, default_kind,
                    use_count, last_used_at
             FROM exercise_library WHERE name LIKE ?1 OR display_name LIKE ?1
             ORDER BY use_count DESC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;
    let rows: Vec<ExerciseLibraryRow> = stmt
        .query_map(rusqlite::params![pat, lim], |r| {
            Ok(ExerciseLibraryRow {
                id: r.get(0)?,
                name: r.get(1)?,
                display_name: r.get(2)?,
                muscle_group: r.get(3)?,
                equipment: r.get(4)?,
                default_kind: r.get(5)?,
                use_count: r.get(6)?,
                last_used_at: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
fn exercise_history(
    lib_id: String,
    limit: Option<i32>,
) -> Result<Vec<ExerciseHistoryEntry>, String> {
    let conn = open_db()?;
    let lim = limit.unwrap_or(10);
    let mut ex_stmt = conn
        .prepare(
            "SELECT e.id, date(a.created_at), a.id, a.title
             FROM exercises e
             JOIN workouts w ON w.activity_id = e.workout_id
             JOIN activities a ON a.id = w.activity_id
             WHERE e.exercise_lib_id = ?1
             ORDER BY a.created_at DESC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;
    let ex_rows: Vec<(String, String, String, Option<String>)> = ex_stmt
        .query_map(rusqlite::params![lib_id, lim], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut history = Vec::with_capacity(ex_rows.len());
    for (ex_id, date, activity_id, title) in ex_rows {
        let mut set_stmt = conn
            .prepare(
                "SELECT id, set_number, reps, weight_lbs, duration_sec, distance_m, rpe, notes
                 FROM exercise_sets WHERE exercise_id = ?1 ORDER BY set_number",
            )
            .map_err(|e| e.to_string())?;
        let sets: Vec<LoggedSet> = set_stmt
            .query_map([&ex_id], |r| {
                Ok(LoggedSet {
                    id: r.get(0)?,
                    set_number: r.get(1)?,
                    reps: r.get(2)?,
                    weight_lbs: r.get(3)?,
                    duration_sec: r.get(4)?,
                    distance_m: r.get(5)?,
                    rpe: r.get(6)?,
                    notes: r.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        history.push(ExerciseHistoryEntry {
            date,
            workout_activity_id: activity_id,
            workout_title: title,
            sets,
        });
    }
    Ok(history)
}

// ----- Write commands -----

#[derive(Deserialize)]
struct StrengthSetInput {
    reps: Option<i32>,
    weight_lbs: Option<f64>,
    duration_sec: Option<i32>,
    rpe: Option<i32>,
    notes: Option<String>,
}

#[derive(Deserialize)]
struct StrengthExerciseInput {
    exercise_lib_id: Option<String>,
    exercise_name: String,
    kind: Option<String>,
    notes: Option<String>,
    sets: Vec<StrengthSetInput>,
}

fn upsert_exercise_lib(
    tx: &rusqlite::Transaction,
    lib_id: Option<&str>,
    name: &str,
    default_kind: &str,
) -> Result<String, String> {
    if let Some(id) = lib_id {
        tx.execute(
            "UPDATE exercise_library SET use_count = use_count + 1,
                                          last_used_at = datetime('now')
             WHERE id = ?1",
            [id],
        )
        .map_err(|e| e.to_string())?;
        return Ok(id.to_string());
    }
    let normalized = slug(name);
    let existing: Option<String> = tx
        .query_row(
            "SELECT id FROM exercise_library WHERE name = ?1",
            [&normalized],
            |r| r.get(0),
        )
        .ok();
    if let Some(id) = existing {
        tx.execute(
            "UPDATE exercise_library SET use_count = use_count + 1,
                                          last_used_at = datetime('now')
             WHERE id = ?1",
            [&id],
        )
        .map_err(|e| e.to_string())?;
        return Ok(id);
    }
    let new_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO exercise_library
            (id, name, display_name, default_kind, use_count, last_used_at, created_at)
         VALUES (?1, ?2, ?3, ?4, 1, datetime('now'), datetime('now'))",
        rusqlite::params![&new_id, &normalized, name, default_kind],
    )
    .map_err(|e| e.to_string())?;
    Ok(new_id)
}

#[tauri::command]
fn log_strength_workout(
    title: Option<String>,
    duration_min: Option<i32>,
    energy_before: Option<i32>,
    energy_after: Option<i32>,
    location: Option<String>,
    notes: Option<String>,
    exercises: Vec<StrengthExerciseInput>,
) -> Result<String, String> {
    let mut conn = open_db()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let activity_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Local::now().to_rfc3339();
    tx.execute(
        "INSERT INTO activities (id, activity_type, created_at, updated_at, status, title, notes)
         VALUES (?1, 'workout', ?2, ?2, 'done', ?3, ?4)",
        rusqlite::params![&activity_id, &now, &title, &notes],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO workouts (activity_id, workout_type, kind, duration_min,
                               energy_before, energy_after, location)
         VALUES (?1, 'strength', 'strength', ?2, ?3, ?4, ?5)",
        rusqlite::params![
            &activity_id,
            &duration_min,
            &energy_before,
            &energy_after,
            &location
        ],
    )
    .map_err(|e| e.to_string())?;

    for (idx, ex) in exercises.iter().enumerate() {
        let ex_kind = ex.kind.clone().unwrap_or_else(|| {
            if ex.sets.iter().any(|s| s.duration_sec.is_some()) {
                "timed".into()
            } else {
                "strength".into()
            }
        });
        let lib_id = upsert_exercise_lib(
            &tx,
            ex.exercise_lib_id.as_deref(),
            &ex.exercise_name,
            &ex_kind,
        )?;
        let exercise_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO exercises (id, workout_id, exercise_name, exercise_order, notes,
                                    exercise_lib_id, kind)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                &exercise_id,
                &activity_id,
                &ex.exercise_name,
                idx as i64,
                &ex.notes,
                &lib_id,
                &ex_kind
            ],
        )
        .map_err(|e| e.to_string())?;

        for (i, set) in ex.sets.iter().enumerate() {
            let set_id = uuid::Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO exercise_sets
                    (id, exercise_id, set_number, reps, weight_lbs, duration_sec, rpe, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    &set_id,
                    &exercise_id,
                    (i + 1) as i64,
                    &set.reps,
                    &set.weight_lbs,
                    &set.duration_sec,
                    &set.rpe,
                    &set.notes
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(activity_id)
}

#[tauri::command]
fn log_cardio_workout(
    modality: String,
    title: Option<String>,
    duration_min: Option<i32>,
    distance_m: Option<f64>,
    elevation_m: Option<f64>,
    avg_hr: Option<i32>,
    energy_before: Option<i32>,
    energy_after: Option<i32>,
    location: Option<String>,
    notes: Option<String>,
) -> Result<String, String> {
    let conn = open_db()?;
    let activity_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO activities (id, activity_type, created_at, updated_at, status, title, notes)
         VALUES (?1, 'workout', ?2, ?2, 'done', ?3, ?4)",
        rusqlite::params![&activity_id, &now, &title, &notes],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO workouts (activity_id, workout_type, kind, modality,
                               duration_min, distance_m, elevation_m, avg_hr,
                               energy_before, energy_after, location)
         VALUES (?1, 'cardio', 'cardio', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            &activity_id,
            &modality,
            &duration_min,
            &distance_m,
            &elevation_m,
            &avg_hr,
            &energy_before,
            &energy_after,
            &location,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(activity_id)
}

// ============================================================================
// Plans (markdown w/ yaml frontmatter)
// ============================================================================

#[derive(Serialize, Deserialize, Debug)]
struct PlanExercise {
    name: String,
    #[serde(default)]
    sets: Option<i32>,
    #[serde(default)]
    reps: Option<serde_yaml::Value>,
    #[serde(default)]
    duration: Option<String>,
    #[serde(default)]
    note: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct PlanWorkout {
    #[serde(rename = "type", default)]
    workout_type: Option<String>,
    #[serde(default)]
    focus: Option<String>,
    #[serde(default)]
    duration_min: Option<i32>,
    #[serde(default)]
    modality: Option<String>,
    #[serde(default)]
    exercises: Vec<PlanExercise>,
}

#[derive(Serialize, Deserialize, Debug)]
struct PlanFrontmatter {
    #[serde(default)]
    date: Option<String>,
    #[serde(default)]
    day: Option<String>,
    #[serde(default)]
    energy_level: Option<String>,
    #[serde(default)]
    adjustments: Option<String>,
    #[serde(default)]
    workout: Option<PlanWorkout>,
}

#[derive(Serialize)]
struct DailyPlan {
    date: String,
    frontmatter: PlanFrontmatter,
    body_markdown: String,
    file_exists: bool,
}

/// Split a markdown file with optional yaml frontmatter into (frontmatter_yaml, body).
/// Frontmatter is delimited by `---` lines at the top of the file.
fn split_frontmatter(content: &str) -> (Option<&str>, &str) {
    let trimmed = content.trim_start_matches('\u{feff}');
    if let Some(rest) = trimmed.strip_prefix("---\n") {
        if let Some(end) = rest.find("\n---\n") {
            let (fm, body) = rest.split_at(end);
            return (Some(fm), &body[5..]);
        }
        if let Some(end) = rest.find("\n---") {
            let (fm, body) = rest.split_at(end);
            return (Some(fm), body.get(4..).unwrap_or(""));
        }
    }
    (None, trimmed)
}

#[tauri::command]
fn list_plan_for_date(date: String) -> Result<DailyPlan, String> {
    let path = plans_dir().join(format!("{}.md", date));
    if !path.exists() {
        return Ok(DailyPlan {
            date,
            frontmatter: PlanFrontmatter {
                date: None,
                day: None,
                energy_level: None,
                adjustments: None,
                workout: None,
            },
            body_markdown: String::new(),
            file_exists: false,
        });
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("read {:?}: {}", path, e))?;
    let (fm_str, body) = split_frontmatter(&content);
    let frontmatter: PlanFrontmatter = match fm_str {
        Some(s) => serde_yaml::from_str(s).map_err(|e| format!("frontmatter parse: {}", e))?,
        None => PlanFrontmatter {
            date: None,
            day: None,
            energy_level: None,
            adjustments: None,
            workout: None,
        },
    };
    Ok(DailyPlan {
        date,
        frontmatter,
        body_markdown: body.trim_start_matches('\n').to_string(),
        file_exists: true,
    })
}

#[tauri::command]
fn list_plan_dates() -> Result<Vec<String>, String> {
    let dir = plans_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut dates: Vec<String> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let p = e.path();
            if p.extension().and_then(|x| x.to_str()) != Some("md") {
                return None;
            }
            p.file_stem()
                .and_then(|s| s.to_str())
                .filter(|s| !s.starts_with('.'))
                .map(|s| s.to_string())
        })
        .collect();
    dates.sort();
    dates.reverse();
    Ok(dates)
}

// ============================================================================
// Activity detail (Linear-style ticket view)
// ============================================================================

#[derive(Serialize)]
struct ActivityRow {
    id: String,
    activity_type: String,
    created_at: String,
    updated_at: Option<String>,
    status: String,
    title: Option<String>,
    notes: Option<String>,
    tags: Vec<String>,
}

#[derive(Serialize)]
struct LoggedMealItemDetail {
    id: String,
    food_name: String,
    serving_size: Option<String>,
    calories: Option<i32>,
    protein_g: Option<f64>,
    carbs_g: Option<f64>,
    fat_g: Option<f64>,
    quantity: Option<f64>,
}

#[derive(Serialize)]
struct LoggedMealDetail {
    meal_type: String,
    total_calories: Option<i32>,
    total_protein_g: Option<f64>,
    total_carbs_g: Option<f64>,
    total_fat_g: Option<f64>,
    items: Vec<LoggedMealItemDetail>,
}

#[derive(Serialize)]
#[serde(tag = "kind", content = "data")]
enum ActivityPayload {
    #[serde(rename = "workout")]
    Workout(LoggedWorkout),
    #[serde(rename = "meal")]
    Meal(LoggedMealDetail),
    #[serde(rename = "none")]
    None,
}

#[derive(Serialize)]
struct ActivityDetail {
    activity: ActivityRow,
    payload: ActivityPayload,
    note_md: String,
}

fn read_activity_row(conn: &rusqlite::Connection, id: &str) -> Result<ActivityRow, String> {
    let row = conn
        .query_row(
            "SELECT id, activity_type, created_at, updated_at, status, title, notes
             FROM activities WHERE id = ?1",
            [id],
            |r| {
                Ok(ActivityRow {
                    id: r.get(0)?,
                    activity_type: r.get(1)?,
                    created_at: r.get(2)?,
                    updated_at: r.get(3)?,
                    status: r.get(4)?,
                    title: r.get(5)?,
                    notes: r.get(6)?,
                    tags: Vec::new(),
                })
            },
        )
        .map_err(|e| format!("activity {} not found: {}", id, e))?;

    let mut row = row;
    let mut stmt = conn
        .prepare("SELECT tag FROM activity_tags WHERE activity_id = ?1")
        .map_err(|e| e.to_string())?;
    row.tags = stmt
        .query_map([id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(row)
}

fn read_meal_detail(conn: &rusqlite::Connection, id: &str) -> Result<LoggedMealDetail, String> {
    let (meal_type, tc, tp, tcr, tf): (
        String,
        Option<i32>,
        Option<f64>,
        Option<f64>,
        Option<f64>,
    ) = conn
        .query_row(
            "SELECT meal_type, total_calories, total_protein_g, total_carbs_g, total_fat_g
             FROM meals WHERE activity_id = ?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, food_name, serving_size, calories, protein_g, carbs_g, fat_g, quantity
             FROM meal_items WHERE meal_id = ?1 ORDER BY rowid",
        )
        .map_err(|e| e.to_string())?;
    let items: Vec<LoggedMealItemDetail> = stmt
        .query_map([id], |r| {
            Ok(LoggedMealItemDetail {
                id: r.get(0)?,
                food_name: r.get(1)?,
                serving_size: r.get(2)?,
                calories: r.get(3)?,
                protein_g: r.get(4)?,
                carbs_g: r.get(5)?,
                fat_g: r.get(6)?,
                quantity: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(LoggedMealDetail {
        meal_type,
        total_calories: tc,
        total_protein_g: tp,
        total_carbs_g: tcr,
        total_fat_g: tf,
        items,
    })
}

#[tauri::command]
fn get_activity(activity_id: String) -> Result<ActivityDetail, String> {
    let conn = open_db()?;
    let activity = read_activity_row(&conn, &activity_id)?;
    let payload = match activity.activity_type.as_str() {
        "workout" => ActivityPayload::Workout(read_workout(&conn, &activity_id)?),
        "meal" => ActivityPayload::Meal(read_meal_detail(&conn, &activity_id)?),
        _ => ActivityPayload::None,
    };
    let note_md = read_activity_note(activity_id.clone()).unwrap_or_default();
    Ok(ActivityDetail {
        activity,
        payload,
        note_md,
    })
}

#[tauri::command]
fn delete_workout(activity_id: String) -> Result<(), String> {
    let conn = open_db()?;
    conn.execute("DELETE FROM activities WHERE id = ?1", [&activity_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_logged_activities() -> Result<Vec<ActivityCard>, String> {
    let dir = logs_dir();
    let mut out: Vec<ActivityCard> = Vec::new();

    let entries = std::fs::read_dir(&dir).map_err(|e| format!("read_dir {:?}: {}", dir, e))?;

    let mut files: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|x| x.to_str()) == Some("yaml"))
        .collect();
    files.sort();

    for path in files {
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let doc: serde_yaml::Value = match serde_yaml::from_str(&content) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let date = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();
        extract_from_log(&date, &doc, &mut out);
    }

    // Workouts from the DB → one card per workout.
    if let Ok(conn) = open_db() {
        if let Ok(mut stmt) = conn.prepare(
            "SELECT a.id, date(a.created_at) as d, w.kind, w.workout_type, w.modality,
                    w.duration_min, w.distance_m, a.title,
                    (SELECT COUNT(*) FROM exercises e WHERE e.workout_id = a.id) as ex_count
             FROM workouts w JOIN activities a ON a.id = w.activity_id
             ORDER BY a.created_at DESC",
        ) {
            let rows = stmt.query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Option<String>>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, Option<String>>(4)?,
                    r.get::<_, Option<i32>>(5)?,
                    r.get::<_, Option<f64>>(6)?,
                    r.get::<_, Option<String>>(7)?,
                    r.get::<_, i32>(8)?,
                ))
            });
            if let Ok(rows) = rows {
                for row in rows.filter_map(|r| r.ok()) {
                    let (id, date, kind, wtype, modality, duration, distance_m, title, ex_count) =
                        row;
                    let kind_label = kind.as_deref().unwrap_or(&wtype);
                    let display_name = title.unwrap_or_else(|| {
                        modality
                            .clone()
                            .map(|m| format!("{} ({})", kind_label, m))
                            .unwrap_or_else(|| kind_label.to_string())
                    });
                    let mut detail_parts: Vec<String> = Vec::new();
                    if let Some(d) = duration {
                        detail_parts.push(format!("{} min", d));
                    }
                    if let Some(m) = distance_m {
                        detail_parts.push(format!("{:.1} mi", m / 1609.344));
                    }
                    if ex_count > 0 {
                        detail_parts.push(format!("{} exercises", ex_count));
                    }
                    out.push(ActivityCard {
                        id,
                        name: display_name,
                        goal: "fitness".to_string(),
                        status: "done".to_string(),
                        description: kind_label.to_string(),
                        date,
                        detail: if detail_parts.is_empty() {
                            None
                        } else {
                            Some(detail_parts.join(" · "))
                        },
                    });
                }
            }
        }
    }

    Ok(out)
}

/// Initialize Sentry pointing at the local Spotlight sidecar.
/// All events stay on the dev machine — no remote ingestion.
fn init_sentry() -> sentry::ClientInitGuard {
    // Spotlight sidecar's "envelope" endpoint. The DSN format is fake but
    // valid-looking; sentry-rust uses it to construct the upload URL.
    let dsn = "http://public@localhost:8969/0";
    sentry::init((
        dsn,
        sentry::ClientOptions {
            release: sentry::release_name!(),
            environment: Some("dev".into()),
            traces_sample_rate: 1.0,
            attach_stacktrace: true,
            ..Default::default()
        },
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _sentry_guard = init_sentry();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(PtyState {
            master: Mutex::new(None),
            writer: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            pty_open,
            pty_write,
            pty_resize,
            list_logged_activities,
            list_food_for_date,
            list_foods,
            list_food_servings,
            search_foods,
            log_quick_add,
            delete_meal_item,
            save_meal_as_template,
            list_meal_templates,
            apply_meal_template,
            delete_meal_template,
            list_food_week,
            food_day_insights,
            food_week_insights,
            food_month_insights,
            restore_meal_item,
            update_meal_item,
            list_food_month,
            list_workouts_for_date,
            list_workouts_week,
            list_workouts_month,
            list_exercises,
            search_exercises,
            exercise_history,
            log_strength_workout,
            log_cardio_workout,
            delete_workout,
            list_plan_for_date,
            list_plan_dates,
            get_activity,
            read_activity_note,
            open_activity_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
