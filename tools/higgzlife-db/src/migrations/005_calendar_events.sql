-- Calendar events are planned dated commitments, modeled as activities with
-- scheduling-specific detail.
CREATE TABLE IF NOT EXISTS calendar_events (
    activity_id TEXT PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
    starts_at TEXT NOT NULL,
    ends_at TEXT,
    all_day INTEGER NOT NULL DEFAULT 0,
    location TEXT,
    source TEXT NOT NULL DEFAULT 'manual'
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_starts ON calendar_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_all_day ON calendar_events(all_day);
