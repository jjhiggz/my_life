-- Migration 004: make body metrics activity-backed.
--
-- New weight entries should be ordinary activities with structured metric
-- payloads, matching meals/workouts/tasks.

CREATE INDEX IF NOT EXISTS idx_body_activity ON body_metrics(activity_id);
