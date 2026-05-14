use anyhow::Result;
use chrono::{DateTime, NaiveDate, Utc};
use rusqlite::{Connection, params, Row};
use uuid::Uuid;

use crate::models::*;

// ============================================================================
// Activity queries
// ============================================================================

pub fn insert_activity(conn: &Connection, activity: &Activity) -> Result<()> {
    conn.execute(
        "INSERT INTO activities (id, activity_type, created_at, updated_at, status, title, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            activity.id.to_string(),
            activity.activity_type.to_string(),
            activity.created_at.to_rfc3339(),
            activity.updated_at.to_rfc3339(),
            activity.status.to_string(),
            activity.title,
            activity.notes,
        ],
    )?;

    // Insert tags
    for tag in &activity.tags {
        conn.execute(
            "INSERT INTO activity_tags (activity_id, tag) VALUES (?1, ?2)",
            params![activity.id.to_string(), tag],
        )?;
    }

    Ok(())
}

pub fn get_activity(conn: &Connection, id: Uuid) -> Result<Option<Activity>> {
    let mut stmt = conn.prepare(
        "SELECT id, activity_type, created_at, updated_at, status, title, notes
         FROM activities WHERE id = ?1"
    )?;

    let activity = stmt.query_row(params![id.to_string()], |row| {
        Ok(Activity {
            id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
            activity_type: row.get::<_, String>(1)?.parse().unwrap(),
            created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                .unwrap()
                .with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                .unwrap()
                .with_timezone(&Utc),
            status: row.get::<_, String>(4)?.parse().unwrap(),
            title: row.get(5)?,
            notes: row.get(6)?,
            tags: Vec::new(), // Filled below
        })
    }).optional()?;

    if let Some(mut activity) = activity {
        activity.tags = get_activity_tags(conn, id)?;
        Ok(Some(activity))
    } else {
        Ok(None)
    }
}

pub fn get_activity_tags(conn: &Connection, activity_id: Uuid) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT tag FROM activity_tags WHERE activity_id = ?1"
    )?;

    let tags: Vec<String> = stmt
        .query_map(params![activity_id.to_string()], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(tags)
}

pub fn list_activities_today(conn: &Connection) -> Result<Vec<ActivitySummary>> {
    let mut stmt = conn.prepare(
        "SELECT id, activity_type, created_at, status, title
         FROM activities
         WHERE date(created_at) = date('now', 'localtime')
         ORDER BY created_at DESC"
    )?;

    let activities: Vec<ActivitySummary> = stmt
        .query_map([], |row| {
            Ok(ActivitySummary {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
                activity_type: row.get::<_, String>(1)?.parse().unwrap(),
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                    .unwrap()
                    .with_timezone(&Utc),
                status: row.get::<_, String>(3)?.parse().unwrap(),
                title: row.get(4)?,
                tags: Vec::new(),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(activities)
}

// ============================================================================
// Meal queries
// ============================================================================

pub fn insert_meal(conn: &Connection, meal: &Meal) -> Result<()> {
    conn.execute(
        "INSERT INTO meals (activity_id, meal_type, total_calories, total_protein_g,
         total_carbs_g, total_fat_g, total_fiber_g)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            meal.activity_id.to_string(),
            meal.meal_type.to_string(),
            meal.total_calories,
            meal.total_protein_g,
            meal.total_carbs_g,
            meal.total_fat_g,
            meal.total_fiber_g,
        ],
    )?;

    // Insert meal items
    for item in &meal.items {
        insert_meal_item(conn, item)?;
    }

    Ok(())
}

pub fn insert_meal_item(conn: &Connection, item: &MealItem) -> Result<()> {
    conn.execute(
        "INSERT INTO meal_items (id, meal_id, food_name, serving_size, calories,
         protein_g, carbs_g, fat_g, fiber_g, notes, food_id, serving_id, quantity)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            item.id.to_string(),
            item.meal_id.to_string(),
            item.food_name,
            item.serving_size,
            item.calories,
            item.protein_g,
            item.carbs_g,
            item.fat_g,
            item.fiber_g,
            item.notes,
            item.food_id.map(|u| u.to_string()),
            item.serving_id.map(|u| u.to_string()),
            item.quantity,
        ],
    )?;
    Ok(())
}

