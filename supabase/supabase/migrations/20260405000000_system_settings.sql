-- System-wide settings key/value store.
-- Used for SDK defaults (model, reasoning effort, timeout) and system configuration.
CREATE TABLE IF NOT EXISTS system_settings (
    key   TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default settings
INSERT INTO system_settings (key, value) VALUES
    ('sdk_defaults', jsonb_build_object(
        'default_model', 'gpt-4.1',
        'default_reasoning_effort', 'medium',
        'default_timeout_minutes', 30,
        'max_concurrent_sessions', 3
    ))
ON CONFLICT (key) DO NOTHING;

CREATE TRIGGER trg_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
