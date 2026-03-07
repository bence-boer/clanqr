/**
 * All types are inferred from the Hono RPC client.
 * The source of truth is the server's route definitions.
 */
import type { InferResponseType } from 'hono/client';
import type { AppType } from 'server/src/public';
import { hc } from 'hono/client';
import type { Database } from 'server/src/database.types';

// Extract Success Type helper to remove { error: string } responses
type ExtractSuccess<ResponseType> = Exclude<ResponseType, { error: unknown }>;

// Create a type-only client reference for InferResponseType usage
type Client = ReturnType<typeof hc<AppType>>;

// ── Shared DB Enums ───────────────────────────────────────────────────────────
export type FeatureStatus = Database['public']['Enums']['feature_status'];
export type TaskStatus = Database['public']['Enums']['task_status'];
export type ProjectStatus = Database['public']['Enums']['project_status'];
export type AgentRunStatus = Database['public']['Enums']['agent_run_status'];
export type FailureBehavior = Database['public']['Enums']['failure_behavior'];
export type MessageRole = 'user' | 'assistant' | 'system';
export type TraitTarget = Database['public']['Enums']['trait_target'];
export type TraitScope = Database['public']['Enums']['assignment_scope'];

// ── Projects ──────────────────────────────────────────────────────────────────
export type Project = ExtractSuccess<InferResponseType<Client['api']['projects']['$get']>>[number];
export type Feature = ExtractSuccess<InferResponseType<Client['api']['features']['$get']>>[number];
export type Resource = NonNullable<Feature['resources']>[number];

// ── Auth / Admin ──────────────────────────────────────────────────────────────
export type User = ExtractSuccess<InferResponseType<Client['api']['admin']['$get']>>[number];
export type InviteToken = ExtractSuccess<InferResponseType<Client['api']['admin']['invites']['$get']>>[number] & { token?: string };
export type InviteStatus = {
    valid: boolean
    reason?: 'missing' | 'not_found' | 'used' | 'expired'
    label?: string | null
    expires_at?: string
};

// ── Pipeline / Agents ─────────────────────────────────────────────────────────
export type PipelineStatus = ExtractSuccess<InferResponseType<Client['api']['agents']['queue']['$get']>>;
export type AgentProcess = ExtractSuccess<InferResponseType<Client['api']['agents']['status']['$get']>>[string];

// Agents/Feature returns abbreviated processes
export type AbbreviatedAgentProcess = {
    id: string
    type: 'manager' | 'ralph'
    status: AgentRunStatus
    started_at: string
    finished_at?: string
};

export type FeatureAgentStatus = {
    processes: AbbreviatedAgentProcess[]
    pipeline: {
        state: string
        is_active_feature: boolean
        current_task_id: string | null
    }
};

// AgentRun comes from the DB row for usage history
export type AgentRun = Database['public']['Tables']['agent_runs']['Row'];

// ── Prompts ───────────────────────────────────────────────────────────────────
export type PromptRecord = ExtractSuccess<InferResponseType<Client['api']['prompts']['$get']>>[number];

// ── Tasks ─────────────────────────────────────────────────────────────────────
export type Task = ExtractSuccess<InferResponseType<Client['api']['tasks']['$get']>>[number] & { features?: Feature | null, projects?: Project | null };

// ── Traits ────────────────────────────────────────────────────────────────────
export type Trait = ExtractSuccess<InferResponseType<Client['api']['traits']['$get']>>[number];
export type TraitAssignment = ExtractSuccess<InferResponseType<Client['api']['traits']['assign']['$get']>>[number];
export type ResolvedTrait = ExtractSuccess<InferResponseType<Client['api']['traits']['resolve'][':task_id']['$get']>>[number];

// ── Skills ────────────────────────────────────────────────────────────────────
export type SkillInfoListItem = ExtractSuccess<InferResponseType<Client['api']['skills']['$get']>>[number];
export type SkillInfo = ExtractSuccess<InferResponseType<Client['api']['skills'][':name']['$get']>>;
export type SkillLink = ExtractSuccess<InferResponseType<Client['api']['skills']['task'][':task_id']['$get']>>[number];

// ── System ────────────────────────────────────────────────────────────────────
export type SystemStats = ExtractSuccess<InferResponseType<Client['api']['system']['stats']['$get']>>;
export type SystemAlerts = ExtractSuccess<InferResponseType<Client['api']['system']['alerts']['$get']>>;
export type SystemAlert = SystemAlerts['alerts'][number];

export type ModelOption = {
    value: string
    label: string
};

// ── Usage ─────────────────────────────────────────────────────────────────────
export type UsageSummary = ExtractSuccess<InferResponseType<Client['api']['usage']['summary']['$get']>>;
export type UsageBreakdown = ExtractSuccess<InferResponseType<Client['api']['usage']['breakdown']['$get']>>;

// ── Chat ──────────────────────────────────────────────────────────────────────
export type ChatSession = ExtractSuccess<InferResponseType<Client['api']['chat']['sessions']['$get']>>[number];
export type ChatMessage = NonNullable<ExtractSuccess<InferResponseType<Client['api']['chat']['sessions'][':id']['$get']>>['chat_messages']>[number];
export type ChatSessionFull = { id: string, title: string | null, model: string, created_at: string, updated_at: string, messages: ChatMessage[] };

// Re-export material symbols (not API-derived)
export type { MaterialSymbol } from './material-symbols';
