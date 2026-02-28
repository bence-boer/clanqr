export interface Project {
    id: string;
    name: string;
    description: string | null;
    status: "Active" | "Archived";
    created_at: string;
    updated_at: string;
    features?: Feature[];
}

export interface Feature {
    id: string;
    project_id: string;
    title: string;
    description: string | null;
    status: "Draft" | "Submitted" | "In_Progress" | "Done";
    cli: string;
    model: string | null;
    on_task_failure: "stop" | "skip" | "retry";
    auto_approve: boolean;
    last_error: string | null;
    manager_retry_count: number;
    created_at: string;
    updated_at: string;
    resources?: Resource[];
    tasks?: Task[];
}

export interface Resource {
    id: string;
    feature_id: string;
    url: string;
    title: string | null;
    status: "Pending" | "Fetched" | "Error";
    created_at: string;
    updated_at: string;
}

export interface Task {
    id: string;
    feature_id: string;
    description: string;
    status: "Pending_Approval" | "Approved" | "In_Progress" | "Complete" | "Skipped";
    agent_log: string | null;
    sort_order: number;
    retry_count: number;
    max_retries: number;
    created_at: string;
    updated_at: string;
}
