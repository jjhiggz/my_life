//! One-shot import: walk a directory of daily YAML logs and project each
//! `workout:` block into the workouts / exercises / exercise_sets schema.
//!
//! Idempotent: each daily file becomes a single activity with a deterministic
//! id (`yaml-{date}-workout`). Re-running deletes the old activity (cascading
//! to its workouts/exercises/sets rows) and re-inserts. exercise_library
//! entries accrue and are never deleted.
//!
//! Usage:
//!     cargo run --example import_workouts -- ~/Projects/higgzlife/logs/daily

use anyhow::{Context, Result};
use rusqlite::params;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
struct DailyLog {
    #[serde(default)]
    date: Option<String>,
    workout: Option<WorkoutBlock>,
}

#[derive(Debug, Deserialize)]
struct WorkoutBlock {
    #[serde(rename = "type", default)]
    workout_type: Option<String>,
    #[serde(default)]
    focus: Option<String>,
    #[serde(default)]
    duration_min: Option<serde_yaml::Value>, // can be `~30` (string) or int
    #[serde(default)]
    notes: Option<String>,
    #[serde(default)]
    exercises: Vec<ExerciseBlock>,
    #[serde(default)]
    distance_mi: Option<f64>,
    #[serde(default)]
    distance_km: Option<f64>,
    #[serde(default)]
    elevation_ft: Option<f64>,
    #[serde(default)]
    elevation_m: Option<f64>,
    #[serde(default)]
    avg_hr: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct ExerciseBlock {
    name: String,
    #[serde(default)]
    sets: Option<i64>,
    #[serde(default)]
    reps: Option<Vec<i64>>,
    #[serde(default)]
    duration_sec: Option<Vec<i64>>,
    #[serde(default)]
    weight: Option<String>, // free text like "15lb dumbbell"
    #[serde(default)]
    notes: Option<String>,
}

fn main() -> Result<()> {
    let dir = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .context("usage: import_workouts <logs-dir>")?;

    let db_path = std::env::var("HOME")
        .map(|h| PathBuf::from(h).join(".higgzlife").join("data.db"))
        .context("HOME not set")?;

    let mut conn = higgzlife_db::open_and_migrate(&db_path)?;
    let tx = conn.transaction()?;

    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut total_exercises = 0usize;
    let mut total_sets = 0usize;

    let mut paths: Vec<PathBuf> = fs::read_dir(&dir)
        .with_context(|| format!("read_dir {:?}", dir))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|x| x.to_str()) == Some("yaml"))
        .collect();
    paths.sort();

    for path in &paths {
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
        if stem.starts_with('.') {
            continue; // .example-log etc.
        }
        let content = fs::read_to_string(path)
            .with_context(|| format!("reading {}", path.display()))?;
        let doc: DailyLog = match serde_yaml::from_str(&content) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("  ! skipping {} — parse error: {}", path.display(), e);
                skipped += 1;
                continue;
            }
        };
        let date = doc.date.clone().unwrap_or_else(|| stem.to_string());
        let Some(workout) = doc.workout else {
            continue;
        };

        let (exs, sets) = import_workout(&tx, &date, &workout)?;
        imported += 1;
        total_exercises += exs;
        total_sets += sets;
        eprintln!(
            "  ✓ {} — {} ({} exercises, {} sets)",
            date,
            workout.workout_type.as_deref().unwrap_or("?"),
            exs,
            sets
        );
    }

    tx.commit()?;
    eprintln!(
        "\nDone. Imported {} workout(s) ({} exercises, {} sets), skipped {}.",
        imported, total_exercises, total_sets, skipped
    );
    Ok(())
}

fn import_workout(
    tx: &rusqlite::Transaction,
    date: &str,
    w: &WorkoutBlock,
) -> Result<(usize, usize)> {
    let activity_id = format!("yaml-{}-workout", date);

    // Idempotent: cascade-delete any previous import of this date's workout.
    tx.execute("DELETE FROM activities WHERE id = ?1", [&activity_id])?;

    let created_at = format!("{}T12:00:00", date); // noon as a stable synthetic time
    tx.execute(
        "INSERT INTO activities (id, activity_type, created_at, updated_at, status, title, notes)
         VALUES (?1, 'workout', ?2, ?2, 'done', ?3, ?4)",
        params![
            &activity_id,
            &created_at,
            &w.focus,
            &w.notes,
        ],
    )?;

    let kind = classify_workout_kind(w);
    let modality = if kind == "cardio" {
        w.workout_type.clone()
    } else {
        None
    };
    let distance_m = w
        .distance_km
        .map(|km| km * 1000.0)
        .or_else(|| w.distance_mi.map(|mi| mi * 1609.344));
    let elevation_m = w
        .elevation_m
        .or_else(|| w.elevation_ft.map(|ft| ft * 0.3048));
    let duration_min = parse_duration_min(w.duration_min.as_ref());

    tx.execute(
        "INSERT INTO workouts (activity_id, workout_type, kind, modality,
                               duration_min, distance_m, elevation_m, avg_hr)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            &activity_id,
            w.workout_type.as_deref().unwrap_or("unknown"),
            &kind,
            &modality,
            &duration_min,
            &distance_m,
            &elevation_m,
            &w.avg_hr,
        ],
    )?;

    let mut exercises_imported = 0usize;
    let mut sets_imported = 0usize;
    let mut lib_cache: HashMap<String, String> = HashMap::new();

    for (idx, ex) in w.exercises.iter().enumerate() {
        let kind = classify_exercise_kind(ex);
        let lib_id = upsert_exercise_library(tx, &ex.name, &kind, &mut lib_cache)?;
        let exercise_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO exercises (id, workout_id, exercise_name, exercise_order, notes, exercise_lib_id, kind)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                &exercise_id,
                &activity_id,
                &ex.name,
                idx as i64,
                &ex.notes,
                &lib_id,
                &kind,
            ],
        )?;

        let weight_lbs = ex.weight.as_deref().and_then(parse_weight_lbs);
        let n_sets = if let Some(reps) = &ex.reps {
            insert_strength_sets(tx, &exercise_id, reps, weight_lbs, ex.notes.as_deref())?
        } else if let Some(durs) = &ex.duration_sec {
            insert_timed_sets(tx, &exercise_id, durs)?
        } else if let Some(n) = ex.sets {
            // No rep/duration data — record N empty sets so volume queries see them.
            insert_empty_sets(tx, &exercise_id, n as usize)?
        } else {
            0
        };

        exercises_imported += 1;
        sets_imported += n_sets;
    }

    Ok((exercises_imported, sets_imported))
}

