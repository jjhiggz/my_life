-- Migration 003: rework workout storage.
--
-- Changes:
--   1. Add `exercise_library` — canonical strength exercises (mirror of `foods`).
--   2. Add a `kind` discriminator to `workouts` so one table covers strength,
--      cardio, mobility, sport, and mixed workouts.
--   3. Add cardio fields on `workouts` (modality, distance_m, elevation_m, avg_hr)
--      so steady-state cardio is a single row with no exercise sub-hierarchy.
--   4. Add `exercise_lib_id` + `kind` to `exercises` so each exercise/segment
--      points at a library entry and declares whether it's strength/timed/distance.
--   5. Add `distance_m` to `exercise_sets` so cardio interval segments fit the
--      "every atom of effort is a set" invariant.
--
-- All ALTERs are additive on currently-empty tables, so this is safe to apply
-- against the live DB.

-- ============================================================================
-- Exercise library (canonical movements / segment types)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exercise_library (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,                  -- normalized: lowercase, dashed
    display_name TEXT NOT NULL,                 -- "Dumbbell Row"
    muscle_group TEXT,                          -- "back", "legs", "core", etc.
    equipment TEXT,                             -- "dumbbell", "bodyweight", "barbell"
    default_kind TEXT NOT NULL DEFAULT 'strength',
    last_used_at TEXT,
    use_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    notes TEXT,
    CHECK (default_kind IN ('strength', 'timed', 'distance'))
);

CREATE INDEX IF NOT EXISTS idx_exercise_library_name ON exercise_library(name);
CREATE INDEX IF NOT EXISTS idx_exercise_library_last_used ON exercise_library(last_used_at);
CREATE INDEX IF NOT EXISTS idx_exercise_library_use_count ON exercise_library(use_count);

-- The ALTER TABLE ADD COLUMN statements for workouts, exercises, and
-- exercise_sets are handled idempotently in the Rust pre-step
-- (m003_add_columns in lib.rs) so this migration is safe to re-run.

CREATE INDEX IF NOT EXISTS idx_exercises_lib ON exercises(exercise_lib_id);
