-- seed.sql — Development seed data for the redesigned schema.
-- Applied after all migrations by dev-db-reset.sh.

-- ============================================================================
-- Users
-- ============================================================================

INSERT INTO users (id, github_id, username, display_name, email, role) VALUES
    ('00000000-0000-0000-0000-000000000001', 1000001, 'dev-admin', 'Dev Admin', 'admin@localhost', 'admin'),
    ('00000000-0000-0000-0000-000000000002', 1000002, 'dev-user', 'Dev User', 'user@localhost', 'member')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Sessions (long-lived dev tokens, expire 2099)
-- ============================================================================

-- Tokens stored as SHA-256 hashes; raw cookie values:
--   dev-admin-session-token → 9f50b2867752ded53ca85822eaba1359afd250123e209021b56064424f749b47
--   dev-session-token       → 7fef60999ea6a84de15934221684243e184aff47f2383ab23e0b4e5b88c534af
INSERT INTO sessions (id, user_id, token, expires_at) VALUES
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '9f50b2867752ded53ca85822eaba1359afd250123e209021b56064424f749b47', '2099-12-31T23:59:59Z'),
    ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', '7fef60999ea6a84de15934221684243e184aff47f2383ab23e0b4e5b88c534af', '2099-12-31T23:59:59Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Projects
-- ============================================================================

INSERT INTO projects (id, name, description, status, created_by) VALUES
    ('00000000-0000-0000-0000-000000000101', 'Dev Project', 'Local development test project', 'active', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Features
-- ============================================================================

INSERT INTO features (id, project_id, title, description, status, auto_approve, created_by) VALUES
    ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'User Authentication', 'Implement GitHub OAuth login flow', 'draft', false, '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', 'Dashboard UI', 'Build the main dashboard with project overview', 'draft', true, '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Tasks
-- ============================================================================

INSERT INTO tasks (id, feature_id, title, description, status, sort_order, created_by) VALUES
    -- Auth feature tasks
    ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', 'OAuth callback handler', 'Create the /auth/callback route that exchanges the GitHub OAuth code for tokens', 'queued', 1, '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000201', 'Session middleware', 'Create auth middleware that validates session tokens from cookies', 'queued', 2, '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000201', 'Logout endpoint', 'Create /auth/logout that destroys the session', 'queued', 3, '00000000-0000-0000-0000-000000000001'),
    -- Dashboard feature tasks
    ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000202', 'Project list component', 'Build the project list page with status badges and creation dates', 'queued', 1, '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000202', 'Feature detail view', 'Build the feature detail page showing tasks and agent session history', 'queued', 2, '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Prompts (one active per agent_type)
-- ============================================================================

INSERT INTO prompts (id, agent_type, content, version, is_active) VALUES
    ('00000000-0000-0000-0000-000000000401', 'manager', 'You are a manager agent responsible for breaking down features into tasks and coordinating execution.', 1, true),
    ('00000000-0000-0000-0000-000000000402', 'ralph', 'You are Ralph, a software engineering agent. You implement tasks by writing code, running tests, and verifying your work.', 1, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Traits
-- ============================================================================

INSERT INTO traits (id, name, description, content, target, is_global) VALUES
    ('00000000-0000-0000-0000-000000000501', 'Thorough Testing', 'Ensures agents write comprehensive tests', 'Always write unit tests for new functions. Run the test suite before marking a task complete. Aim for >80% coverage on changed files.', 'ralph', true),
    ('00000000-0000-0000-0000-000000000502', 'Concise Planning', 'Keeps manager plans focused', 'Break features into no more than 5-7 tasks. Each task should be completable in under 30 minutes. Avoid overly granular decomposition.', 'manager', false),
    ('00000000-0000-0000-0000-000000000503', 'Security First', 'Emphasizes security in code changes', 'Validate all user inputs. Never store secrets in code. Check for injection vulnerabilities. Use parameterized queries.', 'ralph', true)
ON CONFLICT (id) DO NOTHING;

-- Project-scoped trait assignment
INSERT INTO trait_assignments (id, trait_id, scope, project_id, assigned_by) VALUES
    ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000502', 'project', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;
