BEGIN;

ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS files_changed text[];

COMMIT;
