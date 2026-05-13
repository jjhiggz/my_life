-- HiggzLife Database Schema
-- Normalized relational design with base activity table and type-specific child tables

-- ============================================================================
-- CORE: Activities (base table for all trackable events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,                    -- UUID
    activity_type TEXT NOT NULL,            -- 'workout', 'meal', 'task', 'checkin', 'garden', etc.
    created_at TEXT NOT NULL,               -- ISO8601 timestamp
    updated_at TEXT NOT NULL,               -- ISO8601 timestamp
    status TEXT NOT NULL DEFAULT 'done',    -- 'planned', 'in_progress', 'done', 'skipped'
    title TEXT,                             -- Optional title/summary
    notes TEXT,                             -- Free-form notes

    -- Indexes for common queries
    CHECK (status IN ('planned', 'in_progress', 'done', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);

-- Tags for activities (many-to-many)
CREATE TABLE IF NOT EXISTS activity_tags (
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (activity_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_tags_tag ON activity_tags(tag);

-- ============================================================================
-- WORKOUTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workouts (
    activity_id TEXT PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
    workout_type TEXT NOT NULL,             -- 'strength', 'cardio', 'yoga', 'swimming', etc.
    duration_min INTEGER,
    energy_before INTEGER,                  -- 1-10
    energy_after INTEGER,                   -- 1-10
    location TEXT                           -- 'home', 'gym', 'pool', 'outdoor'
);

-- Individual exercises within a workout
CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY,
    workout_id TEXT NOT NULL REFERENCES workouts(activity_id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    exercise_order INTEGER NOT NULL,        -- Order within the workout
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_exercises_workout ON exercises(workout_id);

-- Individual sets within an exercise
CREATE TABLE IF NOT EXISTS exercise_sets (
    id TEXT PRIMARY KEY,
    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    reps INTEGER,
    weight_lbs REAL,
    duration_sec INTEGER,                   -- For timed exercises (planks, etc.)
    rest_after_sec INTEGER,
    rpe INTEGER,                            -- Rate of Perceived Exertion 1-10
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sets_exercise ON exercise_sets(exercise_id);

-- ============================================================================
-- MEALS
-- ============================================================================
CREATE TABLE IF NOT EXISTS meals (
    activity_id TEXT PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
    meal_type TEXT NOT NULL,                -- 'breakfast', 'lunch', 'dinner', 'snack'
    total_calories INTEGER,
    total_protein_g REAL,
    total_carbs_g REAL,
    total_fat_g REAL,
    total_fiber_g REAL
);

-- Individual food items within a meal
-- Legacy fields (food_name, serving_size, calories, etc.) remain for
-- backwards compatibility with older logs. New entries link to a food + serving
-- via food_id/serving_id with a quantity multiplier.
CREATE TABLE IF NOT EXISTS meal_items (
    id TEXT PRIMARY KEY,
    meal_id TEXT NOT NULL REFERENCES meals(activity_id) ON DELETE CASCADE,
    food_name TEXT NOT NULL,
    serving_size TEXT,
    calories INTEGER,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    fiber_g REAL,
    notes TEXT,
    food_id TEXT REFERENCES foods(id),
    serving_id TEXT REFERENCES servings(id),
    quantity REAL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_meal_items_meal ON meal_items(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_items_food ON meal_items(food_id);

-- ============================================================================
-- FOODS (personal food database — grows organically as user logs meals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS foods (
    id TEXT PRIMARY KEY,                    -- UUID
    name TEXT NOT NULL UNIQUE,              -- canonical food name (lowercase normalized)
    display_name TEXT NOT NULL,             -- user-facing capitalization
    default_serving_id TEXT REFERENCES servings(id) ON DELETE SET NULL,
    last_used_at TEXT,                      -- ISO8601 timestamp
    use_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);
CREATE INDEX IF NOT EXISTS idx_foods_last_used ON foods(last_used_at);
CREATE INDEX IF NOT EXISTS idx_foods_use_count ON foods(use_count);

-- Servings = unit options for each food (100g, 1 cup, 1 medium, etc.)
-- Each serving stores pre-computed nutrition; quantity multiplier scales it.
CREATE TABLE IF NOT EXISTS servings (
    id TEXT PRIMARY KEY,                    -- UUID
    food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    label TEXT NOT NULL,                    -- "100g", "1 cup cooked", "1 medium"
    grams REAL,                             -- optional, for future cross-unit math
    calories REAL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    fiber_g REAL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE (food_id, label)
);

CREATE INDEX IF NOT EXISTS idx_servings_food ON servings(food_id);

-- Saved meals = reusable bundles of foods you eat often
CREATE TABLE IF NOT EXISTS meal_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    use_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_meal_templates_last_used ON meal_templates(last_used_at);

CREATE TABLE IF NOT EXISTS meal_template_items (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES meal_templates(id) ON DELETE CASCADE,
    food_id TEXT NOT NULL REFERENCES foods(id),
    serving_id TEXT REFERENCES servings(id),
    quantity REAL NOT NULL DEFAULT 1,
    item_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_template_items_template ON meal_template_items(template_id);

-- ============================================================================
-- TASKS (one-off and recurring)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
    activity_id TEXT PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
    priority TEXT NOT NULL DEFAULT 'medium', -- 'urgent', 'high', 'medium', 'low'
    due_date TEXT,                          -- ISO8601 date
    completed_at TEXT,                      -- ISO8601 timestamp
    category TEXT,                          -- 'errand', 'home', 'work', 'garden', etc.
    related_goal TEXT,                      -- Link to a goal like 'triathlon', 'dad-prep'

    CHECK (priority IN ('urgent', 'high', 'medium', 'low'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);

-- ============================================================================
-- CHECK-INS (mood, energy, daily status)
-- ============================================================================
CREATE TABLE IF NOT EXISTS checkins (
    activity_id TEXT PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
    checkin_type TEXT NOT NULL,             -- 'morning', 'evening', 'random'
    mood INTEGER,                           -- 1-10
    energy INTEGER,                         -- 1-10
    sleep_hours REAL,
    sleep_quality INTEGER,                  -- 1-10
    stress INTEGER,                         -- 1-10
    hydration_oz INTEGER
);

-- ============================================================================
-- GARDEN
-- ============================================================================
CREATE TABLE IF NOT EXISTS garden_activities (
    activity_id TEXT PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,              -- 'plant', 'water', 'harvest', 'observe', 'weed', 'fertilize'
    location TEXT,                          -- 'raised bed', 'tilling area', 'porch', etc.
    duration_min INTEGER
);

-- Plants involved in a garden activity
CREATE TABLE IF NOT EXISTS garden_activity_plants (
    id TEXT PRIMARY KEY,
    garden_activity_id TEXT NOT NULL REFERENCES garden_activities(activity_id) ON DELETE CASCADE,
    plant_name TEXT NOT NULL,
    quantity INTEGER,
    observation TEXT                        -- "looking healthy", "yellowing leaves", etc.
);

CREATE INDEX IF NOT EXISTS idx_garden_plants_activity ON garden_activity_plants(garden_activity_id);

-- ============================================================================
-- QUIZ HISTORY (for gardening quizzes, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT PRIMARY KEY,
    activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
    quiz_type TEXT NOT NULL,                -- 'gardening', 'nutrition', etc.
    question TEXT NOT NULL,
    user_answer TEXT,
    correct_answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL,            -- 0 or 1
    topic TEXT,                             -- 'seed starting', 'companion planting', etc.
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_type ON quiz_attempts(quiz_type);
CREATE INDEX IF NOT EXISTS idx_quiz_topic ON quiz_attempts(topic);
CREATE INDEX IF NOT EXISTS idx_quiz_correct ON quiz_attempts(is_correct);

-- ============================================================================
-- GOALS (long-term objectives)
-- ============================================================================
CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,                 -- 'fitness', 'health', 'skills', 'life'
    target_date TEXT,                       -- ISO8601 date
    status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'completed', 'abandoned'
    created_at TEXT NOT NULL,
    completed_at TEXT,

    CHECK (status IN ('active', 'completed', 'abandoned'))
);

-- Milestones for goals
CREATE TABLE IF NOT EXISTS goal_milestones (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    target_value REAL,
    current_value REAL,
    unit TEXT,                              -- 'lbs', 'miles', 'reps', etc.
    is_complete INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_milestones_goal ON goal_milestones(goal_id);

-- ============================================================================
-- BODY METRICS (weight, measurements over time)
-- ============================================================================
CREATE TABLE IF NOT EXISTS body_metrics (
    id TEXT PRIMARY KEY,
    recorded_at TEXT NOT NULL,
    weight_lbs REAL,
    body_fat_pct REAL,
    waist_in REAL,
    chest_in REAL,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_body_recorded ON body_metrics(recorded_at);

-- ============================================================================
-- VIEWS for common queries
-- ============================================================================

-- Today's activities
CREATE VIEW IF NOT EXISTS v_today AS
SELECT * FROM activities
WHERE date(created_at) = date('now', 'localtime');

-- This week's activities
CREATE VIEW IF NOT EXISTS v_this_week AS
SELECT * FROM activities
WHERE created_at >= date('now', 'localtime', 'weekday 0', '-7 days');

-- Pending tasks
CREATE VIEW IF NOT EXISTS v_pending_tasks AS
SELECT a.*, t.*
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
    t.due_date;

-- Daily nutrition summary
CREATE VIEW IF NOT EXISTS v_daily_nutrition AS
SELECT
    date(a.created_at) as date,
    SUM(m.total_calories) as total_calories,
    SUM(m.total_protein_g) as total_protein_g,
    SUM(m.total_carbs_g) as total_carbs_g,
    SUM(m.total_fat_g) as total_fat_g,
    COUNT(*) as meal_count
FROM activities a
JOIN meals m ON a.id = m.activity_id
GROUP BY date(a.created_at);

-- Weekly workout summary
CREATE VIEW IF NOT EXISTS v_weekly_workouts AS
SELECT
    strftime('%Y-W%W', a.created_at) as week,
    COUNT(*) as workout_count,
    SUM(w.duration_min) as total_duration_min,
    AVG(w.energy_after - w.energy_before) as avg_energy_change
FROM activities a
JOIN workouts w ON a.id = w.activity_id
WHERE a.status = 'done'
GROUP BY strftime('%Y-W%W', a.created_at);
