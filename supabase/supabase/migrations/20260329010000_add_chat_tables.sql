-- Chat sessions and messages for SDK-backed chat
CREATE TABLE IF NOT EXISTS chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text,
    model text NOT NULL DEFAULT 'claude-sonnet-4.5',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);

CREATE TRIGGER trg_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all ON chat_sessions TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON chat_messages TO postgres USING (true) WITH CHECK (true);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260329010000', 'add_chat_tables')
ON CONFLICT (version) DO NOTHING;