/// Fetch all meal items for a given meal.
pub fn get_meal_items(conn: &Connection, meal_id: Uuid) -> Result<Vec<MealItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, meal_id, food_name, serving_size, calories, protein_g,
                carbs_g, fat_g, fiber_g, notes, food_id, serving_id, quantity
         FROM meal_items WHERE meal_id = ?1
         ORDER BY rowid",
    )?;
    let items = stmt
        .query_map(params![meal_id.to_string()], |row| {
            Ok(MealItem {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
                meal_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap(),
                food_name: row.get(2)?,
                serving_size: row.get(3)?,
                calories: row.get(4)?,
                protein_g: row.get(5)?,
                carbs_g: row.get(6)?,
                fat_g: row.get(7)?,
                fiber_g: row.get(8)?,
                notes: row.get(9)?,
                food_id: row
                    .get::<_, Option<String>>(10)?
                    .and_then(|s| Uuid::parse_str(&s).ok()),
                serving_id: row
                    .get::<_, Option<String>>(11)?
                    .and_then(|s| Uuid::parse_str(&s).ok()),
                quantity: row.get(12)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(items)
}

/// List all meals on a given date (with their items).
pub fn list_meals_for_date(
    conn: &Connection,
    date: NaiveDate,
) -> Result<Vec<(Activity, Meal)>> {
    let date_str = date.format("%Y-%m-%d").to_string();
    let mut stmt = conn.prepare(
        "SELECT a.id, a.activity_type, a.created_at, a.updated_at, a.status, a.title, a.notes,
                m.meal_type, m.total_calories, m.total_protein_g, m.total_carbs_g,
                m.total_fat_g, m.total_fiber_g
         FROM activities a
         JOIN meals m ON a.id = m.activity_id
         WHERE date(a.created_at) = ?1
         ORDER BY a.created_at ASC",
    )?;

    let rows: Vec<(Activity, MealType, Option<i32>, Option<f64>, Option<f64>, Option<f64>, Option<f64>)> = stmt
        .query_map(params![&date_str], |row| {
            let id = Uuid::parse_str(&row.get::<_, String>(0)?).unwrap();
            let activity = Activity {
                id,
                activity_type: row.get::<_, String>(1)?.parse().unwrap(),
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                    .unwrap()
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                    .unwrap()
                    .with_timezone(&Utc),
                status: row.get::<_, String>(4)?.parse().unwrap(),
                title: row.get(5)?,
                notes: row.get(6)?,
                tags: Vec::new(),
            };
            let meal_type: MealType = row.get::<_, String>(7)?.parse().unwrap_or(MealType::Snack);
            Ok((
                activity,
                meal_type,
                row.get(8)?,
                row.get(9)?,
                row.get(10)?,
                row.get(11)?,
                row.get(12)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut out = Vec::with_capacity(rows.len());
    for (activity, mt, cal, p, c, f, fi) in rows {
        let items = get_meal_items(conn, activity.id)?;
        let meal = Meal {
            activity_id: activity.id,
            meal_type: mt,
            total_calories: cal,
            total_protein_g: p,
            total_carbs_g: c,
            total_fat_g: f,
            total_fiber_g: fi,
            items,
        };
        out.push((activity, meal));
    }
    Ok(out)
}

// ============================================================================
// Food + Serving queries
// ============================================================================

fn normalize_food_name(s: &str) -> String {
    s.trim().to_lowercase()
}

/// Insert or fetch a food by normalized name. Returns the food row.
pub fn upsert_food(conn: &Connection, display_name: &str) -> Result<Food> {
    let normalized = normalize_food_name(display_name);
    let now = Utc::now();

    if let Some(food) = get_food_by_name(conn, &normalized)? {
        return Ok(food);
    }

    let id = Uuid::new_v4();
    conn.execute(
        "INSERT INTO foods (id, name, display_name, created_at, use_count)
         VALUES (?1, ?2, ?3, ?4, 0)",
        params![
            id.to_string(),
            normalized,
            display_name.trim(),
            now.to_rfc3339(),
        ],
    )?;
    Ok(Food {
        id,
        name: normalized,
        display_name: display_name.trim().to_string(),
        default_serving_id: None,
        last_used_at: None,
        use_count: 0,
        created_at: now,
        notes: None,
    })
}

fn row_to_food(row: &Row) -> rusqlite::Result<Food> {
    Ok(Food {
        id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
        name: row.get(1)?,
        display_name: row.get(2)?,
        default_serving_id: row
            .get::<_, Option<String>>(3)?
            .and_then(|s| Uuid::parse_str(&s).ok()),
        last_used_at: row
            .get::<_, Option<String>>(4)?
            .map(|s| DateTime::parse_from_rfc3339(&s).unwrap().with_timezone(&Utc)),
        use_count: row.get(5)?,
        created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
            .unwrap()
            .with_timezone(&Utc),
        notes: row.get(7)?,
    })
}

pub fn get_food(conn: &Connection, id: Uuid) -> Result<Option<Food>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, display_name, default_serving_id, last_used_at, use_count,
                created_at, notes
         FROM foods WHERE id = ?1",
    )?;
    let food = stmt
        .query_row(params![id.to_string()], row_to_food)
        .optional()?;
    Ok(food)
}

pub fn get_food_by_name(conn: &Connection, normalized_name: &str) -> Result<Option<Food>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, display_name, default_serving_id, last_used_at, use_count,
                created_at, notes
         FROM foods WHERE name = ?1",
    )?;
    let food = stmt
        .query_row(params![normalized_name], row_to_food)
        .optional()?;
    Ok(food)
}

pub fn search_foods(conn: &Connection, query: &str, limit: i32) -> Result<Vec<Food>> {
    let q = format!("%{}%", normalize_food_name(query));
    let mut stmt = conn.prepare(
        "SELECT id, name, display_name, default_serving_id, last_used_at, use_count,
                created_at, notes
         FROM foods
         WHERE name LIKE ?1
         ORDER BY use_count DESC, last_used_at DESC NULLS LAST
         LIMIT ?2",
    )?;
    let foods = stmt
        .query_map(params![q, limit], row_to_food)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(foods)
}

pub fn list_recent_foods(conn: &Connection, limit: i32) -> Result<Vec<Food>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, display_name, default_serving_id, last_used_at, use_count,
                created_at, notes
         FROM foods
         WHERE last_used_at IS NOT NULL
         ORDER BY last_used_at DESC
         LIMIT ?1",
    )?;
    let foods = stmt
        .query_map(params![limit], row_to_food)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(foods)
}

pub fn list_frequent_foods(conn: &Connection, limit: i32) -> Result<Vec<Food>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, display_name, default_serving_id, last_used_at, use_count,
                created_at, notes
         FROM foods
         WHERE use_count > 0
         ORDER BY use_count DESC, last_used_at DESC
         LIMIT ?1",
    )?;
    let foods = stmt
        .query_map(params![limit], row_to_food)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(foods)
}

