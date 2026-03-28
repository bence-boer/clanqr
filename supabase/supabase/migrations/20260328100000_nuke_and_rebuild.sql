-- ============================================================================
-- Migration: 20260328100000_nuke_and_rebuild.sql
--
-- Nuclear migration: drops all existing tables, enums, functions, and triggers.
-- Rebuilds schema for GitHub OAuth auth + copilot-sdk agent sessions.
-- Pre-alpha — zero backward compatibility.
--
-- Schema Diagram:
--
--   users ──< sessions
--     │
--     ├──(created_by)──< projects ──< features ──< tasks ──< task_artifacts
--     │                                  │           │
--     │                                  │           ├──< agent_sessions ──< agent_events
--     │                                  │           │                   ──< agent_tool_calls
--     │                                  │           ├──< skill_links
--     │                                  │           └──< trait_assignments
--     │                                  ├──< resources
--     │                                  ├──< agent_sessions
--     │                                  ├──< skill_links
--     │                                  └──< trait_assignments
--     │
--     └──(assigned_by)──< trait_assignments, skill_links
--
--   prompts                (standalone, versioned per agent_type)
--   traits ──< trait_assignments
--   mcp_server_configs     (standalone)
--
-- ============================================================================

-- ============================================================================
-- PHASE 1: DROP EVERYTHING
-- ============================================================================

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS skill_links CASCADE;
DROP TABLE IF EXISTS trait_assignments CASCADE;
DROP TABLE IF EXISTS task_artifacts CASCADE;
DROP TABLE IF EXISTS agent_tool_calls CASCADE;
DROP TABLE IF EXISTS agent_events CASCADE;
DROP TABLE IF EXISTS agent_runs CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS features CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS invite_tokens CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS passkeys CASCADE;
DROP TABLE IF EXISTS traits CASCADE;
DROP TABLE IF EXISTS prompts CASCADE;

-- Drop all existing enums
DROP TYPE IF EXISTS agent_run_status CASCADE;
DROP TYPE IF EXISTS agent_type CASCADE;
DROP TYPE IF EXISTS assignment_scope CASCADE;
DROP TYPE IF EXISTS failure_behavior CASCADE;
DROP TYPE IF EXISTS feature_status CASCADE;
DROP TYPE IF EXISTS project_status CASCADE;
DROP TYPE IF EXISTS prompt_role CASCADE;
DROP TYPE IF EXISTS resource_status CASCADE;
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS trait_target CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================================================
-- PHASE 2: CREATE ENUMS (9)
-- ============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'member');
CREATE TYPE project_status AS ENUM ('active', 'archived', 'planning');
CREATE TYPE feature_status AS ENUM ('draft', 'submitted', 'in_progress', 'done', 'cancelled');
CREATE TYPE task_status AS ENUM ('queued', 'approved', 'in_progress', 'complete', 'failed', 'skipped');
CREATE TYPE agent_type AS ENUM ('manager', 'ralph', 'researcher', 'editor', 'chat', 'custom');
CREATE TYPE agent_session_status AS ENUM ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled');
CREATE TYPE failure_behavior AS ENUM ('stop', 'skip', 'retry');
CREATE TYPE resource_status AS ENUM ('pending', 'fetched', 'error');
CREATE TYPE assignment_scope AS ENUM ('project', 'feature', 'task');

-- ============================================================================
-- PHASE 3: CREATE TABLES (15, in dependency order)
-- ============================================================================

-- 1. users (no FKs)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id BIGINT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    email TEXT,
    role user_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. sessions (FK → users)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    github_access_token TEXT,
    github_refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. projects (FK → users)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    status project_status NOT NULL DEFAULT 'active',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. features (FK → projects, users)
