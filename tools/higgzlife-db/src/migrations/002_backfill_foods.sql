-- Migration 002: backfill foods and servings from existing meal_items rows.
--
-- Before this migration, meal_items rows had food_name but null food_id/serving_id
-- (the foods/servings tables were added later, and old meal_items predate them).
-- This migration projects every distinct (lowercased) food_name into a foods row,
-- every distinct (food, serving_size) pair into a servings row, and links the old
-- meal_items rows up to point at them. Pure data migration — schema unchanged.
--
-- Idempotent: gated on `food_id IS NULL`, uses INSERT OR IGNORE.

-- 1. One foods row per distinct lowercased food_name.
INSERT OR IGNORE INTO foods (id, name, display_name, use_count, last_used_at, created_at)
SELECT
    LOWER(HEX(RANDOMBLOB(16))),
    LOWER(mi.food_name),
    MAX(mi.food_name),
    COUNT(*),
    (SELECT MAX(a.created_at)
     FROM meal_items mi2
     JOIN meals m ON m.activity_id = mi2.meal_id
     JOIN activities a ON a.id = m.activity_id
     WHERE LOWER(mi2.food_name) = LOWER(mi.food_name)),
    datetime('now')
FROM meal_items mi
WHERE mi.food_name IS NOT NULL AND mi.food_id IS NULL
GROUP BY LOWER(mi.food_name);

-- 2. One servings row per distinct (food, serving_size). Picks the highest-rowid
--    meal_item per combo as the nutrition source (most recent log "wins" if values drifted).
--    Null/empty serving_size collapses to '1 serving'.
INSERT OR IGNORE INTO servings (id, food_id, label, calories, protein_g, carbs_g, fat_g, fiber_g, is_default, created_at)
SELECT
    LOWER(HEX(RANDOMBLOB(16))),
    f.id,
    COALESCE(NULLIF(mi.serving_size, ''), '1 serving'),
    mi.calories,
    mi.protein_g,
    mi.carbs_g,
    mi.fat_g,
    mi.fiber_g,
    0,
    datetime('now')
FROM meal_items mi
JOIN foods f ON f.name = LOWER(mi.food_name)
WHERE mi.food_id IS NULL
  AND mi.rowid = (
    SELECT MAX(mi2.rowid) FROM meal_items mi2
    WHERE LOWER(mi2.food_name) = LOWER(mi.food_name)
      AND COALESCE(NULLIF(mi2.serving_size, ''), '1 serving')
        = COALESCE(NULLIF(mi.serving_size, ''), '1 serving')
  );

-- 3. Mark one default serving per food (the lowest-rowid serving — first one created).
UPDATE servings SET is_default = 1
WHERE rowid IN (
    SELECT MIN(rowid) FROM servings GROUP BY food_id
);

-- 4. Set foods.default_serving_id to point at that default serving.
UPDATE foods
SET default_serving_id = (
    SELECT s.id FROM servings s
    WHERE s.food_id = foods.id AND s.is_default = 1
    LIMIT 1
)
WHERE default_serving_id IS NULL;

-- 5. Link the legacy meal_items rows to their food + serving.
UPDATE meal_items
SET
    food_id = (SELECT f.id FROM foods f WHERE f.name = LOWER(meal_items.food_name)),
    serving_id = (
        SELECT s.id FROM servings s
        WHERE s.food_id = (SELECT f.id FROM foods f WHERE f.name = LOWER(meal_items.food_name))
          AND s.label = COALESCE(NULLIF(meal_items.serving_size, ''), '1 serving')
        LIMIT 1
    )
WHERE food_id IS NULL AND food_name IS NOT NULL;
