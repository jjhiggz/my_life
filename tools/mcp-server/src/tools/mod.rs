use anyhow::Result;
use chrono::{Local, NaiveDate, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::queries;
use crate::db::Database;
use crate::models::*;

/// The HiggzLife MCP server tools
#[derive(Clone)]
pub struct HiggzLife {
    db: Database,
}

impl HiggzLife {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    // ========================================================================
    // Meal tools
    // ========================================================================

    /// Log a meal with food items
    pub fn log_meal(&self, params: LogMealParams) -> Result<Uuid> {
        let activity =
            Activity::new(ActivityType::Meal).with_notes(params.notes.unwrap_or_default());

        let mut meal = Meal {
            activity_id: activity.id,
            meal_type: params.meal_type,
            total_calories: None,
            total_protein_g: None,
            total_carbs_g: None,
            total_fat_g: None,
            total_fiber_g: None,
            items: params
                .items
                .into_iter()
                .map(|i| MealItem {
                    id: Uuid::new_v4(),
                    meal_id: activity.id,
                    food_name: i.food_name,
                    serving_size: i.serving_size,
                    calories: i.calories,
                    protein_g: i.protein_g,
                    carbs_g: i.carbs_g,
                    fat_g: i.fat_g,
                    fiber_g: None,
                    notes: None,
                    food_id: None,
                    serving_id: None,
                    quantity: None,
                })
                .collect(),
        };

        meal.calculate_totals();

        self.db.with_conn(|conn| {
            queries::insert_activity(conn, &activity)?;
            queries::insert_meal(conn, &meal)?;
            Ok(activity.id)
        })
    }

    /// Get today's nutrition summary
    pub fn get_today_nutrition(&self) -> Result<DailyNutrition> {
        let today = Local::now().date_naive();
        self.db
            .with_conn(|conn| queries::get_daily_nutrition(conn, today))
    }

    // ========================================================================
    // Workout tools
    // ========================================================================

    /// Log a workout with exercises
    pub fn log_workout(&self, params: LogWorkoutParams) -> Result<Uuid> {
        let activity = Activity::new(ActivityType::Workout)
            .with_title(format!("{} workout", params.workout_type))
            .with_notes(params.notes.unwrap_or_default());

        let workout = Workout {
            activity_id: activity.id,
            workout_type: params.workout_type,
            duration_min: params.duration_min,
            energy_before: params.energy_before,
            energy_after: params.energy_after,
            location: params.location,
            exercises: params
                .exercises
                .into_iter()
                .enumerate()
                .map(|(i, e)| {
                    let exercise_id = Uuid::new_v4();
                    Exercise {
                        id: exercise_id,
                        workout_id: activity.id,
                        exercise_name: e.exercise_name,
                        exercise_order: i as i32,
                        notes: e.notes,
                        sets: e
                            .sets
                            .into_iter()
                            .enumerate()
                            .map(|(j, s)| ExerciseSet {
                                id: Uuid::new_v4(),
                                exercise_id,
                                set_number: j as i32 + 1,
                                reps: s.reps,
                                weight_lbs: s.weight_lbs,
                                duration_sec: s.duration_sec,
                                rest_after_sec: None,
                                rpe: None,
                                notes: None,
                            })
                            .collect(),
                    }
                })
                .collect(),
        };

        self.db.with_conn(|conn| {
            queries::insert_activity(conn, &activity)?;
            queries::insert_workout(conn, &workout)?;
            Ok(activity.id)
        })
    }

    // ========================================================================
    // Task tools
    // ========================================================================

    /// Create a new task
    pub fn create_task(&self, params: CreateTaskParams) -> Result<Uuid> {
        let activity = Activity::new(ActivityType::Task)
            .with_title(&params.title)
            .with_notes(params.notes.unwrap_or_default())
            .with_status(ActivityStatus::Planned)
            .with_tags(params.tags);

        let task = Task {
            activity_id: activity.id,
            priority: params.priority.unwrap_or(TaskPriority::Medium),
            due_date: params
                .due_date
                .and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok()),
            completed_at: None,
            category: params.category,
            related_goal: params.related_goal,
        };

        self.db.with_conn(|conn| {
            queries::insert_activity(conn, &activity)?;
            queries::insert_task(conn, &task)?;
            Ok(activity.id)
        })
    }

    /// List pending tasks
    pub fn list_tasks(&self) -> Result<Vec<TaskWithActivity>> {
        self.db.with_conn(|conn| queries::list_pending_tasks(conn))
    }

    /// Complete a task
    pub fn complete_task(&self, task_id: Uuid) -> Result<()> {
        self.db
            .with_conn(|conn| queries::complete_task(conn, task_id))
    }

    // ========================================================================
    // Check-in tools
    // ========================================================================

    /// Log a mood/energy check-in
    pub fn log_checkin(&self, params: LogCheckinParams) -> Result<Uuid> {
        let activity =
            Activity::new(ActivityType::Checkin).with_notes(params.notes.unwrap_or_default());

        let checkin = Checkin {
            activity_id: activity.id,
            checkin_type: params.checkin_type.unwrap_or(CheckinType::Random),
            mood: params.mood,
            energy: params.energy,
            sleep_hours: params.sleep_hours,
            sleep_quality: params.sleep_quality,
            stress: params.stress,
            hydration_oz: params.hydration_oz,
        };

        self.db.with_conn(|conn| {
            queries::insert_activity(conn, &activity)?;
            queries::insert_checkin(conn, &checkin)?;
            Ok(activity.id)
        })
    }

    // ========================================================================
    // Body metrics tools
    // ========================================================================

    /// Log body measurements
    pub fn log_weight(&self, params: LogBodyMetricsParams) -> Result<Uuid> {
        let metrics = BodyMetrics {
            id: Uuid::new_v4(),
            activity_id: None,
            recorded_at: Utc::now(),
            weight_lbs: params.weight_lbs,
            body_fat_pct: params.body_fat_pct,
            waist_in: params.waist_in,
            chest_in: params.chest_in,
            notes: params.notes,
        };

        self.db.with_conn(|conn| {
            queries::insert_body_metrics(conn, &metrics)?;
            Ok(metrics.id)
        })
    }

    /// Get current weight
    pub fn get_weight(&self) -> Result<Option<f64>> {
        self.db.with_conn(|conn| queries::get_latest_weight(conn))
    }

    // ========================================================================
    // Summary tools
    // ========================================================================

    /// Get today's activities
    pub fn get_today(&self) -> Result<Vec<ActivitySummary>> {
        self.db
            .with_conn(|conn| queries::list_activities_today(conn))
    }
}

// ============================================================================
// Parameter types for tools
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct LogWorkoutParams {
    pub workout_type: WorkoutType,
    #[serde(default)]
    pub duration_min: Option<i32>,
    #[serde(default)]
    pub energy_before: Option<i32>,
    #[serde(default)]
    pub energy_after: Option<i32>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub exercises: Vec<LogExerciseParams>,
    #[serde(default)]
    pub notes: Option<String>,
}
