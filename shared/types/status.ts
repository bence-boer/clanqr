/** Shared status union types — single source of truth for both server and web */

export type FeatureStatus = "Draft" | "Submitted" | "In_Progress" | "Done";
export type TaskStatus = "Pending_Approval" | "Approved" | "In_Progress" | "Complete" | "Failed" | "Skipped";
export type AgentRunStatus = "queued" | "running" | "completed" | "failed" | "stopped";
export type AgentRunType = "manager" | "ralph" | "chat";
export type ProjectStatus = "Active" | "Archived" | "Planning";
export type UserRole = "admin" | "user";
export type TraitTarget = "manager" | "ralph";
export type TraitScope = "project" | "feature" | "task";
export type FailureBehavior = "stop" | "retry" | "skip";
export type PipelineState = "idle" | "running" | "paused";
export type MessageRole = "user" | "assistant" | "system";
