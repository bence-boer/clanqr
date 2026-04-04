-- Consolidate duplicate token columns.
-- session_runner wrote to tokens_input/tokens_output while
-- usage_service and frontend read prompt_tokens/completion_tokens.
-- Copy any non-zero data to the canonical columns, then drop the duplicates.

UPDATE agent_sessions
SET prompt_tokens = tokens_input
WHERE tokens_input > 0 AND prompt_tokens = 0;

UPDATE agent_sessions
SET completion_tokens = tokens_output
WHERE tokens_output > 0 AND completion_tokens = 0;

ALTER TABLE agent_sessions DROP COLUMN IF EXISTS tokens_input;
ALTER TABLE agent_sessions DROP COLUMN IF EXISTS tokens_output;
