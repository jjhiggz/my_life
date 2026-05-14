//! Shared SQLite schema + migrations for higgzlife.
//!
//! Both the Tauri app (`app/src-tauri`) and the MCP server (`tools/mcp-server`)
//! depend on this crate. Each calls [`open_and_migrate`] on startup so the
//! on-disk schema is always at the current version regardless of which process
//! ran first.
//!
//! Schema version is tracked via SQLite's built-in `PRAGMA user_version`.
//! Migrations are forward-only and append-only — once a version has shipped,
//! never edit it; write a new one.

use anyhow::{Context, Result};
use rusqlite::Connection;
use std::path::Path;

struct Migration {
    version: i32,
    name: &'static str,
    /// Optional Rust pre-step for things SQL can't do idempotently
    /// (e.g. conditional `ALTER TABLE ADD COLUMN`).
    pre: Option<fn(&Connection) -> Result<()>>,
    /// Idempotent SQL applied after `pre`. Safe to re-run on partially-
    /// upgraded DBs because every statement uses `IF NOT EXISTS`.
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "initial",
        pre: Some(m001_add_meal_items_food_columns),
        sql: include_str!("migrations/001_initial.sql"),
    },
    Migration {
        version: 2,
        name: "backfill_foods",
        pre: None,
        sql: include_str!("migrations/002_backfill_foods.sql"),
    },
    Migration {
        version: 3,
        name: "workout_schema",
        pre: Some(m003_add_columns),
        sql: include_str!("migrations/003_workout_schema.sql"),
    },
    Migration {
        version: 4,
        name: "weight_log_activities",
        pre: Some(m004_add_body_activity_id),
        sql: include_str!("migrations/004_weight_log_activities.sql"),
    },
    Migration {
        version: 5,
        name: "calendar_events",
        pre: None,
        sql: include_str!("migrations/005_calendar_events.sql"),
    },
    Migration {
        version: 6,
        name: "calendar_recurrence",
        pre: Some(m006_add_calendar_recurrence_columns),
        sql: include_str!("migrations/006_calendar_recurrence.sql"),
    },
];

/// Open the SQLite DB at `path`, applying any pending migrations, and
/// return the connection. Creates the file if it doesn't exist.
pub fn open_and_migrate(path: impl AsRef<Path>) -> Result<Connection> {
    let mut conn = Connection::open(path.as_ref())
        .with_context(|| format!("opening {}", path.as_ref().display()))?;
    migrate(&mut conn)?;
    Ok(conn)
}

/// Apply any pending migrations to an already-open connection. Use this for
/// in-memory test DBs or any case where you opened the connection yourself.
pub fn migrate(conn: &mut Connection) -> Result<()> {
    let current: i32 = conn
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .context("reading user_version")?;

    for m in MIGRATIONS {
        if m.version <= current {
            continue;
        }
        let tx = conn.transaction()?;
        if let Some(pre) = m.pre {
            pre(&tx).with_context(|| format!("pre-step of migration {}", m.version))?;
        }
        tx.execute_batch(m.sql)
            .with_context(|| format!("SQL of migration {}", m.version))?;
        // pragma_update with a bound param fails on user_version (it's a
        // pragma, not a normal statement), so format the int directly. Safe:
        // values come from the const MIGRATIONS table, not user input.
        tx.execute_batch(&format!("PRAGMA user_version = {}", m.version))?;
        tx.commit()?;
        eprintln!("higgzlife-db: applied migration {} ({})", m.version, m.name);
    }
    Ok(())
}

/// `CREATE TABLE IF NOT EXISTS` is a no-op when the table already exists,
/// so a pre-existing `meal_items` table won't gain new columns from the
/// schema file. Add them conditionally here instead. No-op if already present.
fn m001_add_meal_items_food_columns(conn: &Connection) -> Result<()> {
    // Only run if meal_items exists at all — fresh installs skip this entirely
    // (the schema file below will create the table with the new columns).
    let table_exists: bool = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='meal_items'",
            [],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if !table_exists {
        return Ok(());
    }

    let mut stmt = conn.prepare("PRAGMA table_info(meal_items)")?;
    let cols: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();
    let has = |name: &str| cols.iter().any(|c| c == name);

    if !has("food_id") {
        conn.execute(
            "ALTER TABLE meal_items ADD COLUMN food_id TEXT REFERENCES foods(id)",
            [],
        )?;
    }
    if !has("serving_id") {
        conn.execute(
            "ALTER TABLE meal_items ADD COLUMN serving_id TEXT REFERENCES servings(id)",
            [],
        )?;
    }
    if !has("quantity") {
        conn.execute(
            "ALTER TABLE meal_items ADD COLUMN quantity REAL DEFAULT 1",
            [],
        )?;
    }
    Ok(())
}

