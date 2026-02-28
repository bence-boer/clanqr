BEGIN;

-- M-5.2: Add missing indexes for query performance
-- (idx_features_status, idx_agent_runs_status, idx_agent_runs_feature_id already exist)

CREATE INDEX IF NOT EXISTS idx_tasks_feature_id_status ON tasks(feature_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);

-- M-5.3: Add 'Failed' to task_status enum (matches AGENTS.md §13 requirement)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'task_status'::regtype
        AND enumlabel = 'Failed'
    ) THEN
        ALTER TYPE task_status ADD VALUE 'Failed';
    END IF;
END
$$;

COMMIT;