pub fn bump_food_usage(conn: &Connection, food_id: Uuid) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE foods SET use_count = use_count + 1, last_used_at = ?1 WHERE id = ?2",
        params![now, food_id.to_string()],
    )?;
    Ok(())
}

fn row_to_serving(row: &Row) -> rusqlite::Result<Serving> {
    Ok(Serving {
        id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
        food_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap(),
        label: row.get(2)?,
        grams: row.get(3)?,
        calories: row.get(4)?,
        protein_g: row.get(5)?,
        carbs_g: row.get(6)?,
        fat_g: row.get(7)?,
        fiber_g: row.get(8)?,
        is_default: row.get::<_, i32>(9)? != 0,
        created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(10)?)
            .unwrap()
            .with_timezone(&Utc),
    })
}

pub fn list_servings(conn: &Connection, food_id: Uuid) -> Result<Vec<Serving>> {
    let mut stmt = conn.prepare(
        "SELECT id, food_id, label, grams, calories, protein_g, carbs_g, fat_g,
                fiber_g, is_default, created_at
         FROM servings
         WHERE food_id = ?1
         ORDER BY is_default DESC, label",
    )?;
    let servings = stmt
        .query_map(params![food_id.to_string()], row_to_serving)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(servings)
}

#[allow(clippy::too_many_arguments)]
pub fn upsert_serving(
    conn: &Connection,
    food_id: Uuid,
    label: &str,
    grams: Option<f64>,
    calories: Option<f64>,
    protein_g: Option<f64>,
    carbs_g: Option<f64>,
    fat_g: Option<f64>,
    fiber_g: Option<f64>,
    make_default: bool,
) -> Result<Serving> {
    // Try to find an existing serving with the same label
    let existing: Option<Serving> = conn
        .query_row(
            "SELECT id, food_id, label, grams, calories, protein_g, carbs_g, fat_g,
                    fiber_g, is_default, created_at
             FROM servings WHERE food_id = ?1 AND label = ?2",
            params![food_id.to_string(), label],
            row_to_serving,
        )
        .optional()?;

    if let Some(existing) = existing {
        return Ok(existing);
    }

    let id = Uuid::new_v4();
    let now = Utc::now();
    conn.execute(
        "INSERT INTO servings (id, food_id, label, grams, calories, protein_g, carbs_g,
                               fat_g, fiber_g, is_default, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            id.to_string(),
            food_id.to_string(),
            label,
            grams,
            calories,
            protein_g,
            carbs_g,
            fat_g,
            fiber_g,
            make_default as i32,
            now.to_rfc3339(),
        ],
    )?;

    if make_default {
        conn.execute(
            "UPDATE foods SET default_serving_id = ?1 WHERE id = ?2",
            params![id.to_string(), food_id.to_string()],
        )?;
    }

    Ok(Serving {
        id,
        food_id,
        label: label.to_string(),
        grams,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        fiber_g,
        is_default: make_default,
        created_at: now,
    })
}