fn m006_add_calendar_recurrence_columns(conn: &Connection) -> Result<()> {
    let table_exists: bool = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='calendar_events'",
            [],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if !table_exists {
        return Ok(());
    }

    let mut stmt = conn.prepare("PRAGMA table_info(calendar_events)")?;
    let cols: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();
    let has = |name: &str| cols.iter().any(|c| c == name);

    if !has("recurrence_rule") {
        conn.execute(
            "ALTER TABLE calendar_events ADD COLUMN recurrence_rule TEXT",
            [],
        )?;
    }
    if !has("recurrence_until") {
        conn.execute(
            "ALTER TABLE calendar_events ADD COLUMN recurrence_until TEXT",
            [],
        )?;
    }
    Ok(())
}

/// Idempotently add a column to a table. No-op if the column already exists
/// or the table doesn't exist yet.
fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    column_def: &str,
) -> Result<()> {
    let table_exists: bool = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?1",
            [table],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if !table_exists {
        return Ok(());
    }

    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let cols: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();
    if cols.iter().any(|c| c == column) {
        return Ok(());
    }

    conn.execute(
        &format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, column_def),
        [],
    )?;
    Ok(())
}

/// Schema additions for workouts/exercises/sets. Runs before migration 003's
/// SQL so the index on `exercises(exercise_lib_id)` can be created against the
/// newly-added column.
fn m003_add_columns(conn: &Connection) -> Result<()> {
    add_column_if_missing(conn, "workouts", "kind", "TEXT")?;
    add_column_if_missing(conn, "workouts", "modality", "TEXT")?;
    add_column_if_missing(conn, "workouts", "distance_m", "REAL")?;
    add_column_if_missing(conn, "workouts", "elevation_m", "REAL")?;
    add_column_if_missing(conn, "workouts", "avg_hr", "INTEGER")?;
    add_column_if_missing(
        conn,
        "exercises",
        "exercise_lib_id",
        "TEXT REFERENCES exercise_library(id)",
    )?;
    add_column_if_missing(
        conn,
        "exercises",
        "kind",
        "TEXT NOT NULL DEFAULT 'strength'",
    )?;
    add_column_if_missing(conn, "exercise_sets", "distance_m", "REAL")?;
    Ok(())
}

