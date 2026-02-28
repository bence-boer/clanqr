BEGIN;

-- M-2.2: Add manager failure tracking to features
ALTER TABLE features ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE features ADD COLUMN IF NOT EXISTS manager_retry_count INTEGER NOT NULL DEFAULT 0;

-- M-2.3: Add 'Skipped' to task_status enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'Skipped'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'task_status')
    ) THEN
        ALTER TYPE task_status ADD VALUE 'Skipped';
    END IF;
END
$$;

COMMIT;
