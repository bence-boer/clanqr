-- Add estimated_cost column to agent_sessions for cost tracking
ALTER TABLE agent_sessions ADD COLUMN estimated_cost numeric(12, 6) NOT NULL DEFAULT 0;

-- Add index for cost-based queries
CREATE INDEX idx_agent_sessions_cost ON agent_sessions (estimated_cost) WHERE estimated_cost > 0;
