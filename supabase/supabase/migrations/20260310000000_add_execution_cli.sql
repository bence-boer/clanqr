-- Add separate execution_cli column so planning and execution can use different CLIs
ALTER TABLE features ADD COLUMN IF NOT EXISTS execution_cli text DEFAULT 'copilot';

-- Backfill: copy existing cli value to execution_cli for existing features
UPDATE features SET execution_cli = cli WHERE execution_cli IS NULL OR execution_cli = 'copilot';

-- Add check constraints for valid CLI values (drop first to be idempotent)
ALTER TABLE features DROP CONSTRAINT IF EXISTS features_cli_check;
ALTER TABLE features ADD CONSTRAINT features_cli_check CHECK (cli IN ('copilot', 'gemini'));
ALTER TABLE features DROP CONSTRAINT IF EXISTS features_execution_cli_check;
ALTER TABLE features ADD CONSTRAINT features_execution_cli_check CHECK (execution_cli IN ('copilot', 'gemini'));
