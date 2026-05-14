mod db;
mod models;
mod tools;

use std::path::PathBuf;
use std::sync::Arc;

use rmcp::{
    ServiceExt,
    tool,
    tool_router,
    handler::server::wrapper::Parameters,
    transport::stdio,
};
use schemars::JsonSchema;
use serde::Deserialize;
use tracing_subscriber;

use db::Database;
use models::*;

// ============================================================================
// Parameter structs for MCP tools
// ============================================================================

#[derive(Debug, Deserialize, JsonSchema)]
struct LogMealToolParams {
    /// Type of meal: breakfast, lunch, dinner, or snack
    meal_type: String,
    /// List of food items with their nutritional info
    items: Vec<MealItemInput>,
    /// Optional notes about the meal
    notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
struct MealItemInput {
    /// Name of the food
    food_name: String,
    /// Serving size (e.g., "1 cup", "2 tbsp")
    serving_size: Option<String>,
    /// Calories
    calories: Option<i32>,
    /// Protein in grams
    protein_g: Option<f64>,
    /// Carbs in grams
    carbs_g: Option<f64>,
    /// Fat in grams
    fat_g: Option<f64>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct LogWorkoutToolParams {
    /// Type of workout: strength, cardio, yoga, swimming, cycling, etc.
    workout_type: String,
    /// Duration in minutes
    duration_min: Option<i32>,
    /// Energy level before workout (1-10)
    energy_before: Option<i32>,
    /// Energy level after workout (1-10)
    energy_after: Option<i32>,
    /// List of exercises performed
    exercises: Vec<ExerciseInput>,
    /// Optional notes
    notes: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct ExerciseInput {
    /// Name of the exercise
    exercise_name: String,
    /// Sets performed
    sets: Vec<SetInput>,
    /// Optional notes
    notes: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct SetInput {
    /// Number of reps (for rep-based exercises)
    reps: Option<i32>,
    /// Weight in pounds
    weight_lbs: Option<f64>,
    /// Duration in seconds (for timed exercises like planks)
    duration_sec: Option<i32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct CreateTaskToolParams {
    /// Task title/description
    title: String,
    /// Priority: urgent, high, medium, low
    priority: Option<String>,
    /// Due date in YYYY-MM-DD format
    due_date: Option<String>,
    /// Category: errand, home, work, garden, etc.
    category: Option<String>,
    /// Related goal (e.g., "triathlon", "dad-prep")
    related_goal: Option<String>,
    /// Optional notes
    notes: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct CreateCalendarEventToolParams {
    /// Event title
    title: String,
    /// Start date or datetime. Use YYYY-MM-DD for all-day events or RFC3339/ISO datetime for timed events.
    starts_at: String,
    /// Optional end date or datetime, matching starts_at style
    ends_at: Option<String>,
    /// Whether this is an all-day event
    all_day: Option<bool>,
    /// Optional location
    location: Option<String>,
    /// Optional notes
    notes: Option<String>,
    /// Optional recurrence rule: daily, weekly, monthly, or yearly
    recurrence_rule: Option<String>,
    /// Optional recurrence end date as YYYY-MM-DD
    recurrence_until: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct CompleteTaskToolParams {
    /// UUID of the task to complete
    task_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct LogCheckinToolParams {
    /// Mood level (1-10)
    mood: Option<i32>,
    /// Energy level (1-10)
    energy: Option<i32>,
    /// Hours of sleep
    sleep_hours: Option<f64>,
    /// Sleep quality (1-10)
    sleep_quality: Option<i32>,
    /// Stress level (1-10)
    stress: Option<i32>,
    /// Water intake in oz
    hydration_oz: Option<i32>,
    /// Optional notes
    notes: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct LogWeightToolParams {
    /// Weight in pounds
    weight_lbs: f64,
    /// Body fat percentage (optional)
    body_fat_pct: Option<f64>,
    /// Optional notes
    notes: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct SearchFoodsToolParams {
    /// Substring to match against food names (case-insensitive)
    query: String,
    /// Max results to return (default 20)
    limit: Option<i32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct GetFoodToolParams {
    /// UUID of the food
    food_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct ListFoodsToolParams {
    /// "recent" or "frequent" — default "recent"
    order: Option<String>,
    /// Max results (default 20)
    limit: Option<i32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct AddServingToolParams {
    /// UUID of the food
    food_id: String,
    /// Label like "100g", "1 cup cooked", "1 medium"
    label: String,
    /// Equivalent grams (optional, for future cross-unit math)
    grams: Option<f64>,
    /// Calories for this serving
    calories: Option<f64>,
    /// Protein grams
    protein_g: Option<f64>,
    /// Carbs grams
    carbs_g: Option<f64>,
    /// Fat grams
    fat_g: Option<f64>,
    /// Fiber grams
    fiber_g: Option<f64>,
    /// Set this serving as the default for the food
    make_default: Option<bool>,
}

// ============================================================================
// MCP Server Implementation
// ============================================================================

#[derive(Clone)]
struct HiggzLifeServer {
    db: Arc<Database>,
}

#[tool_router(server_handler)]
impl HiggzLifeServer {
    /// Log a meal with food items and nutritional information
    #[tool(description = "Log a meal with food items. Include meal_type (breakfast/lunch/dinner/snack) and items with calories and protein.")]
    fn log_meal(&self, Parameters(params): Parameters<LogMealToolParams>) -> String {
        match self.do_log_meal(params) {
            Ok(summary) => summary,
            Err(e) => format!("Error logging meal: {}", e),
        }
    }

    /// Get today's nutrition summary
    #[tool(description = "Get today's nutrition summary including total calories, protein, and meals logged.")]
    fn get_today_nutrition(&self) -> String {
        match self.do_get_nutrition() {
            Ok(summary) => summary,
            Err(e) => format!("Error getting nutrition: {}", e),
        }
    }

    /// Log a workout with exercises
    #[tool(description = "Log a workout with exercises and sets. Include workout_type (strength/cardio/yoga/etc) and exercises with sets/reps/weight.")]
    fn log_workout(&self, Parameters(params): Parameters<LogWorkoutToolParams>) -> String {
        match self.do_log_workout(params) {
            Ok(id) => format!("Workout logged successfully. ID: {}", id),
            Err(e) => format!("Error logging workout: {}", e),
        }
    }

    /// Create a new task
    #[tool(description = "Create a new task with title, priority (urgent/high/medium/low), optional due_date (YYYY-MM-DD), category, and related_goal.")]
    fn create_task(&self, Parameters(params): Parameters<CreateTaskToolParams>) -> String {
        match self.do_create_task(params) {
            Ok(id) => format!("Task created successfully. ID: {}", id),
            Err(e) => format!("Error creating task: {}", e),
        }
    }

    /// Create a calendar event
    #[tool(description = "Create a calendar event for an upcoming commitment. Include title and starts_at (YYYY-MM-DD for all-day or ISO/RFC3339 datetime for timed events), optional ends_at, all_day, location, and notes.")]
    fn create_calendar_event(&self, Parameters(params): Parameters<CreateCalendarEventToolParams>) -> String {
        match self.do_create_calendar_event(params) {
            Ok(id) => format!("Calendar event created successfully. ID: {}", id),
            Err(e) => format!("Error creating calendar event: {}", e),
        }
    }

    /// List pending tasks
    #[tool(description = "List all pending tasks sorted by priority and due date.")]
    fn list_tasks(&self) -> String {
        match self.do_list_tasks() {
            Ok(tasks) => tasks,
            Err(e) => format!("Error listing tasks: {}", e),
        }
    }

    /// Complete a task
    #[tool(description = "Mark a task as completed by its task_id (UUID).")]
    fn complete_task(&self, Parameters(params): Parameters<CompleteTaskToolParams>) -> String {
        match self.do_complete_task(params) {
            Ok(_) => "Task completed successfully.".to_string(),
            Err(e) => format!("Error completing task: {}", e),
        }
    }

    /// Log a mood/energy check-in
    #[tool(description = "Log a check-in with mood (1-10), energy (1-10), sleep_hours, sleep_quality (1-10), stress (1-10), and hydration_oz.")]
    fn log_checkin(&self, Parameters(params): Parameters<LogCheckinToolParams>) -> String {
        match self.do_log_checkin(params) {
            Ok(id) => format!("Check-in logged successfully. ID: {}", id),
            Err(e) => format!("Error logging check-in: {}", e),
        }
    }

    /// Log body weight
    #[tool(description = "Log body weight in pounds, optionally with body fat percentage.")]
    fn log_weight(&self, Parameters(params): Parameters<LogWeightToolParams>) -> String {
        match self.do_log_weight(params) {
            Ok(id) => format!("Weight logged successfully. ID: {}", id),
            Err(e) => format!("Error logging weight: {}", e),
        }
    }

    /// Get current weight
    #[tool(description = "Get the most recently logged body weight.")]
    fn get_weight(&self) -> String {
        match self.do_get_weight() {
            Ok(Some(w)) => format!("Current weight: {} lbs", w),
            Ok(None) => "No weight recorded yet.".to_string(),
            Err(e) => format!("Error getting weight: {}", e),
        }
    }

    /// Get today's activities
    #[tool(description = "Get all activities logged today (meals, workouts, tasks, check-ins).")]
    fn get_today(&self) -> String {
        match self.do_get_today() {
            Ok(summary) => summary,
            Err(e) => format!("Error getting today's activities: {}", e),
        }
    }

    /// Search the personal food database
    #[tool(description = "Search the personal food database by name substring. Returns matching foods with their servings (unit options). Use this before logging a meal to find existing entries.")]
    fn search_foods(&self, Parameters(params): Parameters<SearchFoodsToolParams>) -> String {
        match self.do_search_foods(params) {
            Ok(s) => s,
            Err(e) => format!("Error searching foods: {}", e),
        }
    }

    /// Get a single food with all its servings
    #[tool(description = "Fetch a single food by ID along with all its servings (unit options).")]
    fn get_food(&self, Parameters(params): Parameters<GetFoodToolParams>) -> String {
        match self.do_get_food(params) {
            Ok(s) => s,
            Err(e) => format!("Error fetching food: {}", e),
        }
    }

    /// List foods by recency or frequency
    #[tool(description = "List foods from the personal database, ordered by 'recent' (last_used_at) or 'frequent' (use_count). Useful for quick-add panels.")]
    fn list_foods(&self, Parameters(params): Parameters<ListFoodsToolParams>) -> String {
        match self.do_list_foods(params) {
            Ok(s) => s,
            Err(e) => format!("Error listing foods: {}", e),
        }
    }

    /// Add a new serving (unit option) to an existing food
    #[tool(description = "Add a new serving (unit option) to an existing food. Example: add '1 medium piece' serving to 'Chicken breast' with its nutrition.")]
    fn add_serving(&self, Parameters(params): Parameters<AddServingToolParams>) -> String {
        match self.do_add_serving(params) {
            Ok(s) => s,
            Err(e) => format!("Error adding serving: {}", e),
        }
    }
}

// ============================================================================
// Implementation helpers
// ============================================================================

const CALORIE_TARGET: i32 = 2200;
const PROTEIN_TARGET_G: f64 = 150.0;
const BAR_WIDTH: usize = 24;

fn render_bar(current: f64, target: f64) -> String {
    let pct = (current / target).clamp(0.0, 1.0);
    let filled = (pct * BAR_WIDTH as f64).round() as usize;
    let empty = BAR_WIDTH - filled;
    format!(
        "[{}{}] {}%",
        "█".repeat(filled),
        "░".repeat(empty),
        (pct * 100.0).round() as i32
    )
}

fn render_nutrition_summary(cal: i32, protein: f64, meals: i32) -> String {
    format!(
        "Today's nutrition ({} meals):\n\n  Calories: {} / {}\n  {}\n\n  Protein:  {:.0}g / {:.0}g\n  {}",
        meals,
        cal, CALORIE_TARGET,
        render_bar(cal as f64, CALORIE_TARGET as f64),
        protein, PROTEIN_TARGET_G,
        render_bar(protein, PROTEIN_TARGET_G)
    )
}

impl HiggzLifeServer {
    fn new(db: Database) -> Self {
        Self { db: Arc::new(db) }
    }

    fn nutrition_summary_today(&self) -> anyhow::Result<String> {
        use chrono::Local;
        use db::queries;
        let today = Local::now().date_naive();
        let nutrition = self.db.with_conn(|conn| queries::get_daily_nutrition(conn, today))?;
        Ok(render_nutrition_summary(
            nutrition.total_calories,
            nutrition.total_protein_g,
            nutrition.meal_count,
        ))
    }

    fn do_log_meal(&self, params: LogMealToolParams) -> anyhow::Result<String> {
        use chrono::Utc;
        use uuid::Uuid;
        use db::queries;

        let activity_id = Uuid::new_v4();
        let now = Utc::now();

        let meal_type: MealType = match params.meal_type.to_lowercase().as_str() {
            "breakfast" => MealType::Breakfast,
            "lunch" => MealType::Lunch,
            "dinner" => MealType::Dinner,
            _ => MealType::Snack,
        };

        let activity = Activity {
            id: activity_id,
            activity_type: ActivityType::Meal,
            created_at: now,
            updated_at: now,
            status: ActivityStatus::Done,
            title: Some(format!("{:?}", meal_type)),
            notes: params.notes,
            tags: vec![],
        };

        let total_cal: i32 = params.items.iter().filter_map(|i| i.calories).sum();
        let total_protein: f64 = params.items.iter().filter_map(|i| i.protein_g).sum();

        let raw_items = params.items.clone();

        self.db.with_conn(|conn| {
            queries::insert_activity(conn, &activity)?;

            // Build meal items, upserting food + serving for each
            let mut built: Vec<MealItem> = Vec::with_capacity(raw_items.len());
            for i in &raw_items {
                let food = queries::upsert_food(conn, &i.food_name)?;
                let serving_label = i
                    .serving_size
                    .clone()
                    .unwrap_or_else(|| "1 serving".to_string());
                let serving = queries::upsert_serving(
                    conn,
                    food.id,
                    &serving_label,
                    None,
                    i.calories.map(|c| c as f64),
                    i.protein_g,
                    i.carbs_g,
                    i.fat_g,
                    None,
                    false,
                )?;
                queries::bump_food_usage(conn, food.id)?;
                built.push(MealItem {
                    id: Uuid::new_v4(),
                    meal_id: activity_id,
                    food_name: food.display_name.clone(),
                    serving_size: Some(serving.label.clone()),
                    calories: i.calories,
                    protein_g: i.protein_g,
                    carbs_g: i.carbs_g,
                    fat_g: i.fat_g,
                    fiber_g: None,
                    notes: None,
                    food_id: Some(food.id),
                    serving_id: Some(serving.id),
                    quantity: Some(1.0),
                });
            }

            let meal = Meal {
                activity_id,
                meal_type,
                total_calories: Some(total_cal),
                total_protein_g: Some(total_protein),
                total_carbs_g: None,
                total_fat_g: None,
                total_fiber_g: None,
                items: built,
            };
            queries::insert_meal(conn, &meal)?;
            Ok(())
        })?;

        let summary = self.nutrition_summary_today()?;
        Ok(format!(
            "Logged: {} ({} cal, {:.0}g protein)\n\n{}",
            params.meal_type, total_cal, total_protein, summary
        ))
    }

    fn do_get_nutrition(&self) -> anyhow::Result<String> {
        self.nutrition_summary_today()
    }

    fn do_log_workout(&self, params: LogWorkoutToolParams) -> anyhow::Result<String> {
        use chrono::Utc;
        use uuid::Uuid;
        use db::queries;

        let activity_id = Uuid::new_v4();
        let now = Utc::now();

        let workout_type: WorkoutType = match params.workout_type.to_lowercase().as_str() {
            "strength" => WorkoutType::Strength,
            "cardio" => WorkoutType::Cardio,
            "yoga" => WorkoutType::Yoga,
            "swimming" => WorkoutType::Swimming,
            "cycling" => WorkoutType::Cycling,
            "running" => WorkoutType::Running,
            "mobility" => WorkoutType::Mobility,
            _ => WorkoutType::Other,
        };

        let activity = Activity {
            id: activity_id,
            activity_type: ActivityType::Workout,
            created_at: now,
            updated_at: now,
            status: ActivityStatus::Done,
            title: Some(format!("{:?} workout", workout_type)),
            notes: params.notes,
            tags: vec![],
        };

        let exercises: Vec<Exercise> = params.exercises.iter().enumerate().map(|(i, e)| {
            let exercise_id = Uuid::new_v4();
            let sets: Vec<ExerciseSet> = e.sets.iter().enumerate().map(|(j, s)| {
                ExerciseSet {
                    id: Uuid::new_v4(),
                    exercise_id,
                    set_number: (j + 1) as i32,
                    reps: s.reps,
                    weight_lbs: s.weight_lbs,
                    duration_sec: s.duration_sec,
                    rest_after_sec: None,
                    rpe: None,
                    notes: None,
                }
            }).collect();

            Exercise {
                id: exercise_id,
                workout_id: activity_id,
                exercise_name: e.exercise_name.clone(),
                exercise_order: i as i32,
                notes: e.notes.clone(),
                sets,
            }
        }).collect();

        let workout = Workout {
            activity_id,
            workout_type,
            duration_min: params.duration_min,
            energy_before: params.energy_before,
            energy_after: params.energy_after,
            location: None,
            exercises,
        };

        self.db.with_conn(|conn| {
            queries::insert_activity(conn, &activity)?;
            queries::insert_workout(conn, &workout)?;
            Ok(())
        })?;

        Ok(activity_id.to_string())
    }

    fn do_create_task(&self, params: CreateTaskToolParams) -> anyhow::Result<String> {
        use chrono::{NaiveDate, Utc};
        use uuid::Uuid;
        use db::queries;

        let activity_id = Uuid::new_v4();
        let now = Utc::now();

        let priority = match params.priority.as_deref() {
            Some("urgent") => TaskPriority::Urgent,
            Some("high") => TaskPriority::High,
            Some("low") => TaskPriority::Low,
            _ => TaskPriority::Medium,
        };

        let due_date = params.due_date
            .and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok());

        let activity = Activity {
            id: activity_id,
            activity_type: ActivityType::Task,
            created_at: now,
            updated_at: now,
            status: ActivityStatus::Planned,
            title: Some(params.title),
            notes: params.notes,
            tags: vec![],
        };

        let task = Task {
            activity_id,
            priority,
            due_date,
            completed_at: None,
            category: params.category,
            related_goal: params.related_goal,
        };

        self.db.with_conn(|conn| {
            queries::insert_activity(conn, &activity)?;
            queries::insert_task(conn, &task)?;
            Ok(())
        })?;

        Ok(activity_id.to_string())
    }

    fn do_create_calendar_event(&self, params: CreateCalendarEventToolParams) -> anyhow::Result<String> {
        use chrono::Utc;
        use uuid::Uuid;
        use db::queries;

        let activity_id = Uuid::new_v4();
        let now = Utc::now();
        let all_day = params.all_day.unwrap_or_else(|| params.starts_at.len() == 10);
        let recurrence_rule = normalize_recurrence_rule(params.recurrence_rule);

        let activity = Activity {
            id: activity_id,
            activity_type: ActivityType::CalendarEvent,
            created_at: now,
            updated_at: now,
            status: ActivityStatus::Planned,
            title: Some(params.title),
            notes: params.notes,
            tags: vec!["calendar".to_string()],
        };

        self.db.with_conn(|conn| {
            queries::insert_activity(conn, &activity)?;
            conn.execute(
                "INSERT INTO calendar_events
                    (activity_id, starts_at, ends_at, all_day, location, source, recurrence_rule, recurrence_until)
                 VALUES (?1, ?2, ?3, ?4, ?5, 'mcp', ?6, ?7)",
                rusqlite::params![
                    activity_id.to_string(),
                    params.starts_at,
                    params.ends_at,
                    if all_day { 1 } else { 0 },
                    params.location,
                    recurrence_rule,
                    params.recurrence_until,
                ],
            )?;
            Ok(())
        })?;

        Ok(activity_id.to_string())
    }

    fn do_list_tasks(&self) -> anyhow::Result<String> {
        use db::queries;

        let tasks = self.db.with_conn(|conn| {
            queries::list_pending_tasks(conn)
        })?;

        if tasks.is_empty() {
            return Ok("No pending tasks.".to_string());
        }

        let mut result = String::from("Pending tasks:\n");
        for task in tasks {
            result.push_str(&format!(
                "  - [{}] {} ({})\n",
                task.priority.to_string().to_uppercase(),
                task.title,
                task.id
            ));
        }
        Ok(result)
    }

    fn do_complete_task(&self, params: CompleteTaskToolParams) -> anyhow::Result<()> {
        use uuid::Uuid;
        use db::queries;

        let task_id = Uuid::parse_str(&params.task_id)?;
        self.db.with_conn(|conn| {
            queries::complete_task(conn, task_id)
        })
    }

    fn do_log_checkin(&self, params: LogCheckinToolParams) -> anyhow::Result<String> {
        use chrono::Utc;
        use uuid::Uuid;
        use db::queries;

        let activity_id = Uuid::new_v4();
        let now = Utc::now();

        let activity = Activity {
            id: activity_id,
            activity_type: ActivityType::Checkin,
            created_at: now,
            updated_at: now,
            status: ActivityStatus::Done,
            title: Some("Check-in".to_string()),
            notes: params.notes,
            tags: vec![],
        };

        let checkin = Checkin {
            activity_id,
            checkin_type: CheckinType::Random,
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
            Ok(())
        })?;

        Ok(activity_id.to_string())
    }

    fn do_log_weight(&self, params: LogWeightToolParams) -> anyhow::Result<String> {
        use chrono::Utc;
        use uuid::Uuid;
        use db::queries;

        let activity_id = Uuid::new_v4();
        let activity = Activity {
            id: activity_id,
            activity_type: ActivityType::WeightLog,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            status: ActivityStatus::Done,
            title: Some(format!("Logged weight: {:.1} lb", params.weight_lbs)),
            notes: params.notes.clone(),
            tags: vec!["health".to_string(), "weight".to_string()],
        };
        let metrics = BodyMetrics {
            id: Uuid::new_v4(),
            activity_id: Some(activity_id),
            recorded_at: Utc::now(),
            weight_lbs: Some(params.weight_lbs),
            body_fat_pct: params.body_fat_pct,
            waist_in: None,
            chest_in: None,
            notes: params.notes,
        };

        self.db.with_conn(|conn| {
            queries::insert_activity(conn, &activity)?;
            queries::insert_body_metrics(conn, &metrics)?;
            Ok(())
        })?;

        Ok(activity_id.to_string())
    }

    fn do_get_weight(&self) -> anyhow::Result<Option<f64>> {
        use db::queries;
        self.db.with_conn(|conn| queries::get_latest_weight(conn))
    }

    fn do_get_today(&self) -> anyhow::Result<String> {
        use db::queries;

        let activities = self.db.with_conn(|conn| {
            queries::list_activities_today(conn)
        })?;

        if activities.is_empty() {
            return Ok("No activities logged today.".to_string());
        }

        let mut result = String::from("Today's activities:\n");
        for activity in activities {
            result.push_str(&format!(
                "  - [{:?}] {} ({})\n",
                activity.activity_type,
                activity.title.unwrap_or_default(),
                activity.created_at.format("%H:%M")
            ));
        }
        Ok(result)
    }

    fn do_search_foods(&self, params: SearchFoodsToolParams) -> anyhow::Result<String> {
        use db::queries;
        let limit = params.limit.unwrap_or(20).max(1).min(100);
        let results = self
            .db
            .with_conn(|conn| queries::search_foods_with_servings(conn, &params.query, limit))?;
        Ok(format_food_list(&results, &format!("Search '{}'", params.query)))
    }

    fn do_get_food(&self, params: GetFoodToolParams) -> anyhow::Result<String> {
        use db::queries;
        use uuid::Uuid;

        let id = Uuid::parse_str(&params.food_id)?;
        let result = self.db.with_conn(|conn| {
            let food = queries::get_food(conn, id)?;
            let Some(food) = food else {
                return Ok(None);
            };
            let servings = queries::list_servings(conn, food.id)?;
            Ok(Some(models::FoodWithServings { food, servings }))
        })?;

        match result {
            Some(fws) => Ok(format_food_with_servings(&fws)),
            None => Ok(format!("No food found with id {}", params.food_id)),
        }
    }

    fn do_list_foods(&self, params: ListFoodsToolParams) -> anyhow::Result<String> {
        use db::queries;
        let limit = params.limit.unwrap_or(20).max(1).min(100);
        let foods = self.db.with_conn(|conn| {
            match params.order.as_deref() {
                Some("frequent") => queries::list_frequent_foods(conn, limit),
                _ => queries::list_recent_foods(conn, limit),
            }
        })?;

        if foods.is_empty() {
            return Ok("No foods in database yet.".to_string());
        }

        let mut out = String::new();
        for food in &foods {
            out.push_str(&format!(
                "  · {} (used {}×) — {}\n",
                food.display_name,
                food.use_count,
                food.id
            ));
        }
        Ok(out)
    }

    fn do_add_serving(&self, params: AddServingToolParams) -> anyhow::Result<String> {
        use db::queries;
        use uuid::Uuid;

        let food_id = Uuid::parse_str(&params.food_id)?;
        let serving = self.db.with_conn(|conn| {
            queries::upsert_serving(
                conn,
                food_id,
                &params.label,
                params.grams,
                params.calories,
                params.protein_g,
                params.carbs_g,
                params.fat_g,
                params.fiber_g,
                params.make_default.unwrap_or(false),
            )
        })?;
        Ok(format!(
            "Serving added: {} ({} cal, {:.1}g protein) — {}",
            serving.label,
            serving.calories.unwrap_or(0.0),
            serving.protein_g.unwrap_or(0.0),
            serving.id
        ))
    }
}

fn format_food_with_servings(fws: &models::FoodWithServings) -> String {
    let mut out = format!("{} ({})\n", fws.food.display_name, fws.food.id);
    out.push_str(&format!("  Used: {}×\n", fws.food.use_count));
    out.push_str("  Servings:\n");
    if fws.servings.is_empty() {
        out.push_str("    (none)\n");
    } else {
        for s in &fws.servings {
            let star = if s.is_default { "★" } else { " " };
            out.push_str(&format!(
                "    {} {} — {} cal, {:.1}g protein  [{}]\n",
                star,
                s.label,
                s.calories.unwrap_or(0.0),
                s.protein_g.unwrap_or(0.0),
                s.id
            ));
        }
    }
    out
}

fn format_food_list(results: &[models::FoodWithServings], header: &str) -> String {
    if results.is_empty() {
        return format!("{}: no matches.", header);
    }
    let mut out = format!("{} — {} result(s):\n\n", header, results.len());
    for fws in results {
        out.push_str(&format_food_with_servings(fws));
        out.push('\n');
    }
    out
}

// ============================================================================
// Main
// ============================================================================

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .init();

    // Database path
    let db_path = std::env::var("HIGGZLIFE_DB")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            PathBuf::from(home).join(".higgzlife").join("data.db")
        });

    // Ensure directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Open database
    let db = Database::open(&db_path)?;

    // One-time backfill: populate foods/servings from existing meal_items.
    // Idempotent — only acts on rows missing food_id.
    let backfilled = db.with_conn(|conn| db::queries::backfill_foods_from_meal_items(conn))?;
    if backfilled > 0 {
        tracing::info!("Backfilled {} meal_items into foods/servings", backfilled);
    }

    // Create server
    let server = HiggzLifeServer::new(db);

    // Start MCP server on stdio
    let service = server.serve(stdio()).await?;
    service.waiting().await?;

    Ok(())
}
