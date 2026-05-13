use chrono::{DateTime, NaiveDate, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Task priority levels
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum TaskPriority {
    Urgent,
    High,
    Medium,
    Low,
}

impl Default for TaskPriority {
    fn default() -> Self {
        Self::Medium
    }
}

impl std::fmt::Display for TaskPriority {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Urgent => write!(f, "urgent"),
            Self::High => write!(f, "high"),
            Self::Medium => write!(f, "medium"),
            Self::Low => write!(f, "low"),
        }
    }
}

impl std::str::FromStr for TaskPriority {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "urgent" => Ok(Self::Urgent),
            "high" => Ok(Self::High),
            "medium" => Ok(Self::Medium),
            "low" => Ok(Self::Low),
            _ => Err(format!("Unknown priority: {}", s)),
        }
    }
}

/// Task-specific data
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct Task {
    pub activity_id: Uuid,
    pub priority: TaskPriority,
    pub due_date: Option<NaiveDate>,
    pub completed_at: Option<DateTime<Utc>>,
    pub category: Option<String>,
    pub related_goal: Option<String>,
}

impl Task {
    pub fn new(activity_id: Uuid) -> Self {
        Self {
            activity_id,
            priority: TaskPriority::Medium,
            due_date: None,
            completed_at: None,
            category: None,
            related_goal: None,
        }
    }

    pub fn with_priority(mut self, priority: TaskPriority) -> Self {
        self.priority = priority;
        self
    }

    pub fn with_due_date(mut self, due: NaiveDate) -> Self {
        self.due_date = Some(due);
        self
    }

    pub fn with_category(mut self, category: impl Into<String>) -> Self {
        self.category = Some(category.into());
        self
    }

    pub fn with_goal(mut self, goal: impl Into<String>) -> Self {
        self.related_goal = Some(goal.into());
        self
    }
}

/// Parameters for creating a task (simplified API)
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct CreateTaskParams {
    pub title: String,
    #[serde(default)]
    pub priority: Option<TaskPriority>,
    #[serde(default)]
    pub due_date: Option<String>, // ISO8601 date
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub related_goal: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// Task with full activity info for display
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct TaskWithActivity {
    pub id: Uuid,
    pub title: String,
    pub notes: Option<String>,
    pub status: String,
    pub priority: TaskPriority,
    pub due_date: Option<NaiveDate>,
    pub category: Option<String>,
    pub related_goal: Option<String>,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// Task list query parameters
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
pub struct ListTasksParams {
    #[serde(default)]
    pub status: Option<String>, // 'pending', 'done', 'all'
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub priority: Option<TaskPriority>,
    #[serde(default)]
    pub limit: Option<i32>,
}
