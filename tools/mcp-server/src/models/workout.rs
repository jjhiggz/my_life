use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Type of workout
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WorkoutType {
    Strength,
    Cardio,
    Yoga,
    Swimming,
    Cycling,
    Running,
    Mobility,
    Other,
}

impl std::fmt::Display for WorkoutType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Strength => write!(f, "strength"),
            Self::Cardio => write!(f, "cardio"),
            Self::Yoga => write!(f, "yoga"),
            Self::Swimming => write!(f, "swimming"),
            Self::Cycling => write!(f, "cycling"),
            Self::Running => write!(f, "running"),
            Self::Mobility => write!(f, "mobility"),
            Self::Other => write!(f, "other"),
        }
    }
}

/// Workout-specific data
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct Workout {
    pub activity_id: Uuid,
    pub workout_type: WorkoutType,
    pub duration_min: Option<i32>,
    pub energy_before: Option<i32>,
    pub energy_after: Option<i32>,
    pub location: Option<String>,
    pub exercises: Vec<Exercise>,
}

/// An exercise within a workout
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct Exercise {
    pub id: Uuid,
    pub workout_id: Uuid,
    pub exercise_name: String,
    pub exercise_order: i32,
    pub notes: Option<String>,
    pub sets: Vec<ExerciseSet>,
}

impl Exercise {
    pub fn new(workout_id: Uuid, name: impl Into<String>, order: i32) -> Self {
        Self {
            id: Uuid::new_v4(),
            workout_id,
            exercise_name: name.into(),
            exercise_order: order,
            notes: None,
            sets: Vec::new(),
        }
    }
}

/// A single set within an exercise
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ExerciseSet {
    pub id: Uuid,
    pub exercise_id: Uuid,
    pub set_number: i32,
    pub reps: Option<i32>,
    pub weight_lbs: Option<f64>,
    pub duration_sec: Option<i32>,
    pub rest_after_sec: Option<i32>,
    pub rpe: Option<i32>,
    pub notes: Option<String>,
}

impl ExerciseSet {
    pub fn new(exercise_id: Uuid, set_number: i32) -> Self {
        Self {
            id: Uuid::new_v4(),
            exercise_id,
            set_number,
            reps: None,
            weight_lbs: None,
            duration_sec: None,
            rest_after_sec: None,
            rpe: None,
            notes: None,
        }
    }

    pub fn with_reps(mut self, reps: i32) -> Self {
        self.reps = Some(reps);
        self
    }

    pub fn with_weight(mut self, weight_lbs: f64) -> Self {
        self.weight_lbs = Some(weight_lbs);
        self
    }

    pub fn with_duration(mut self, duration_sec: i32) -> Self {
        self.duration_sec = Some(duration_sec);
        self
    }
}

/// Parameters for logging a quick exercise (simplified API)
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct LogExerciseParams {
    pub exercise_name: String,
    pub sets: Vec<SetParams>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct SetParams {
    pub reps: Option<i32>,
    pub weight_lbs: Option<f64>,
    pub duration_sec: Option<i32>,
}

/// Workout summary for reports
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WorkoutSummary {
    pub activity_id: Uuid,
    pub workout_type: WorkoutType,
    pub duration_min: Option<i32>,
    pub exercise_count: usize,
    pub total_sets: usize,
    pub total_reps: i32,
}
