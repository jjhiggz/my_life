use chrono::{DateTime, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Activity status - used for kanban-style tracking
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ActivityStatus {
    Planned,
    InProgress,
    Done,
    Skipped,
}

impl Default for ActivityStatus {
    fn default() -> Self {
        Self::Done
    }
}

impl std::fmt::Display for ActivityStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Planned => write!(f, "planned"),
            Self::InProgress => write!(f, "in_progress"),
            Self::Done => write!(f, "done"),
            Self::Skipped => write!(f, "skipped"),
        }
    }
}

impl std::str::FromStr for ActivityStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "planned" => Ok(Self::Planned),
            "in_progress" => Ok(Self::InProgress),
            "done" => Ok(Self::Done),
            "skipped" => Ok(Self::Skipped),
            _ => Err(format!("Unknown status: {}", s)),
        }
    }
}

/// Activity type - discriminator for child tables
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ActivityType {
    Workout,
    Meal,
    Task,
    Checkin,
    Garden,
    Quiz,
    WeightLog,
    JournalLog,
    CalendarEvent,
}

impl std::fmt::Display for ActivityType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Workout => write!(f, "workout"),
            Self::Meal => write!(f, "meal"),
            Self::Task => write!(f, "task"),
            Self::Checkin => write!(f, "checkin"),
            Self::Garden => write!(f, "garden"),
            Self::Quiz => write!(f, "quiz"),
            Self::WeightLog => write!(f, "weight_log"),
            Self::JournalLog => write!(f, "journal_log"),
            Self::CalendarEvent => write!(f, "calendar_event"),
        }
    }
}

impl std::str::FromStr for ActivityType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "workout" => Ok(Self::Workout),
            "meal" => Ok(Self::Meal),
            "task" => Ok(Self::Task),
            "checkin" => Ok(Self::Checkin),
            "garden" => Ok(Self::Garden),
            "quiz" => Ok(Self::Quiz),
            "weight_log" => Ok(Self::WeightLog),
            "journal_log" => Ok(Self::JournalLog),
            "calendar_event" => Ok(Self::CalendarEvent),
            _ => Err(format!("Unknown activity type: {}", s)),
        }
    }
}

/// Base activity - shared fields for all trackable events
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct Activity {
    pub id: Uuid,
    pub activity_type: ActivityType,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub status: ActivityStatus,
    pub title: Option<String>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
}

impl Activity {
    pub fn new(activity_type: ActivityType) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            activity_type,
            created_at: now,
            updated_at: now,
            status: ActivityStatus::Done,
            title: None,
            notes: None,
            tags: Vec::new(),
        }
    }

    pub fn with_title(mut self, title: impl Into<String>) -> Self {
        self.title = Some(title.into());
        self
    }

    pub fn with_notes(mut self, notes: impl Into<String>) -> Self {
        self.notes = Some(notes.into());
        self
    }

    pub fn with_status(mut self, status: ActivityStatus) -> Self {
        self.status = status;
        self
    }

    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.tags = tags;
        self
    }
}

/// Summary of an activity for list views
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ActivitySummary {
    pub id: Uuid,
    pub activity_type: ActivityType,
    pub created_at: DateTime<Utc>,
    pub status: ActivityStatus,
    pub title: Option<String>,
    pub tags: Vec<String>,
}

impl From<Activity> for ActivitySummary {
    fn from(a: Activity) -> Self {
        Self {
            id: a.id,
            activity_type: a.activity_type,
            created_at: a.created_at,
            status: a.status,
            title: a.title,
            tags: a.tags,
        }
    }
}
