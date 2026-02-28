// Domain-organized type re-exports
export type { Project, Feature, Resource, Task } from "./project";
export type { User, InviteToken, InviteStatus } from "./auth";
export type { AgentProcess, AgentRun, PipelineStatus } from "./pipeline";
export type { Trait, TraitAssignment, ResolvedTrait, PromptRecord, SkillInfo, SkillLink } from "./prompts";
export type { SystemStats, SystemAlert, UsageSummary, UsageBreakdown, ChatSession, ChatMessage } from "./system";
export type { MaterialSymbol } from "./material-symbols";

// Re-export shared status types for convenience
export type {
    FeatureStatus,
    TaskStatus,
    AgentRunStatus,
    AgentRunType,
    ProjectStatus,
    UserRole,
    TraitTarget,
    TraitScope,
    FailureBehavior,
    PipelineState,
    MessageRole,
} from "@shared/types";
