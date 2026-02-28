BEGIN;

-- M-6.6: Add configurable task timeout per feature (default 10 minutes)
ALTER TABLE features ADD COLUMN IF NOT EXISTS task_timeout_minutes INTEGER NOT NULL DEFAULT 10;

COMMIT;
