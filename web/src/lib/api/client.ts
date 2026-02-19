import { PUBLIC_API_URL } from "$env/static/public";
import type {
  AgentRun,
  ChatMessage,
  ChatSession,
  Feature,
  PipelineStatus,
  Project,
  PromptRecord,
  ResolvedTrait,
  SkillInfo,
  SkillLink,
  SystemStats,
  Task,
  Trait,
  TraitAssignment,
  UsageBreakdown,
  UsageSummary,
} from "$lib/types";

const BASE_URL = PUBLIC_API_URL || "";

async function api_fetch<ReturnType>(path: string, options?: RequestInit): Promise<ReturnType> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error ?? `API error: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // ── Projects ──────────────────────────────────────────────────────────────
  list_projects: () => api_fetch<Project[]>("/api/projects"),
  get_project: (id: string) => api_fetch<Project>(`/api/projects/${id}`),
  create_project: (data: { name: string; description?: string }) =>
    api_fetch<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) }),
  update_project: (id: string, data: Partial<Project>) =>
    api_fetch<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete_project: (id: string) =>
    api_fetch<{ success: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),

  // ── Features ──────────────────────────────────────────────────────────────
  list_features: (project_id?: string) => {
    const params = project_id ? `?project_id=${project_id}` : "";
    return api_fetch<Feature[]>(`/api/features${params}`);
  },
  get_feature: (id: string) => api_fetch<Feature>(`/api/features/${id}`),
  create_feature: (data: Partial<Feature>) =>
    api_fetch<Feature>("/api/features", { method: "POST", body: JSON.stringify(data) }),
  update_feature: (id: string, data: Partial<Feature>) =>
    api_fetch<Feature>(`/api/features/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  submit_feature: (id: string) =>
    api_fetch<Feature>(`/api/features/${id}/submit`, { method: "POST" }),
  delete_feature: (id: string) =>
    api_fetch<{ success: boolean }>(`/api/features/${id}`, { method: "DELETE" }),
  add_resource: (feature_id: string, data: { url: string; title?: string }) =>
    api_fetch<any>(`/api/features/${feature_id}/resources`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  delete_resource: (feature_id: string, resource_id: string) =>
    api_fetch<{ success: boolean }>(
      `/api/features/${feature_id}/resources/${resource_id}`,
      { method: "DELETE" }
    ),

  // ── Tasks ─────────────────────────────────────────────────────────────────
  list_tasks: (feature_id?: string, status?: string) => {
    const params = new URLSearchParams();
    if (feature_id) params.set("feature_id", feature_id);
    if (status) params.set("status", status);
    const qs = params.toString();
    return api_fetch<Task[]>(`/api/tasks${qs ? `?${qs}` : ""}`);
  },
  approve_task: (id: string) => api_fetch<Task>(`/api/tasks/${id}/approve`, { method: "POST" }),
  spawn_ralph: (id: string) => api_fetch<{ success: boolean }>(`/api/tasks/${id}/run`, { method: "POST" }),
  approve_all_tasks: (feature_id: string) =>
    api_fetch<Task[]>(`/api/tasks/approve-all/${feature_id}`, { method: "POST" }),

  // ── Agents / Pipeline ─────────────────────────────────────────────────────
  agent_status: () => api_fetch<Record<string, any>>("/api/agents/status"),
  agent_log: (task_id: string) => api_fetch<{ log: string }>(`/api/agents/log/${task_id}`),
  spawn_manager: (feature_id: string) =>
    api_fetch<any>(`/api/agents/spawn/manager/${feature_id}`, { method: "POST" }),
  stop_all_agents: () => api_fetch<any>("/api/agents/stop-all", { method: "POST" }),
  stop_agent: (task_id: string) =>
    api_fetch<any>(`/api/agents/stop/${task_id}`, { method: "POST" }),
  pipeline_status: () => api_fetch<PipelineStatus>("/api/agents/queue"),
  pipeline_log: () => api_fetch<{ log: string }>("/api/agents/queue/log"),
  pipeline_pause: () => api_fetch<{ success: boolean }>("/api/agents/pause", { method: "POST" }),
  pipeline_resume: () =>
    api_fetch<{ success: boolean }>("/api/agents/resume", { method: "POST" }),
  pipeline_stop_current: () =>
    api_fetch<{ success: boolean }>("/api/agents/stop-current", { method: "POST" }),

  // ── Prompts ───────────────────────────────────────────────────────────────
  list_prompts: () => api_fetch<PromptRecord[]>("/api/prompts"),
  get_prompt: (role: string) => api_fetch<PromptRecord>(`/api/prompts/${role}`),
  update_prompt: (role: string, content: string) =>
    api_fetch<PromptRecord>(`/api/prompts/${role}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }),
  sync_prompts: () => api_fetch<{ success: boolean }>("/api/prompts/sync", { method: "POST" }),

  // ── Traits ────────────────────────────────────────────────────────────────
  list_traits: (target?: "manager" | "ralph") => {
    const params = target ? `?target=${target}` : "";
    return api_fetch<Trait[]>(`/api/traits${params}`);
  },
  get_trait: (id: string) => api_fetch<Trait>(`/api/traits/${id}`),
  create_trait: (data: Omit<Trait, "id" | "created_at" | "updated_at">) =>
    api_fetch<Trait>("/api/traits", { method: "POST", body: JSON.stringify(data) }),
  update_trait: (id: string, data: Partial<Trait>) =>
    api_fetch<Trait>(`/api/traits/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete_trait: (id: string) =>
    api_fetch<{ success: boolean }>(`/api/traits/${id}`, { method: "DELETE" }),
  assign_trait: (data: Partial<TraitAssignment>) =>
    api_fetch<TraitAssignment>("/api/traits/assign", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  remove_trait_assignment: (id: string) =>
    api_fetch<{ success: boolean }>(`/api/traits/assign/${id}`, { method: "DELETE" }),
  resolve_task_traits: (task_id: string) =>
    api_fetch<ResolvedTrait[]>(`/api/traits/resolve/${task_id}`),
  resolve_feature_traits: (feature_id: string) =>
    api_fetch<ResolvedTrait[]>(`/api/traits/resolve/feature/${feature_id}`),

  // ── Skills ────────────────────────────────────────────────────────────────
  list_skills: () =>
    api_fetch<Omit<SkillInfo, "content">[]>("/api/skills"),
  get_skill: (name: string) => api_fetch<SkillInfo>(`/api/skills/${encodeURIComponent(name)}`),
  refresh_skills: () => api_fetch<{ refreshed: number }>("/api/skills/refresh", { method: "POST" }),
  get_task_skills: (task_id: string) => api_fetch<SkillLink[]>(`/api/skills/task/${task_id}`),
  link_skill: (task_id: string, skill_name: string) =>
    api_fetch<SkillLink>("/api/skills/link", {
      method: "POST",
      body: JSON.stringify({ task_id, skill_name }),
    }),
  unlink_skill: (id: string) =>
    api_fetch<{ success: boolean }>(`/api/skills/link/${id}`, { method: "DELETE" }),

  // ── System ────────────────────────────────────────────────────────────────
  system_stats: () => api_fetch<SystemStats>("/api/system/stats"),

  // ── Usage ─────────────────────────────────────────────────────────────────
  usage_summary: () => api_fetch<UsageSummary>("/api/usage/summary"),
  usage_history: (page = 1, per_page = 20, type?: string, status?: string) => {
    const params = new URLSearchParams({ page: String(page), per_page: String(per_page) });
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    return api_fetch<{ runs: AgentRun[]; total: number; page: number; per_page: number; total_pages: number }>(
      `/api/usage/history?${params}`
    );
  },
  usage_breakdown: () => api_fetch<UsageBreakdown>("/api/usage/breakdown"),

  // ── Chat ──────────────────────────────────────────────────────────────────
  list_chat_sessions: () => api_fetch<ChatSession[]>("/api/chat/sessions"),
  get_chat_session: (id: string) =>
    api_fetch<ChatSession & { messages: ChatMessage[] }>(`/api/chat/sessions/${id}`),
  create_chat_session: (data: { title?: string; model?: string }) =>
    api_fetch<ChatSession>("/api/chat/sessions", { method: "POST", body: JSON.stringify(data) }),
  delete_chat_session: (id: string) =>
    api_fetch<{ success: boolean }>(`/api/chat/sessions/${id}`, { method: "DELETE" }),
  send_chat_message: async (session_id: string, content: string): Promise<Response> => {
    const response = await fetch(`${BASE_URL}/api/chat/sessions/${session_id}/send`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error ?? `API error: ${response.status}`);
    }
    return response;
  },
  chat_stream_url: (session_id: string) =>
    `${BASE_URL}/api/chat/sessions/${session_id}/stream`,
};

