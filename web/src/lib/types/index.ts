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
  on_task_failure: "stop" | "skip" | "retry";
  auto_approve: boolean;
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
}

export interface Task {
  id: string;
  feature_id: string;
  description: string;
  status: "Pending_Approval" | "Approved" | "In_Progress" | "Complete";
  agent_log: string | null;
  sort_order: number;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
}

export interface AgentProcess {
  task_id: string;
  type: "manager" | "ralph";
  status: "running" | "completed" | "failed" | "stopped";
  started_at: string;
  finished_at?: string;
  log: string;
}

export interface AgentRun {
  id: string;
  type: "manager" | "ralph" | "chat";
  reference_id: string | null;
  status: "queued" | "running" | "completed" | "failed" | "stopped";
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  duration_ms: number | null;
  log: string | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface Trait {
  id: string;
  name: string;
  description: string | null;
  target: "manager" | "ralph";
  content: string;
  is_global: boolean;
  created_at: string;
  updated_at: string;
  assignment_count?: number;
}

export interface TraitAssignment {
  id: string;
  trait_id: string;
  scope: "project" | "feature" | "task";
  project_id: string | null;
  feature_id: string | null;
  task_id: string | null;
  is_excluded: boolean;
  assigned_by: string;
  created_at: string;
  traits?: Trait;
}

export interface ResolvedTrait {
  id: string;
  name: string;
  description: string | null;
  target: string;
  content: string;
  is_global: boolean;
  scope_source: "global" | "project" | "feature" | "task";
}

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  content: string;
  files?: { name: string; content: string }[];
}

export interface SkillLink {
  id: string;
  task_id: string;
  skill_name: string;
  skill_path: string | null;
  assigned_by: string;
  created_at: string;
}

export interface PipelineStatus {
  state: "idle" | "running" | "paused";
  current_task: (Task & { feature_title: string; project_name: string }) | null;
  current_run_id: string | null;
  queue_depth: number;
}

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
  role: "user" | "assistant";
  content: string;
  created_at: string;
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

export interface PromptRecord {
  id: string;
  role: "manager" | "ralph";
  content: string;
  version: number;
  updated_at: string;
}
