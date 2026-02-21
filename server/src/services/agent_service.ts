import { type Subprocess } from "bun";
import type { SupabaseClient } from "../db";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const HOME = process.env.HOME ?? "/home/scoy";
const COPILOT_BIN =
  process.env.COPILOT_BIN ?? join(HOME, ".local/bin/copilot");
const ENRICHED_PATH = [
  join(HOME, ".local/bin"),
  join(HOME, ".bun/bin"),
  process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
].join(":");

interface AgentProcess {
  task_id: string;
  run_id?: string; // agent_runs table id
  type: "manager" | "ralph";
  process: Subprocess | null;
  status: "running" | "completed" | "failed" | "stopped";
  started_at: string;
  finished_at?: string;
  log: string;
}

const WORKSPACE_DIR = join(
  process.env.WORKSPACE_DIR ?? join(import.meta.dir, "../../.."),
  "agents/workspace"
);

class AgentService {
  private processes: Map<string, AgentProcess> = new Map();

  constructor() {
    if (!existsSync(WORKSPACE_DIR)) {
      mkdirSync(WORKSPACE_DIR, { recursive: true });
    }
  }

  get_all_processes() {
    const result: Record<string, Omit<AgentProcess, "process">> = {};
    for (const [id, proc] of this.processes) {
      const { process: _proc, ...rest } = proc;
      result[id] = rest;
    }
    return result;
  }

  get_log(task_id: string): string {
    const proc = this.processes.get(task_id);
    if (proc) {
      return proc.log;
    }

    const log_path = join(WORKSPACE_DIR, task_id, "agent.log");
    if (existsSync(log_path)) {
      return readFileSync(log_path, "utf-8");
    }
    return "";
  }

  async spawn_manager(feature: any, supabase: SupabaseClient) {
    const feature_id = feature.id;
    const work_dir = join(WORKSPACE_DIR, `manager-${feature_id}`);
    mkdirSync(work_dir, { recursive: true });

    // Write feature spec for the manager agent
    const spec = {
      feature_id: feature.id,
      title: feature.title,
      description: feature.description,
      project: feature.projects?.name ?? "Unknown",
      resources: (feature.resources ?? []).map((r: any) => ({
        url: r.url,
        title: r.title,
      })),
    };

    writeFileSync(
      join(work_dir, "feature-spec.json"),
      JSON.stringify(spec, null, 2)
    );

    // Update feature status
    await supabase
      .from("features")
      .update({ status: "In_Progress" })
      .eq("id", feature_id);

    const prompt = build_manager_prompt(spec, work_dir);

    // Create agent_runs record
    const model = feature.model ?? null;
    const started_at = new Date().toISOString();
    const { data: run_record } = await supabase
      .from("agent_runs")
      .insert({
        type: "manager",
        reference_id: feature_id,
        status: "running",
        started_at,
        model,
      })
      .select("id")
      .single();

    const agent_proc: AgentProcess = {
      task_id: `manager-${feature_id}`,
      run_id: run_record?.id,
      type: "manager",
      process: null,
      status: "running",
      started_at,
      log: "",
    };

    this.processes.set(agent_proc.task_id, agent_proc);

    try {
      const manager_spawn_args = [COPILOT_BIN, "-p", prompt, "--allow-all-tools"];
      if (model) manager_spawn_args.push("--model", model);

      const proc = Bun.spawn(
        manager_spawn_args,
        {
          cwd: work_dir,
          stdout: "pipe",
          stderr: "pipe",
          env: { ...process.env, HOME, PATH: ENRICHED_PATH },
        }
      );

      agent_proc.process = proc;

      // Collect output
      this.collect_output(agent_proc, proc);

      // Wait for completion
      const exit_code = await proc.exited;
      agent_proc.status = exit_code === 0 ? "completed" : "failed";
      agent_proc.finished_at = new Date().toISOString();

      // Save log
      writeFileSync(join(work_dir, "agent.log"), agent_proc.log);

      // Update agent_runs record
      if (run_record?.id) {
        const duration_ms = Date.now() - new Date(started_at).getTime();
        await supabase
          .from("agent_runs")
          .update({
            status: agent_proc.status,
            log: agent_proc.log.slice(-10000),
            finished_at: agent_proc.finished_at,
            duration_ms,
          })
          .eq("id", run_record.id);
      }

      // Parse tasks from output file
      if (exit_code === 0) {
        await this.parse_manager_output(feature_id, work_dir, supabase);
      } else {
        // Reset feature to Submitted so watcher can retry
        await supabase
          .from("features")
          .update({ status: "Submitted" })
          .eq("id", feature_id);
      }
    } catch (error) {
      agent_proc.status = "failed";
      agent_proc.finished_at = new Date().toISOString();
      agent_proc.log +=
        `\nERROR: ${error instanceof Error ? error.message : "Unknown error"}`;
      // Reset feature to Submitted so watcher can retry
      await supabase
        .from("features")
        .update({ status: "Submitted" })
        .eq("id", feature_id);
      if (run_record?.id) {
        await supabase
          .from("agent_runs")
          .update({
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            finished_at: agent_proc.finished_at,
          })
          .eq("id", run_record.id);
      }
    }
  }

