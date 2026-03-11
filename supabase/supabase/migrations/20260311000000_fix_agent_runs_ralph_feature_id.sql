-- Allow ralph agent_runs to have a feature_id reference.
-- Previously the CHECK constraint forced feature_id IS NULL for ralph type,
-- but ralph agents ARE tied to features via tasks.
ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_reference_check;
ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_reference_check CHECK (
    (type = 'manager' AND task_id IS NULL AND session_id IS NULL) OR
    (type = 'ralph' AND session_id IS NULL) OR
    (type = 'chat' AND feature_id IS NULL AND task_id IS NULL)
);
