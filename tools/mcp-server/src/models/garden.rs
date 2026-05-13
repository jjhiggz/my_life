use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Type of garden activity
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GardenActionType {
    Plant,
    Water,
    Harvest,
    Observe,
    Weed,
    Fertilize,
    Prune,
    Transplant,
    Other,
}

impl std::fmt::Display for GardenActionType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Plant => write!(f, "plant"),
            Self::Water => write!(f, "water"),
            Self::Harvest => write!(f, "harvest"),
            Self::Observe => write!(f, "observe"),
            Self::Weed => write!(f, "weed"),
            Self::Fertilize => write!(f, "fertilize"),
            Self::Prune => write!(f, "prune"),
            Self::Transplant => write!(f, "transplant"),
            Self::Other => write!(f, "other"),
        }
    }
}

/// Garden activity specific data
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct GardenActivity {
    pub activity_id: Uuid,
    pub action_type: GardenActionType,
    pub location: Option<String>,
    pub duration_min: Option<i32>,
    pub plants: Vec<GardenPlantEntry>,
}

/// A plant involved in a garden activity
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct GardenPlantEntry {
    pub id: Uuid,
    pub garden_activity_id: Uuid,
    pub plant_name: String,
    pub quantity: Option<i32>,
    pub observation: Option<String>,
}

impl GardenPlantEntry {
    pub fn new(garden_activity_id: Uuid, plant_name: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            garden_activity_id,
            plant_name: plant_name.into(),
            quantity: None,
            observation: None,
        }
    }
}

/// Parameters for logging garden activity
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct LogGardenParams {
    pub action_type: GardenActionType,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub duration_min: Option<i32>,
    #[serde(default)]
    pub plants: Vec<GardenPlantParams>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct GardenPlantParams {
    pub plant_name: String,
    #[serde(default)]
    pub quantity: Option<i32>,
    #[serde(default)]
    pub observation: Option<String>,
}