fn m004_add_body_activity_id(conn: &Connection) -> Result<()> {
    add_column_if_missing(
        conn,
        "body_metrics",
        "activity_id",
        "TEXT REFERENCES activities(id) ON DELETE SET NULL",
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_version(conn: &Connection) -> i32 {
        conn.pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn fresh_db_runs_all_migrations() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        // user_version equals the highest migration version.
        let latest = MIGRATIONS.last().unwrap().version;
        assert_eq!(user_version(&conn), latest);

        // Spot-check the schema landed.
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('foods', 'servings', 'meal_items', 'activities', 'calendar_events')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 5);
    }

    #[test]
    fn migrate_is_idempotent() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        let v1 = user_version(&conn);
        migrate(&mut conn).unwrap();
        assert_eq!(user_version(&conn), v1);
    }

    #[test]
    fn m002_backfills_foods_from_legacy_meal_items() {
        let mut conn = Connection::open_in_memory().unwrap();
        // Run all migrations to set up schema.
        migrate(&mut conn).unwrap();

        // Insert a legacy-style activity + meal + meal_items (no food_id).
        conn.execute_batch(
            "INSERT INTO activities (id, activity_type, status, created_at, updated_at) VALUES ('a1', 'meal', 'done', '2026-05-12T10:00:00', '2026-05-12T10:00:00');
             INSERT INTO meals (activity_id, meal_type) VALUES ('a1', 'breakfast');
             INSERT INTO meal_items (id, meal_id, food_name, serving_size, calories, protein_g)
                 VALUES ('i1', 'a1', 'Oatmeal', '1 packet', 220, 4);
             INSERT INTO meal_items (id, meal_id, food_name, serving_size, calories, protein_g)
                 VALUES ('i2', 'a1', 'Oatmeal', '1 packet', 220, 4);
             INSERT INTO meal_items (id, meal_id, food_name, serving_size, calories, protein_g)
                 VALUES ('i3', 'a1', 'Banana', NULL, 105, 1);",
        )
        .unwrap();

        // Roll user_version back to 1 so migrate() re-runs migration 002.
        conn.execute_batch("PRAGMA user_version = 1").unwrap();
        migrate(&mut conn).unwrap();

        // After re-running migrate, user_version is back at the latest.
        let latest = MIGRATIONS.last().unwrap().version;
        assert_eq!(user_version(&conn), latest);

        // Two distinct foods backfilled: oatmeal (use_count=2) and banana (use_count=1).
        let oatmeal_count: i32 = conn
            .query_row(
                "SELECT use_count FROM foods WHERE name = 'oatmeal'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(oatmeal_count, 2);

        // meal_items rows are linked to the food and serving.
        let linked: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM meal_items WHERE food_id IS NOT NULL",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(linked, 3);

        // Banana's null serving_size collapses to '1 serving'.
        let banana_serving: String = conn
            .query_row(
                "SELECT s.label FROM servings s JOIN foods f ON f.id = s.food_id WHERE f.name = 'banana'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(banana_serving, "1 serving");
    }

    #[test]
    fn m003_lands_workout_schema_changes() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        let latest = MIGRATIONS.last().unwrap().version;
        assert_eq!(user_version(&conn), latest);

        // exercise_library exists.
        let lib_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='exercise_library'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(lib_exists, 1);

        // New columns on workouts.
        let workout_cols: Vec<String> = conn
            .prepare("PRAGMA table_info(workouts)")
            .unwrap()
            .query_map([], |r| r.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        for col in ["kind", "modality", "distance_m", "elevation_m", "avg_hr"] {
            assert!(
                workout_cols.iter().any(|c| c == col),
                "workouts.{} missing",
                col
            );
        }

        // New columns on exercises.
        let exercise_cols: Vec<String> = conn
            .prepare("PRAGMA table_info(exercises)")
            .unwrap()
            .query_map([], |r| r.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert!(exercise_cols.iter().any(|c| c == "exercise_lib_id"));
        assert!(exercise_cols.iter().any(|c| c == "kind"));

        // distance_m on exercise_sets.
        let set_cols: Vec<String> = conn
            .prepare("PRAGMA table_info(exercise_sets)")
            .unwrap()
            .query_map([], |r| r.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert!(set_cols.iter().any(|c| c == "distance_m"));
    }

    #[test]
    fn upgrades_legacy_meal_items_table() {
        let mut conn = Connection::open_in_memory().unwrap();
        // Simulate a pre-foods-era DB: meal_items without food_id/serving_id/quantity,
        // but with the same column shape the schema had in that era (fiber_g + notes).
        conn.execute_batch(
            "CREATE TABLE meal_items (
                id TEXT PRIMARY KEY,
                meal_id TEXT NOT NULL,
                food_name TEXT NOT NULL,
                serving_size TEXT,
                calories INTEGER,
                protein_g REAL,
                carbs_g REAL,
                fat_g REAL,
                fiber_g REAL,
                notes TEXT
            );
            INSERT INTO meal_items (id, meal_id, food_name, calories) VALUES ('a', 'm', 'Toast', 100);",
        )
        .unwrap();

        migrate(&mut conn).unwrap();

        // Row preserved.
        let cal: i32 = conn
            .query_row("SELECT calories FROM meal_items WHERE id = 'a'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(cal, 100);

        // New columns present.
        let quantity: f64 = conn
            .query_row("SELECT quantity FROM meal_items WHERE id = 'a'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(quantity, 1.0);
    }
}
