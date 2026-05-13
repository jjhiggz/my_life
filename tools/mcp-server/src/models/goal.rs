use chrono::{DateTime, NaiveDate, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Goal status
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GoalStatus {
    Active,
    Completed,
    Abandoned,
}

impl Default for GoalStatus {
    fn default() -> Self {
        Self::Active
    }
}

impl std::fmt::Display for GoalStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Active => write!(f, "active"),
            Self::Completed => write!(f, "completed"),
            Self::Abandoned => write!(f, "abandoned"),
        }
    }
}

/// Goal category
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GoalCategory {
    Fitness,
    Health,
    Skills,
    Career,
    Life,
    Financial,
    Other,
}

impl std::fmt::Display for GoalCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Fitness => write!(f, "fitness"),
            Self::Health => write!(f, "health"),
            Self::Skills => write!(f, "skills"),
            Self::Career => write!(f, "career"),
            Self::Life => write!(f, "life"),
            Self::Financial => write!(f, "financial"),
            Self::Other => write!(f, "other"),
        }
    }
}

/// A long-term goal
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct Goal {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub category: GoalCategory,
    pub target_date: Option<NaiveDate>,
    pub status: GoalStatus,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub milestones: Vec<GoalMilestone>,
}

impl Goal {
    pub fn new(name: impl Into<String>, category: GoalCategory) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            description: None,
            category,
            target_date: None,
            status: GoalStatus::Active,
            created_at: Utc::now(),
            completed_at: None,
            milestones: Vec::new(),
        }
    }
}

/// A milestone within a goal
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct GoalMilestone {
    pub id: Uuid,
    pub goal_id: Uuid,
    pub description: String,
    pub target_value: Option<f64>,
    pub current_value: Option<f64>,
    pub unit: Option<String>,
    pub is_complete: bool,
    pub completed_at: Option<DateTime<Utc>>,
}

impl GoalMilestone {
    pub fn new(goal_id: Uuid, description: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            goal_id,
            description: description.into(),
            target_value: None,
            current_value: None,
            unit: None,
            is_complete: false,
            completed_at: None,
        }
    }

    pub fn with_target(mut self, value: f64, unit: impl Into<String>) -> Self {
        self.target_value = Some(value);
        self.unit = Some(unit.into());
        self
    }

    pub fn progress_pct(&self) -> Option<f64> {
        match (self.current_value, self.target_value) {
            (Some(current), Some(target)) if target > 0.0 => {
                Some((current / target * 100.0).min(100.0))
            }
            _ => None,
        }
    }
}

/// Parameters for creating a goal
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct CreateGoalParams {
    pub name: String,
    pub category: GoalCategory,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub target_date: Option<String>, // ISO8601 date
    #[serde(default)]
    pub milestones: Vec<CreateMilestoneParams>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct CreateMilestoneParams {
    pub description: String,
    #[serde(default)]
    pub target_value: Option<f64>,
    #[serde(default)]
    pub unit: Option<String>,
}
