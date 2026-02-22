-- DB Tech Debt Fixes Migration
-- Addresses: DB-001, DB-002, DB-004, DB-005, DB-007, DB-008, DB-010, DB-012, DB-013, DB-014

-- =====================================================================
-- DB-004: Add missing time-range indexes for query performance
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON agent_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at);

-- =====================================================================
-- DB-005: Unique constraint on trait_assignments to prevent duplicates
-- =====================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_trait_assignments_unique
  ON trait_assignments(
    trait_id,
    scope,
    COALESCE(project_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(feature_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(task_id, '00000000-0000-0000-0000-000000000000')
  );

-- =====================================================================
-- DB-007: Add updated_at column and trigger to resources table
-- =====================================================================
ALTER TABLE resources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TRIGGER resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- DB-008: Add CHECK constraint on chat_messages.role
-- =====================================================================
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_role_check
  CHECK (role IN ('user', 'assistant', 'system'));

-- =====================================================================
-- DB-002 / DB-010: Redesign agent_runs with proper FK columns
-- Add separate nullable FK columns for feature, task, and session references
-- =====================================================================
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS feature_id UUID REFERENCES features(id) ON DELETE SET NULL;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL;

-- Migrate existing data from reference_id to the appropriate column based on type
UPDATE agent_runs SET feature_id = reference_id WHERE type = 'manager' AND reference_id IS NOT NULL;
UPDATE agent_runs SET task_id = reference_id WHERE type = 'ralph' AND reference_id IS NOT NULL;
UPDATE agent_runs SET session_id = reference_id WHERE type = 'chat' AND reference_id IS NOT NULL;

-- Add check constraint: at most one FK should be set, consistent with type
ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_reference_check CHECK (
  (type = 'manager' AND task_id IS NULL AND session_id IS NULL) OR
  (type = 'ralph' AND feature_id IS NULL AND session_id IS NULL) OR
  (type = 'chat' AND feature_id IS NULL AND task_id IS NULL)
);

-- Add indexes on the new FK columns
CREATE INDEX IF NOT EXISTS idx_agent_runs_feature_id ON agent_runs(feature_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_task_id ON agent_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_session_id ON agent_runs(session_id);

-- Drop the old generic reference_id column and its index
DROP INDEX IF EXISTS idx_agent_runs_reference;
ALTER TABLE agent_runs DROP COLUMN IF EXISTS reference_id;

-- =====================================================================
-- DB-012: Convert passkeys.transports from comma-separated TEXT to TEXT[]
-- =====================================================================
ALTER TABLE passkeys ADD COLUMN IF NOT EXISTS transports_arr TEXT[];

-- Migrate existing comma-separated data to array
UPDATE passkeys
  SET transports_arr = string_to_array(transports, ',')
  WHERE transports IS NOT NULL AND transports != '';

-- Drop old column and rename new one
ALTER TABLE passkeys DROP COLUMN IF EXISTS transports;
ALTER TABLE passkeys RENAME COLUMN transports_arr TO transports;

-- =====================================================================
-- DB-014: Remove skill_links.skill_path (environment-specific, derived at runtime)
-- =====================================================================
ALTER TABLE skill_links DROP COLUMN IF EXISTS skill_path;

-- =====================================================================
-- DB-001: Replace permissive RLS policies with service-role-only policies
-- Only the service_role (used by the backend) should have full access.
-- The anon role gets no access at all.
-- =====================================================================

-- projects
DROP POLICY IF EXISTS "Allow all on projects" ON projects;
CREATE POLICY "Service role full access on projects"
  ON projects FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

-- features
DROP POLICY IF EXISTS "Allow all on features" ON features;
CREATE POLICY "Service role full access on features"
  ON features FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

-- resources
DROP POLICY IF EXISTS "Allow all on resources" ON resources;
CREATE POLICY "Service role full access on resources"
  ON resources FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

-- tasks
DROP POLICY IF EXISTS "Allow all on tasks" ON tasks;
CREATE POLICY "Service role full access on tasks"
  ON tasks FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

-- prompts
DROP POLICY IF EXISTS "Allow all on prompts" ON prompts;
CREATE POLICY "Service role full access on prompts"
  ON prompts FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

-- traits
DROP POLICY IF EXISTS "Allow all on traits" ON traits;
CREATE POLICY "Service role full access on traits"
  ON traits FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

-- trait_assignments
DROP POLICY IF EXISTS "Allow all on trait_assignments" ON trait_assignments;
CREATE POLICY "Service role full access on trait_assignments"
  ON trait_assignments FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

-- skill_links
DROP POLICY IF EXISTS "Allow all on skill_links" ON skill_links;
CREATE POLICY "Service role full access on skill_links"
  ON skill_links FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

-- agent_runs
DROP POLICY IF EXISTS "Allow all on agent_runs" ON agent_runs;
CREATE POLICY "Service role full access on agent_runs"
  ON agent_runs FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

-- chat_sessions
DROP POLICY IF EXISTS "Allow all on chat_sessions" ON chat_sessions;
CREATE POLICY "Service role full access on chat_sessions"
  ON chat_sessions FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

-- chat_messages
DROP POLICY IF EXISTS "Allow all on chat_messages" ON chat_messages;
CREATE POLICY "Service role full access on chat_messages"
  ON chat_messages FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

-- passkeys (already had service role policy name, but was permissive)
DROP POLICY IF EXISTS "Service role full access on passkeys" ON passkeys;
CREATE POLICY "Service role full access on passkeys"
  ON passkeys FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

-- sessions
DROP POLICY IF EXISTS "Service role full access on sessions" ON sessions;
CREATE POLICY "Service role full access on sessions"
  ON sessions FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

-- invite_tokens
DROP POLICY IF EXISTS "Service role full access on invite_tokens" ON invite_tokens;
CREATE POLICY "Service role full access on invite_tokens"
  ON invite_tokens FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

-- =====================================================================
-- DB-013: Add COMMENT ON documentation for complex tables
-- =====================================================================
COMMENT ON TABLE agent_runs IS 'Records of agent executions (manager, ralph, chat). Each run is linked to exactly one entity via feature_id, task_id, or session_id based on the agent type.';
COMMENT ON COLUMN agent_runs.type IS 'Agent type: manager (plans features), ralph (executes tasks), chat (interactive sessions)';
COMMENT ON COLUMN agent_runs.feature_id IS 'FK to features — set when type=manager';
COMMENT ON COLUMN agent_runs.task_id IS 'FK to tasks — set when type=ralph';
COMMENT ON COLUMN agent_runs.session_id IS 'FK to chat_sessions — set when type=chat';

COMMENT ON TABLE trait_assignments IS 'Links traits to scoped entities (project, feature, or task). The valid_scope CHECK constraint ensures the correct ID columns are set per scope.';
COMMENT ON COLUMN trait_assignments.scope IS 'Determines which FK is active: project→project_id, feature→feature_id, task→task_id';
COMMENT ON COLUMN trait_assignments.is_excluded IS 'When true, this trait is removed from the resolved set at this scope level (overrides parent inclusion)';

COMMENT ON TABLE passkeys IS 'WebAuthn credential store. Uses TEXT PK (credential ID is a natural key from the WebAuthn spec, not a UUID).';
COMMENT ON COLUMN passkeys.transports IS 'Array of WebAuthn transport types (usb, ble, nfc, internal)';

COMMENT ON TABLE skill_links IS 'Associates skills (by name) to tasks for prompt resolution. skill_name is the natural key resolved at runtime from the filesystem.';
