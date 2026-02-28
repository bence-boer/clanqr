BEGIN;

-- §4.7: Add CHECK constraint for features.cli column
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'features_cli_check'
    ) THEN
        ALTER TABLE features ADD CONSTRAINT features_cli_check
            CHECK (cli IS NULL OR cli IN ('copilot', 'gemini'));
    END IF;
END $$;

-- §4.8: Change agent_runs FK from SET NULL to CASCADE on feature deletion
-- Drop old FK and re-create with CASCADE
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'agent_runs_feature_id_fkey'
        AND table_name = 'agent_runs'
    ) THEN
        ALTER TABLE agent_runs DROP CONSTRAINT agent_runs_feature_id_fkey;
        ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_feature_id_fkey
            FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE;
    END IF;
END $$;

COMMIT;
