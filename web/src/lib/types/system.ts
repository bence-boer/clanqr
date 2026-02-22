export interface SystemStats {
    cpu_percent: number;
    cpu_temp_celsius: number | null;
    memory_total_mb: number;
    memory_used_mb: number;
    memory_percent: number;
    storage_total_gb: number;
    storage_used_gb: number;
    storage_percent: number;
    uptime_seconds: number;
}

export interface UsageSummary {
    total_runs: number;
    today_runs: number;
    week_runs: number;
    completed_runs: number;
    failed_runs: number;
    total_duration_ms: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
}

export interface UsageBreakdown {
    by_type: Record<string, number>;
    by_model: Record<string, number>;
    by_status: Record<string, number>;
}

export interface ChatSession {
    id: string;
    title: string | null;
    model: string;
    created_at: string;
    updated_at: string;
    messages?: ChatMessage[];
}

export interface ChatMessage {
    id: string;
    session_id: string;
    role: "user" | "assistant" | "system";
    content: string;
    created_at: string;
}
