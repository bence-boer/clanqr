-- Add cli column to features and agent_runs to support both copilot and gemini CLI selection
ALTER TABLE features ADD COLUMN IF NOT EXISTS cli TEXT DEFAULT 'copilot';
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS cli TEXT DEFAULT 'copilot';
