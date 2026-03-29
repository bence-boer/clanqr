-- Reconciliation migration: restores tables/columns dropped by nuke_and_rebuild
-- and adds new columns for the Copilot SDK migration.
-- All statements use IF NOT EXISTS / IF NOT EXISTS for idempotency.

-- ============================================================================
-- 1. Passkeys table (WebAuthn credentials — the auth model)
-- ============================================================================
CREATE TABLE IF NOT EXISTS passkeys (
    id          TEXT PRIMARY KEY,
    credential_id TEXT UNIQUE NOT NULL,
    public_key  TEXT NOT NULL,
    counter     BIGINT NOT NULL DEFAULT 0,
    device_type TEXT NOT NULL DEFAULT 'singleDevice',
    backed_up   BOOLEAN NOT NULL DEFAULT false,
    transports  TEXT,
    display_name TEXT,
    role        TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'user')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id ON passkeys(credential_id);

ALTER TABLE passkeys ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'passkeys' AND policyname = 'service_role_all') THEN
        CREATE POLICY service_role_all ON passkeys FOR ALL TO postgres USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- 2. Invite tokens table
-- ============================================================================
CREATE TABLE IF NOT EXISTS invite_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token       TEXT UNIQUE NOT NULL,
    role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    label       TEXT,
    created_by_passkey_id TEXT REFERENCES passkeys(id) ON DELETE SET NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    used_by_passkey_id TEXT REFERENCES passkeys(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_expires_at ON invite_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_used_at ON invite_tokens(used_at);

ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invite_tokens' AND policyname = 'service_role_all') THEN
        CREATE POLICY service_role_all ON invite_tokens FOR ALL TO postgres USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- 3. Sessions: add passkey_id column, make user_id nullable for passkey auth
-- ============================================================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sessions' AND column_name = 'passkey_id'
    ) THEN
        ALTER TABLE sessions ADD COLUMN passkey_id TEXT REFERENCES passkeys(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Passkey-based auth creates sessions without a users table entry
ALTER TABLE sessions ALTER COLUMN user_id DROP NOT NULL;

-- ============================================================================
-- 4. Features: add model columns
-- ============================================================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'features' AND column_name = 'model'
    ) THEN
        ALTER TABLE features ADD COLUMN model TEXT DEFAULT NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'features' AND column_name = 'planning_model'
    ) THEN
        ALTER TABLE features ADD COLUMN planning_model TEXT DEFAULT NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'features' AND column_name = 'execution_model'
    ) THEN
        ALTER TABLE features ADD COLUMN execution_model TEXT DEFAULT NULL;
    END IF;
END $$;

-- ============================================================================
-- 5. Tasks: add model and agent_log columns
-- ============================================================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'model'
    ) THEN
        ALTER TABLE tasks ADD COLUMN model TEXT DEFAULT NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'agent_log'
    ) THEN
        ALTER TABLE tasks ADD COLUMN agent_log TEXT DEFAULT NULL;
    END IF;
END $$;

-- ============================================================================
-- 6. Agent sessions: add SDK columns
-- ============================================================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'agent_sessions' AND column_name = 'sdk_session_id'
    ) THEN
        ALTER TABLE agent_sessions ADD COLUMN sdk_session_id TEXT DEFAULT NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'agent_sessions' AND column_name = 'tokens_input'
    ) THEN
        ALTER TABLE agent_sessions ADD COLUMN tokens_input INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'agent_sessions' AND column_name = 'tokens_output'
    ) THEN
        ALTER TABLE agent_sessions ADD COLUMN tokens_output INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- ============================================================================
-- 7. Audit events table (new for SDK)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    agent_type  TEXT,
    entity_id   TEXT,
    entity_type TEXT,
    payload     JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_session ON audit_events(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at);

-- ============================================================================
-- 8. Record this migration in the tracking table
-- ============================================================================
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260329000000', 'reconcile_post_nuke')
ON CONFLICT (version) DO NOTHING;
