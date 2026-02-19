import { PUBLIC_API_URL } from "$env/static/public";

const BASE_URL = PUBLIC_API_URL || "";

async function api_fetch<T>(path: string, options?: RequestInit): Promise<T> {
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
  // Projects
  list_projects: () => api_fetch<any[]>("/api/projects"),
  get_project: (id: string) => api_fetch<any>(`/api/projects/${id}`),
  create_project: (data: { name: string; description?: string }) =>
    api_fetch<any>("/api/projects", { method: "POST", body: JSON.stringify(data) }),
  update_project: (id: string, data: any) =>
    api_fetch<any>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete_project: (id: string) =>
    api_fetch<any>(`/api/projects/${id}`, { method: "DELETE" }),

  // Features
  list_features: (project_id?: string) => {
    const params = project_id ? `?project_id=${project_id}` : "";
    return api_fetch<any[]>(`/api/features${params}`);
  },
  get_feature: (id: string) => api_fetch<any>(`/api/features/${id}`),
  create_feature: (data: any) =>
    api_fetch<any>("/api/features", { method: "POST", body: JSON.stringify(data) }),
  update_feature: (id: string, data: any) =>
    api_fetch<any>(`/api/features/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  submit_feature: (id: string) =>
    api_fetch<any>(`/api/features/${id}/submit`, { method: "POST" }),
  delete_feature: (id: string) =>
    api_fetch<any>(`/api/features/${id}`, { method: "DELETE" }),
  add_resource: (feature_id: string, data: { url: string; title?: string }) =>
    api_fetch<any>(`/api/features/${feature_id}/resources`, { method: "POST", body: JSON.stringify(data) }),
  delete_resource: (feature_id: string, resource_id: string) =>
    api_fetch<any>(`/api/features/${feature_id}/resources/${resource_id}`, { method: "DELETE" }),

  // Tasks
  list_tasks: (feature_id?: string, status?: string) => {
    const params = new URLSearchParams();
    if (feature_id) params.set("feature_id", feature_id);
    if (status) params.set("status", status);
    const qs = params.toString();
    return api_fetch<any[]>(`/api/tasks${qs ? `?${qs}` : ""}`);
  },
  approve_task: (id: string) =>
    api_fetch<any>(`/api/tasks/${id}/approve`, { method: "POST" }),
  approve_all_tasks: (feature_id: string) =>
    api_fetch<any[]>(`/api/tasks/approve-all/${feature_id}`, { method: "POST" }),

  // Agents
  agent_status: () => api_fetch<Record<string, any>>("/api/agents/status"),
  agent_log: (task_id: string) => api_fetch<{ log: string }>(`/api/agents/log/${task_id}`),
  spawn_manager: (feature_id: string) =>
    api_fetch<any>(`/api/agents/spawn/manager/${feature_id}`, { method: "POST" }),
  spawn_ralph: (task_id: string) =>
    api_fetch<any>(`/api/agents/spawn/ralph/${task_id}`, { method: "POST" }),
  stop_all_agents: () =>
    api_fetch<any>("/api/agents/stop-all", { method: "POST" }),
  stop_agent: (task_id: string) =>
    api_fetch<any>(`/api/agents/stop/${task_id}`, { method: "POST" }),
};