fn classify_workout_kind(w: &WorkoutBlock) -> String {
    let t = w.workout_type.as_deref().unwrap_or("").to_lowercase();
    if t.contains("strength") || t.contains("lift") {
        "strength".into()
    } else if t.contains("yoga") || t.contains("mobility") || t.contains("stretch") {
        "mobility".into()
    } else if t.contains("cardio")
        || t.contains("bike")
        || t.contains("run")
        || t.contains("swim")
        || t.contains("row")
        || t.contains("hike")
    {
        "cardio".into()
    } else if !w.exercises.is_empty() {
        "strength".into() // default for workouts with exercises
    } else {
        "mixed".into()
    }
}

fn classify_exercise_kind(ex: &ExerciseBlock) -> String {
    if ex.duration_sec.is_some() {
        "timed".into()
    } else {
        "strength".into()
    }
}

fn parse_duration_min(v: Option<&serde_yaml::Value>) -> Option<i64> {
    let v = v?;
    match v {
        serde_yaml::Value::Number(n) => n.as_i64().or_else(|| n.as_f64().map(|f| f as i64)),
        serde_yaml::Value::String(s) => {
            let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
            digits.parse().ok()
        }
        _ => None,
    }
}

/// Extract pounds from text like "15lb dumbbell" or "25 lbs".
fn parse_weight_lbs(s: &str) -> Option<f64> {
    let lower = s.to_lowercase();
    let lb_idx = lower.find("lb")?;
    let prefix = &s[..lb_idx];
    let num: String = prefix
        .chars()
        .rev()
        .take_while(|c| c.is_ascii_digit() || *c == '.' || *c == ' ')
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    num.trim().parse().ok()
}

fn upsert_exercise_library(
    tx: &rusqlite::Transaction,
    raw_name: &str,
    kind: &str,
    cache: &mut HashMap<String, String>,
) -> Result<String> {
    let normalized = normalize_name(raw_name);
    if let Some(id) = cache.get(&normalized) {
        // Already touched this run — just bump use_count.
        tx.execute(
            "UPDATE exercise_library SET use_count = use_count + 1, last_used_at = datetime('now') WHERE id = ?1",
            [id],
        )?;
        return Ok(id.clone());
    }

    let existing: Option<String> = tx
        .query_row(
            "SELECT id FROM exercise_library WHERE name = ?1",
            [&normalized],
            |r| r.get(0),
        )
        .ok();

    let id = if let Some(id) = existing {
        tx.execute(
            "UPDATE exercise_library SET use_count = use_count + 1, last_used_at = datetime('now') WHERE id = ?1",
            [&id],
        )?;
        id
    } else {
        let id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO exercise_library (id, name, display_name, default_kind,
                                            use_count, last_used_at, created_at)
             VALUES (?1, ?2, ?3, ?4, 1, datetime('now'), datetime('now'))",
            params![&id, &normalized, raw_name, kind],
        )?;
        id
    };
    cache.insert(normalized, id.clone());
    Ok(id)
}

fn normalize_name(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn insert_strength_sets(
    tx: &rusqlite::Transaction,
    exercise_id: &str,
    reps: &[i64],
    weight_lbs: Option<f64>,
    notes: Option<&str>,
) -> Result<usize> {
    for (i, r) in reps.iter().enumerate() {
        let id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO exercise_sets (id, exercise_id, set_number, reps, weight_lbs, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&id, exercise_id, (i + 1) as i64, r, &weight_lbs, &notes],
        )?;
    }
    Ok(reps.len())
}

fn insert_timed_sets(
    tx: &rusqlite::Transaction,
    exercise_id: &str,
    durations: &[i64],
) -> Result<usize> {
    for (i, d) in durations.iter().enumerate() {
        let id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO exercise_sets (id, exercise_id, set_number, duration_sec)
             VALUES (?1, ?2, ?3, ?4)",
            params![&id, exercise_id, (i + 1) as i64, d],
        )?;
    }
    Ok(durations.len())
}

fn insert_empty_sets(
    tx: &rusqlite::Transaction,
    exercise_id: &str,
    n: usize,
) -> Result<usize> {
    for i in 0..n {
        let id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO exercise_sets (id, exercise_id, set_number)
             VALUES (?1, ?2, ?3)",
            params![&id, exercise_id, (i + 1) as i64],
        )?;
    }
    Ok(n)
}

#[allow(dead_code)]
fn _silence_unused_warning(_: &Path) {}