/// Convenience: search foods + return each with its servings.
pub fn search_foods_with_servings(
    conn: &Connection,
    query: &str,
    limit: i32,
) -> Result<Vec<FoodWithServings>> {
    let foods = search_foods(conn, query, limit)?;
    let mut out = Vec::with_capacity(foods.len());
    for food in foods {
        let servings = list_servings(conn, food.id)?;
        out.push(FoodWithServings { food, servings });
    }
    Ok(out)
}

/// Backfill: scan existing meal_items rows that lack a food_id and create
/// foods + servings for them. Idempotent.
pub fn backfill_foods_from_meal_items(conn: &Connection) -> Result<usize> {
    let mut stmt = conn.prepare(
        "SELECT id, food_name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g
         FROM meal_items
         WHERE food_id IS NULL AND food_name IS NOT NULL AND food_name != ''",
    )?;
    let rows: Vec<(String, String, Option<String>, Option<i32>, Option<f64>, Option<f64>, Option<f64>, Option<f64>)> = stmt
        .query_map([], |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
                r.get(6)?,
                r.get(7)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    drop(stmt);

    let mut updated = 0;
    for (item_id, name, serving_size, cal, prot, carbs, fat, fiber) in rows {
        let food = upsert_food(conn, &name)?;
        let label = serving_size.unwrap_or_else(|| "1 serving".to_string());
        let serving = upsert_serving(
            conn,
            food.id,
            &label,
            None,
            cal.map(|c| c as f64),
            prot,
            carbs,
            fat,
            fiber,
            false,
        )?;
        conn.execute(
            "UPDATE meal_items SET food_id = ?1, serving_id = ?2, quantity = COALESCE(quantity, 1)
             WHERE id = ?3",
            params![food.id.to_string(), serving.id.to_string(), item_id],
        )?;
        bump_food_usage(conn, food.id)?;
        updated += 1;
    }

    Ok(updated)
}

pub fn get_daily_nutrition(conn: &Connection, date: NaiveDate) -> Result<DailyNutrition> {
    let date_str = date.format("%Y-%m-%d").to_string();

    let mut stmt = conn.prepare(
        "SELECT
            COALESCE(SUM(m.total_calories), 0),
            COALESCE(SUM(m.total_protein_g), 0),
            COALESCE(SUM(m.total_carbs_g), 0),
            COALESCE(SUM(m.total_fat_g), 0),
            COUNT(*)
         FROM activities a
         JOIN meals m ON a.id = m.activity_id
         WHERE date(a.created_at) = ?1"
    )?;

    let (total_cal, total_protein, total_carbs, total_fat, meal_count): (i32, f64, f64, f64, i32) =
        stmt.query_row(params![&date_str], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
        })?;

    Ok(DailyNutrition {
        date: date_str,
        total_calories: total_cal,
        total_protein_g: total_protein,
        total_carbs_g: total_carbs,
        total_fat_g: total_fat,
        meal_count,
        meals: Vec::new(), // Could populate if needed
    })
}

// ============================================================================
// Workout queries
// ============================================================================

pub fn insert_workout(conn: &Connection, workout: &Workout) -> Result<()> {
    conn.execute(
        "INSERT INTO workouts (activity_id, workout_type, duration_min, energy_before,
         energy_after, location)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            workout.activity_id.to_string(),
            workout.workout_type.to_string(),
            workout.duration_min,
            workout.energy_before,
            workout.energy_after,
            workout.location,
        ],
    )?;

    // Insert exercises and sets
    for exercise in &workout.exercises {
        insert_exercise(conn, exercise)?;
    }

    Ok(())
}

pub fn insert_exercise(conn: &Connection, exercise: &Exercise) -> Result<()> {
    conn.execute(
        "INSERT INTO exercises (id, workout_id, exercise_name, exercise_order, notes)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            exercise.id.to_string(),
            exercise.workout_id.to_string(),
            exercise.exercise_name,
            exercise.exercise_order,
            exercise.notes,
        ],
    )?;

    for set in &exercise.sets {
        insert_exercise_set(conn, set)?;
    }

    Ok(())
}

