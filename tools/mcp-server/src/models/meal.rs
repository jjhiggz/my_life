use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Type of meal
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MealType {
    Breakfast,
    Lunch,
    Dinner,
    Snack,
}

impl std::fmt::Display for MealType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Breakfast => write!(f, "breakfast"),
            Self::Lunch => write!(f, "lunch"),
            Self::Dinner => write!(f, "dinner"),
            Self::Snack => write!(f, "snack"),
        }
    }
}

impl std::str::FromStr for MealType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "breakfast" => Ok(Self::Breakfast),
            "lunch" => Ok(Self::Lunch),
            "dinner" => Ok(Self::Dinner),
            "snack" => Ok(Self::Snack),
            _ => Err(format!("unknown meal type: {}", s)),
        }
    }
}

/// Meal-specific data
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct Meal {
    pub activity_id: Uuid,
    pub meal_type: MealType,
    pub total_calories: Option<i32>,
    pub total_protein_g: Option<f64>,
    pub total_carbs_g: Option<f64>,
    pub total_fat_g: Option<f64>,
    pub total_fiber_g: Option<f64>,
    pub items: Vec<MealItem>,
}

impl Meal {
    /// Calculate totals from items
    pub fn calculate_totals(&mut self) {
        self.total_calories = Some(self.items.iter().filter_map(|i| i.calories).sum());
        self.total_protein_g = Some(self.items.iter().filter_map(|i| i.protein_g).sum());
        self.total_carbs_g = Some(self.items.iter().filter_map(|i| i.carbs_g).sum());
        self.total_fat_g = Some(self.items.iter().filter_map(|i| i.fat_g).sum());
        self.total_fiber_g = Some(self.items.iter().filter_map(|i| i.fiber_g).sum());
    }
}

/// A food item within a meal
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct MealItem {
    pub id: Uuid,
    pub meal_id: Uuid,
    pub food_name: String,
    pub serving_size: Option<String>,
    pub calories: Option<i32>,
    pub protein_g: Option<f64>,
    pub carbs_g: Option<f64>,
    pub fat_g: Option<f64>,
    pub fiber_g: Option<f64>,
    pub notes: Option<String>,
    #[serde(default)]
    pub food_id: Option<Uuid>,
    #[serde(default)]
    pub serving_id: Option<Uuid>,
    #[serde(default)]
    pub quantity: Option<f64>,
}

/// A canonical food in the user's personal food database
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct Food {
    pub id: Uuid,
    pub name: String,           // lowercase normalized
    pub display_name: String,   // user-facing capitalization
    pub default_serving_id: Option<Uuid>,
    pub last_used_at: Option<chrono::DateTime<chrono::Utc>>,
    pub use_count: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub notes: Option<String>,
}

/// A unit option for a food (100g, 1 cup, 1 medium, etc.)
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct Serving {
    pub id: Uuid,
    pub food_id: Uuid,
    pub label: String,           // "100g", "1 cup cooked", "1 medium"
    pub grams: Option<f64>,      // optional, for cross-unit math
    pub calories: Option<f64>,
    pub protein_g: Option<f64>,
    pub carbs_g: Option<f64>,
    pub fat_g: Option<f64>,
    pub fiber_g: Option<f64>,
    pub is_default: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Food with its servings — what a search result returns
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct FoodWithServings {
    pub food: Food,
    pub servings: Vec<Serving>,
}

impl MealItem {
    pub fn new(meal_id: Uuid, food_name: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            meal_id,
            food_name: food_name.into(),
            serving_size: None,
            calories: None,
            protein_g: None,
            carbs_g: None,
            fat_g: None,
            fiber_g: None,
            notes: None,
            food_id: None,
            serving_id: None,
            quantity: None,
        }
    }

    pub fn with_calories(mut self, cal: i32) -> Self {
        self.calories = Some(cal);
        self
    }

    pub fn with_protein(mut self, g: f64) -> Self {
        self.protein_g = Some(g);
        self
    }

    pub fn with_macros(mut self, protein: f64, carbs: f64, fat: f64) -> Self {
        self.protein_g = Some(protein);
        self.carbs_g = Some(carbs);
        self.fat_g = Some(fat);
        self
    }
}

/// Parameters for logging a meal (simplified API)
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct LogMealParams {
    pub meal_type: MealType,
    pub items: Vec<LogMealItemParams>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct LogMealItemParams {
    pub food_name: String,
    #[serde(default)]
    pub serving_size: Option<String>,
    #[serde(default)]
    pub calories: Option<i32>,
    #[serde(default)]
    pub protein_g: Option<f64>,
    #[serde(default)]
    pub carbs_g: Option<f64>,
    #[serde(default)]
    pub fat_g: Option<f64>,
}

/// Daily nutrition summary
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct DailyNutrition {
    pub date: String,
    pub total_calories: i32,
    pub total_protein_g: f64,
    pub total_carbs_g: f64,
    pub total_fat_g: f64,
    pub meal_count: i32,
    pub meals: Vec<MealSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct MealSummary {
    pub activity_id: Uuid,
    pub meal_type: MealType,
    pub total_calories: Option<i32>,
    pub total_protein_g: Option<f64>,
    pub item_count: usize,
}
