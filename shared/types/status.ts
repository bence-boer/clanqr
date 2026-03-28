// Status and enum types matching the PostgreSQL schema.
// These are the source of truth shared between server/ and web/.

export type UserRole = 'admin' | 'member';

export type ProjectStatus = 'active' | 'archived' | 'planning';

export type FeatureStatus = 'draft' | 'submitted' | 'in_progress' | 'done' | 'cancelled';

export type TaskStatus = 'queued' | 'approved' | 'in_progress' | 'complete' | 'failed' | 'skipped';

export type AgentType = 'manager' | 'ralph' | 'researcher' | 'editor' | 'chat' | 'custom';

export type AgentSessionStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type FailureBehavior = 'stop' | 'skip' | 'retry';

export type ResourceStatus = 'pending' | 'fetched' | 'error';

export type AssignmentScope = 'project' | 'feature' | 'task';

export type MessageRole = 'user' | 'assistant' | 'system';
