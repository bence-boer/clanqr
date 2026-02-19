import type { SupabaseClient } from "../db";
import { join } from "path";

const HOME = process.env.HOME ?? "/home/scoy";
const COPILOT_BIN =
  process.env.COPILOT_BIN ?? join(HOME, ".local/bin/copilot");
const ENRICHED_PATH = [
  join(HOME, ".local/bin"),
  join(HOME, ".bun/bin"),
  process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
].join(":");

interface ActiveChat {
  session_id: string;
  process: ReturnType<typeof Bun.spawn>;
}

class ChatService {
  private active_sessions: Map<string, ActiveChat> = new Map();

  async send_message(
    session_id: string,
    content: string,
    model: string,
    supabase: SupabaseClient,
    on_token: (chunk: string) => void
  ): Promise<void> {
    // Insert user message
    await supabase.from("chat_messages").insert({
      session_id,
      role: "user",
      content,
    });

    // Create agent_runs record
    const started_at = new Date().toISOString();
    const { data: run_record } = await supabase
      .from("agent_runs")
      .insert({
        type: "chat",
        reference_id: session_id,
        status: "running",
        model,
        started_at,
      })
      .select("id")
      .single();

    const proc = Bun.spawn(
      [COPILOT_BIN, "-p", content, "--model", model, "--allow-all-tools"],
      {
        cwd: HOME,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, HOME, PATH: ENRICHED_PATH },
      }
    );

    this.active_sessions.set(session_id, { session_id, process: proc });

    let full_response = "";
    const reader = proc.stdout?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          full_response += chunk;
          on_token(chunk);
        }
      } catch {
        // Stream closed
      }
    }

    const exit_code = await proc.exited;
    this.active_sessions.delete(session_id);

    const finished_at = new Date().toISOString();
    const duration_ms = Date.now() - new Date(started_at).getTime();
    const status = exit_code === 0 ? "completed" : "failed";

    // Save assistant message
    await supabase.from("chat_messages").insert({
      session_id,
      role: "assistant",
      content: full_response,
    });

    // Update session
    await supabase
      .from("chat_sessions")
      .update({ updated_at: finished_at })
      .eq("id", session_id);

    // Update agent_runs
    if (run_record?.id) {
      await supabase
        .from("agent_runs")
        .update({ status, finished_at, duration_ms, log: full_response.slice(-10000) })
        .eq("id", run_record.id);
    }
  }

  cancel(session_id: string): boolean {
    const active = this.active_sessions.get(session_id);
    if (active) {
      active.process.kill();
      this.active_sessions.delete(session_id);
      return true;
    }
    return false;
  }

  is_busy(session_id?: string): boolean {
    if (session_id) {
      return this.active_sessions.has(session_id);
    }
    return this.active_sessions.size > 0;
  }
}

export const chat_service = new ChatService();
