CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence
ON calendar_events(recurrence_rule);