  async spawn_ralph(task: any, supabase: SupabaseClient) {
    const task_id = task.id;
    const work_dir = join(WORKSPACE_DIR, `ralph-${task_id}`);
    mkdirSync(work_dir, { recursive: true });

    const task_spec = {
      task_id: task.id,
      description: task.description,
      feature_title: task.features?.title ?? "Unknown",
      project_name: task.features?.projects?.name ?? "Unknown",
    };

    writeFileSync(
      join(work_dir, "task-spec.json"),
      JSON.stringify(task_spec, null, 2)
    );

    // Update task status
    await supabase
      .from("tasks")
      .update({ status: "In_Progress" })
      .eq("id", task_id);

    const prompt = build_ralph_prompt(task_spec, work_dir);

    // Create agent_runs record
    const ralph_model = task.features?.model ?? null;
    const started_at = new Date().toISOString();
    const { data: run_record } = await supabase
      .from("agent_runs")
      .insert({
        type: "ralph",
        reference_id: task_id,
        status: "running",
        started_at,
        model: ralph_model,
      })
      .select("id")
      .single();

    const agent_proc: AgentProcess = {
      task_id: `ralph-${task_id}`,
      run_id: run_record?.id,
      type: "ralph",
      process: null,
      status: "running",
      started_at,
      log: "",
    };

    this.processes.set(agent_proc.task_id, agent_proc);

    try {
      const ralph_spawn_args = [COPILOT_BIN, "-p", prompt, "--allow-all-tools"];
      if (ralph_model) ralph_spawn_args.push("--model", ralph_model);

      const proc = Bun.spawn(
        ralph_spawn_args,
        {
          cwd: work_dir,
          stdout: "pipe",
          stderr: "pipe",
          env: { ...process.env, HOME, PATH: ENRICHED_PATH },
        }
      );

      agent_proc.process = proc;
      this.collect_output(agent_proc, proc);

      const exit_code = await proc.exited;
      agent_proc.status = exit_code === 0 ? "completed" : "failed";
      agent_proc.finished_at = new Date().toISOString();

      writeFileSync(join(work_dir, "agent.log"), agent_proc.log);

      // Update agent_runs record
      if (run_record?.id) {
        const duration_ms = Date.now() - new Date(started_at).getTime();
        await supabase
          .from("agent_runs")
          .update({
            status: agent_proc.status,
            log: agent_proc.log.slice(-10000),
            finished_at: agent_proc.finished_at,
            duration_ms,
          })
          .eq("id", run_record.id);
      }

      // Update task status
      await supabase
        .from("tasks")
        .update({
          status: exit_code === 0 ? "Complete" : "Approved",
          agent_log: agent_proc.log.slice(-5000),
        })
        .eq("id", task_id);

      // Check if all tasks for the feature are complete
      if (exit_code === 0 && task.features) {
        const { data: remaining } = await supabase
          .from("tasks")
          .select("id")
          .eq("feature_id", task.features.id)
          .neq("status", "Complete");

        if (!remaining || remaining.length === 0) {
          await supabase
            .from("features")
            .update({ status: "Done" })
            .eq("id", task.features.id);
        }
      }
    } catch (error) {
      agent_proc.status = "failed";
      agent_proc.finished_at = new Date().toISOString();
      agent_proc.log +=
        `\nERROR: ${error instanceof Error ? error.message : "Unknown error"}`;
      if (run_record?.id) {
        await supabase
          .from("agent_runs")
          .update({
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            finished_at: agent_proc.finished_at,
          })
          .eq("id", run_record.id);
      }
    }
  }

