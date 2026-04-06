-- ============================================================================
-- Migration: 20260406120000_v2_agent_orchestration.sql
--
-- V2 agent orchestration pipeline rewrite.
--
-- Replaces the flat manager→ralph pipeline with a multi-agent DAG:
--   orchestrator → explorer → architect → implementer(s) → verifier → reviewer
--
-- Structural changes:
--   1. agent_type enum: replace {manager,ralph,editor} with
--      {orchestrator,explorer,architect,implementer,verifier,reviewer,synthesizer}
--   2. New enums: execution_strategy, verification_status
--   3. tasks: +8 columns for agent assignment, execution, and verification
--   4. task_dependencies: DAG edges between tasks
--   5. pipeline_waves: parallel execution wave grouping per feature
--   6. Indexes and RLS for new structures
--
-- Prerequisite: 20260406000000_consolidate_token_columns.sql
-- ============================================================================

-- ============================================================================
-- PHASE 1: CREATE NEW ENUM TYPES
-- ============================================================================

CREATE TYPE execution_strategy  AS ENUM ('sequential', 'parallel', 'background');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected', 'skipped');

-- ============================================================================
-- PHASE 2: MIGRATE agent_type ENUM
--
-- Strategy: ADD new values → UPDATE rows → RENAME old type → CREATE clean
-- type → ALTER columns via text cast → DROP old type.
-- ============================================================================

ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'orchestrator';
ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'explorer';
ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'architect';
ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'implementer';
ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'verifier';
ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'reviewer';
ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'synthesizer';

UPDATE agent_sessions SET agent_type = 'orchestrator' WHERE agent_type = 'manager';
UPDATE agent_sessions SET agent_type = 'implementer'  WHERE agent_type = 'ralph';
UPDATE agent_sessions SET agent_type = 'implementer'  WHERE agent_type = 'editor';

UPDATE prompts SET agent_type = 'orchestrator' WHERE agent_type = 'manager';
UPDATE prompts SET agent_type = 'implementer'  WHERE agent_type = 'ralph';
UPDATE prompts SET agent_type = 'implementer'  WHERE agent_type = 'editor';

UPDATE traits SET target = 'orchestrator' WHERE target = 'manager';
UPDATE traits SET target = 'implementer'  WHERE target = 'ralph';
UPDATE traits SET target = 'implementer'  WHERE target = 'editor';

ALTER TYPE agent_type RENAME TO agent_type_v1;

CREATE TYPE agent_type AS ENUM (
    'orchestrator', 'explorer', 'architect', 'implementer',
    'verifier', 'reviewer', 'synthesizer',
    'researcher', 'chat', 'custom'
);

ALTER TABLE agent_sessions
    ALTER COLUMN agent_type TYPE agent_type USING agent_type::text::agent_type;
ALTER TABLE prompts
    ALTER COLUMN agent_type TYPE agent_type USING agent_type::text::agent_type;
ALTER TABLE traits
    ALTER COLUMN target TYPE agent_type USING target::text::agent_type;

DROP TYPE agent_type_v1;

-- ============================================================================
-- PHASE 3: EXPAND TASKS TABLE
-- ============================================================================

ALTER TABLE tasks
    ADD COLUMN agent_type              agent_type          NOT NULL DEFAULT 'implementer',
    ADD COLUMN execution_strategy      execution_strategy  NOT NULL DEFAULT 'sequential',
    ADD COLUMN definition_of_done      TEXT,
    ADD COLUMN skills                  JSONB               DEFAULT '[]'::jsonb,
    ADD COLUMN context_paths           JSONB               DEFAULT '[]'::jsonb,
    ADD COLUMN wave_number             INTEGER             DEFAULT 0,
    ADD COLUMN verification_status     verification_status NOT NULL DEFAULT 'pending',
    ADD COLUMN verification_session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL;

-- ============================================================================
-- PHASE 4: NEW TABLES
-- ============================================================================

CREATE TABLE task_dependencies (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id            UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_at         TIMESTAMPTZ DEFAULT now(),
    UNIQUE (task_id, depends_on_task_id),
    CHECK  (task_id != depends_on_task_id)
);

CREATE TABLE pipeline_waves (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_id     UUID        NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    wave_number    INTEGER     NOT NULL,
    status         TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'running', 'complete', 'failed')),
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE (feature_id, wave_number)
);

-- ============================================================================
-- PHASE 5: INDEXES
-- ============================================================================

CREATE INDEX idx_task_deps_depends_on ON task_dependencies(depends_on_task_id);
CREATE INDEX idx_tasks_feature_wave ON tasks(feature_id, wave_number);

-- ============================================================================
-- PHASE 6: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_waves    ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all ON task_dependencies TO postgres USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON pipeline_waves    TO postgres USING (true) WITH CHECK (true);
