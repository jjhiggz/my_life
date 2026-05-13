use chrono::{DateTime, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Body measurements and metrics
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct BodyMetrics {
    pub id: Uuid,
    pub recorded_at: DateTime<Utc>,
    pub weight_lbs: Option<f64>,
    pub body_fat_pct: Option<f64>,
    pub waist_in: Option<f64>,
    pub chest_in: Option<f64>,
    pub notes: Option<String>,
}

impl BodyMetrics {
    pub fn new() -> Self {
        Self {
            id: Uuid::new_v4(),
            recorded_at: Utc::now(),
            weight_lbs: None,
            body_fat_pct: None,
            waist_in: None,
            chest_in: None,
            notes: None,
        }
    }

    pub fn with_weight(mut self, lbs: f64) -> Self {
        self.weight_lbs = Some(lbs);
        self
    }
}

impl Default for BodyMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Parameters for logging body metrics
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct LogBodyMetricsParams {
    #[serde(default)]
    pub weight_lbs: Option<f64>,
    #[serde(default)]
    pub body_fat_pct: Option<f64>,
    #[serde(default)]
    pub waist_in: Option<f64>,
    #[serde(default)]
    pub chest_in: Option<f64>,
    #[serde(default)]
    pub notes: Option<String>,
}

/// Weight trend data
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WeightTrend {
    pub entries: Vec<WeightEntry>,
    pub start_weight: f64,
    pub current_weight: f64,
    pub change: f64,
    pub avg_weekly_change: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WeightEntry {
    pub date: String,
    pub weight_lbs: f64,
}
