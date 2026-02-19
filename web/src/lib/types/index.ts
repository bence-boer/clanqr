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