  stop_process(task_id: string, supabase?: SupabaseClient) {
    const proc = this.processes.get(task_id);
    if (proc?.process) {
      proc.process.kill();
      proc.status = "stopped";
      proc.finished_at = new Date().toISOString();
      if (supabase && proc.run_id) {
        supabase
          .from("agent_runs")
          .update({ status: "stopped", finished_at: proc.finished_at })
          .eq("id", proc.run_id)
          .then(() => {});
      }
    }
  }

  stop_all(supabase?: SupabaseClient) {
    for (const [_id, proc] of this.processes) {
      if (proc.process && proc.status === "running") {
        proc.process.kill();
        proc.status = "stopped";
        proc.finished_at = new Date().toISOString();
        if (supabase && proc.run_id) {
          supabase
            .from("agent_runs")
            .update({ status: "stopped", finished_at: proc.finished_at })
            .eq("id", proc.run_id)
            .then(() => {});
        }
      }
    }
  }

  private async collect_output(agent_proc: AgentProcess, proc: Subprocess) {
    const stdout_reader = proc.stdout instanceof ReadableStream ? (proc.stdout as ReadableStream<Uint8Array>).getReader() : undefined;
    const stderr_reader = proc.stderr instanceof ReadableStream ? (proc.stderr as ReadableStream<Uint8Array>).getReader() : undefined;
    const decoder = new TextDecoder();

    const read_stream = async (
      reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    ) => {
      if (!reader) return;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          agent_proc.log += decoder.decode(value, { stream: true });
        }
      } catch {
        // Stream closed
      }
    };

    // Read both streams concurrently
    Promise.all([read_stream(stdout_reader as any), read_stream(stderr_reader as any)]);
  }

  private async parse_manager_output(
    feature_id: string,
    work_dir: string,
    supabase: SupabaseClient
  ) {
    const tasks_file = join(work_dir, "tasks.json");
    if (!existsSync(tasks_file)) {
      return;
    }

    try {
      const content = readFileSync(tasks_file, "utf-8");
      const tasks = JSON.parse(content);

      if (Array.isArray(tasks)) {
        const task_rows = tasks.map((t: any) => ({
          feature_id,
          description: typeof t === "string" ? t : t.description ?? String(t),
          status: "Pending_Approval" as const,
        }));

        await supabase.from("tasks").insert(task_rows);
      }
    } catch {
      // Failed to parse tasks file
    }
  }
}

function build_manager_prompt(spec: any, work_dir: string): string {
  const resources_text =
    spec.resources.length > 0
      ? `\n\nResearch these resources:\n${spec.resources.map((r: any) => `- ${r.url}${r.title ? ` (${r.title})` : ""}`).join("\n")}`
      : "";

  return `You are a Manager Agent. Your role is to research and plan — you NEVER write implementation code.

PROJECT: ${spec.project}
FEATURE: ${spec.title}
DESCRIPTION: ${spec.description ?? "No description provided"}
${resources_text}

YOUR TASK:
1. Read and understand the feature specification above
2. If resources are provided, fetch and read each URL to understand the requirements
3. Break down this feature into concrete, actionable implementation tasks
4. Each task should be a single, clear unit of work that a coding agent can execute

OUTPUT:
Write a JSON file called "tasks.json" in the current directory (${work_dir}).
The file must contain an array of objects, each with a "description" field.
Example: [{"description": "Create the user model with email and password fields"}, {"description": "Add login API endpoint with JWT authentication"}]

RULES:
- Do NOT write any implementation code
- Do NOT create any source files
- ONLY output the tasks.json file
- Keep tasks focused and actionable
- Order tasks logically (dependencies first)`;
}

function build_ralph_prompt(spec: any, work_dir: string): string {
  return `You are Ralph, a coding agent. Your job is to execute a specific task.

PROJECT: ${spec.project_name}
FEATURE: ${spec.feature_title}
TASK: ${spec.description}

YOUR TASK:
1. Read the task description carefully
2. Execute the task by writing code, running commands, or making changes as needed
3. Write a brief progress update to "progress.json" in ${work_dir}

OUTPUT:
When complete, write a file called "progress.json" in ${work_dir} with:
{"status": "complete", "summary": "Brief description of what was done"}

If you encounter an error:
{"status": "error", "summary": "Description of the problem"}

RULES:
- Focus only on this specific task
- Write clean, well-structured code
- Test your work when possible
- Do not modify unrelated files`;
}

export const agent_service = new AgentService();
