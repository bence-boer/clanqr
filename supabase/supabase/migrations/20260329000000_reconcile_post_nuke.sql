-- Reconciliation migration: adds new columns for the Copilot SDK migration.
-- Builds on top of nuke_and_rebuild (GitHub OAuth schema).
-- All statements use IF NOT EXISTS for idempotency.

-- ============================================================================
-- 1. Features: add model columns for SDK agent selection
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
-- 2. Tasks: add model and agent_log columns
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
-- 3. Agent sessions: add SDK columns
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
-- 4. Audit events table (new for SDK)
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
-- 5. Fix prompts unique constraint for upsert support
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_agent_type ON prompts(agent_type);

-- ============================================================================
-- 6. Record this migration in the tracking table
-- ============================================================================
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260329000000', 'reconcile_post_nuke')
ON CONFLICT (version) DO NOTHING;
