import type { AgentRunStatus, AgentRunType, PipelineState } from "@shared/types";
import type { Task } from "./project";

export interface AgentProcess {
    task_id: string;
    type: "manager" | "ralph";
    status: AgentRunStatus;
    started_at: string;
    finished_at?: string;
    log: string;
}

export interface AgentRun {
    id: string;
    type: AgentRunType;
    feature_id: string | null;
    task_id: string | null;
    session_id: string | null;
    status: AgentRunStatus;
    cli: string;
    model: string | null;
    prompt_tokens: number | null;
    completion_tokens: number | null;
    duration_ms: number | null;
    log: string | null;
    error: string | null;
    summary: string | null;
    files_changed: string[] | null;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
}

export interface PipelineStatus {
    state: PipelineState;
    current_task: (Task & { feature_title: string; project_name: string }) | null;
    current_run_id: string | null;
    queue_depth: number;
}
