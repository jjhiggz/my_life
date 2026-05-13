use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Type of check-in
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CheckinType {
    Morning,
    Evening,
    PreWorkout,
    PostWorkout,
    Random,
}

impl std::fmt::Display for CheckinType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Morning => write!(f, "morning"),
            Self::Evening => write!(f, "evening"),
            Self::PreWorkout => write!(f, "pre_workout"),
            Self::PostWorkout => write!(f, "post_workout"),
            Self::Random => write!(f, "random"),
        }
    }
}

/// Check-in specific data (mood, energy, etc.)
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct Checkin {
    pub activity_id: Uuid,
    pub checkin_type: CheckinType,
    pub mood: Option<i32>,           // 1-10
    pub energy: Option<i32>,         // 1-10
    pub sleep_hours: Option<f64>,
    pub sleep_quality: Option<i32>,  // 1-10
    pub stress: Option<i32>,         // 1-10
    pub hydration_oz: Option<i32>,
}

/// Parameters for a quick check-in
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct LogCheckinParams {
    #[serde(default)]
    pub checkin_type: Option<CheckinType>,
    #[serde(default)]
    pub mood: Option<i32>,
    #[serde(default)]
    pub energy: Option<i32>,
    #[serde(default)]
    pub sleep_hours: Option<f64>,
    #[serde(default)]
    pub sleep_quality: Option<i32>,
    #[serde(default)]
    pub stress: Option<i32>,
    #[serde(default)]
    pub hydration_oz: Option<i32>,
    #[serde(default)]
    pub notes: Option<String>,
}

/// Weekly wellness summary
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WeeklyWellness {
    pub week: String,
    pub avg_mood: f64,
    pub avg_energy: f64,
    pub avg_sleep_hours: f64,
    pub avg_sleep_quality: f64,
    pub checkin_count: i32,
}