pub fn insert_exercise_set(conn: &Connection, set: &ExerciseSet) -> Result<()> {
    conn.execute(
        "INSERT INTO exercise_sets (id, exercise_id, set_number, reps, weight_lbs,
         duration_sec, rest_after_sec, rpe, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            set.id.to_string(),
            set.exercise_id.to_string(),
            set.set_number,
            set.reps,
            set.weight_lbs,
            set.duration_sec,
            set.rest_after_sec,
            set.rpe,
            set.notes,
        ],
    )?;
    Ok(())
}

// ============================================================================
// Task queries
// ============================================================================

pub fn insert_task(conn: &Connection, task: &Task) -> Result<()> {
    conn.execute(
        "INSERT INTO tasks (activity_id, priority, due_date, completed_at, category, related_goal)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            task.activity_id.to_string(),
            task.priority.to_string(),
            task.due_date.map(|d| d.format("%Y-%m-%d").to_string()),
            task.completed_at.map(|d| d.to_rfc3339()),
            task.category,
            task.related_goal,
        ],
    )?;
    Ok(())
}

pub fn list_pending_tasks(conn: &Connection) -> Result<Vec<TaskWithActivity>> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.title, a.notes, a.status, t.priority, t.due_date,
                t.category, t.related_goal, a.created_at, t.completed_at
         FROM activities a
         JOIN tasks t ON a.id = t.activity_id
         WHERE a.status IN ('planned', 'in_progress')
         ORDER BY
            CASE t.priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
            END,
            t.due_date"
    )?;

    let tasks: Vec<TaskWithActivity> = stmt
        .query_map([], |row| {
            Ok(TaskWithActivity {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
                title: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                notes: row.get(2)?,
                status: row.get(3)?,
                priority: row.get::<_, String>(4)?.parse().unwrap_or(TaskPriority::Medium),
                due_date: row.get::<_, Option<String>>(5)?
                    .and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok()),
                category: row.get(6)?,
                related_goal: row.get(7)?,
                tags: Vec::new(),
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                    .unwrap()
                    .with_timezone(&Utc),
                completed_at: row.get::<_, Option<String>>(9)?
                    .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                    .map(|d| d.with_timezone(&Utc)),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(tasks)
}

pub fn complete_task(conn: &Connection, activity_id: Uuid) -> Result<()> {
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE activities SET status = 'done', updated_at = ?1 WHERE id = ?2",
        params![&now, activity_id.to_string()],
    )?;

    conn.execute(
        "UPDATE tasks SET completed_at = ?1 WHERE activity_id = ?2",
        params![&now, activity_id.to_string()],
    )?;

    Ok(())
}

// ============================================================================
// Body metrics queries
// ============================================================================

pub fn insert_body_metrics(conn: &Connection, metrics: &BodyMetrics) -> Result<()> {
    conn.execute(
        "INSERT INTO body_metrics (id, activity_id, recorded_at, weight_lbs, body_fat_pct, waist_in, chest_in, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            metrics.id.to_string(),
            metrics.activity_id.map(|id| id.to_string()),
            metrics.recorded_at.to_rfc3339(),
            metrics.weight_lbs,
            metrics.body_fat_pct,
            metrics.waist_in,
            metrics.chest_in,
            metrics.notes,
        ],
    )?;
    Ok(())
}

pub fn get_latest_weight(conn: &Connection) -> Result<Option<f64>> {
    let weight: Option<f64> = conn.query_row(
        "SELECT weight_lbs FROM body_metrics
         WHERE weight_lbs IS NOT NULL
         ORDER BY recorded_at DESC LIMIT 1",
        [],
        |row| row.get(0),
    ).optional()?;

    Ok(weight)
}

// ============================================================================
// Check-in queries
// ============================================================================

pub fn insert_checkin(conn: &Connection, checkin: &Checkin) -> Result<()> {
    conn.execute(
        "INSERT INTO checkins (activity_id, checkin_type, mood, energy, sleep_hours,
         sleep_quality, stress, hydration_oz)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            checkin.activity_id.to_string(),
            checkin.checkin_type.to_string(),
            checkin.mood,
            checkin.energy,
            checkin.sleep_hours,
            checkin.sleep_quality,
            checkin.stress,
            checkin.hydration_oz,
        ],
    )?;
    Ok(())
}

// Helper trait for optional query results
trait OptionalExt<T> {
    fn optional(self) -> Result<Option<T>>;
}

impl<T> OptionalExt<T> for Result<T, rusqlite::Error> {
    fn optional(self) -> Result<Option<T>> {
        match self {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }
}