CREATE TABLE features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status feature_status NOT NULL DEFAULT 'draft',
    auto_approve BOOLEAN NOT NULL DEFAULT false,
    on_task_failure failure_behavior NOT NULL DEFAULT 'stop',
    task_timeout_minutes INTEGER NOT NULL DEFAULT 30,
    manager_retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. tasks (FK → features, users)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT NOT NULL,
    status task_status NOT NULL DEFAULT 'queued',
    sort_order INTEGER NOT NULL DEFAULT 0,
    output TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. resources (FK → features)
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    status resource_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. agent_sessions (FK → features, tasks, users) — before task_artifacts
CREATE TABLE agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE,
    agent_type agent_type NOT NULL,
    status agent_session_status NOT NULL DEFAULT 'pending',
    feature_id UUID REFERENCES features(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    model TEXT,
    source TEXT NOT NULL DEFAULT 'new',
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    summary TEXT,
    error TEXT,
    files_changed TEXT[],
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. task_artifacts (FK → tasks, agent_sessions)
CREATE TABLE task_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    agent_session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. agent_events (FK → agent_sessions)
CREATE TABLE agent_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. agent_tool_calls (FK → agent_sessions)
CREATE TABLE agent_tool_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    tool_call_id TEXT,
    tool_name TEXT NOT NULL,
    tool_type TEXT,
    mcp_server_name TEXT,
    arguments JSONB,
    result_success BOOLEAN,
    result_summary TEXT,
    error_message TEXT,
    duration_ms INTEGER,
    permission_decision TEXT,
    was_suppressed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. prompts (no FKs)
CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type agent_type NOT NULL,
    content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. traits (no FKs)
CREATE TABLE traits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    target agent_type NOT NULL,
    is_global BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. trait_assignments (FK → traits, projects, features, tasks, users)
CREATE TABLE trait_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trait_id UUID NOT NULL REFERENCES traits(id) ON DELETE CASCADE,
    scope assignment_scope NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    feature_id UUID REFERENCES features(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    is_excluded BOOLEAN NOT NULL DEFAULT false,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. skill_links (FK → projects, features, tasks, users)
CREATE TABLE skill_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_name TEXT NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    feature_id UUID REFERENCES features(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. mcp_server_configs (no FKs)
CREATE TABLE mcp_server_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    server_type TEXT NOT NULL,
    command TEXT,
    args TEXT[],
    env JSONB,
    url TEXT,
    is_global BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PHASE 4: CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_features_project_status ON features(project_id, status);
CREATE INDEX idx_tasks_feature_sort ON tasks(feature_id, sort_order);
CREATE INDEX idx_tasks_queued ON tasks(feature_id, sort_order) WHERE status = 'approved';
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_agent_sessions_active ON agent_sessions(status, created_at)
    WHERE status IN ('pending', 'running');
CREATE INDEX idx_agent_sessions_feature ON agent_sessions(feature_id, created_at);
CREATE INDEX idx_agent_sessions_task ON agent_sessions(task_id, created_at);
CREATE INDEX idx_agent_sessions_type ON agent_sessions(agent_type);
CREATE INDEX idx_agent_events_session_type ON agent_events(agent_session_id, event_type, created_at);
CREATE INDEX idx_agent_tool_calls_session ON agent_tool_calls(agent_session_id, created_at);
CREATE INDEX idx_trait_assignments_project ON trait_assignments(project_id);
CREATE INDEX idx_trait_assignments_feature ON trait_assignments(feature_id);
CREATE INDEX idx_trait_assignments_task ON trait_assignments(task_id);
CREATE UNIQUE INDEX idx_prompts_active ON prompts(agent_type) WHERE is_active = true;
CREATE INDEX idx_skill_links_project ON skill_links(project_id);
CREATE INDEX idx_skill_links_feature ON skill_links(feature_id);
CREATE INDEX idx_skill_links_task ON skill_links(task_id);
CREATE INDEX idx_resources_feature ON resources(feature_id);

-- ============================================================================
-- PHASE 5: FUNCTIONS & TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_features_updated_at
    BEFORE UPDATE ON features FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_resources_updated_at
    BEFORE UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_agent_sessions_updated_at
    BEFORE UPDATE ON agent_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_prompts_updated_at
    BEFORE UPDATE ON prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_traits_updated_at
    BEFORE UPDATE ON traits FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_mcp_server_configs_updated_at
    BEFORE UPDATE ON mcp_server_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- PHASE 6: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE traits ENABLE ROW LEVEL SECURITY;
ALTER TABLE trait_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_server_configs ENABLE ROW LEVEL SECURITY;

-- Service-role bypass policies (server uses service_role key)
CREATE POLICY service_role_all ON users TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON sessions TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON projects TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON features TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON tasks TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON resources TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON agent_sessions TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON task_artifacts TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON agent_events TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON agent_tool_calls TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON prompts TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON traits TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON trait_assignments TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON skill_links TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON mcp_server_configs TO postgres USING (true) WITH CHECK (true);

-- ============================================================================
-- PHASE 7: SQL COMMENTS
-- ============================================================================

COMMENT ON COLUMN sessions.github_access_token IS 'SENSITIVE: Encrypt at application layer';
COMMENT ON COLUMN sessions.github_refresh_token IS 'SENSITIVE: Encrypt at application layer';
