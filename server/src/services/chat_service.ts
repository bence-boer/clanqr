import type { SupabaseClient } from "../db";
import { COPILOT_BIN, GEMINI_BIN, ENRICHED_PATH, build_agent_env } from "../env";

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

        const cli = "copilot"; // Chat is currently hardcoded to copilot cli
        const resolved_model = model || "gpt-4o";

        // Create agent_runs record
        const started_at = new Date().toISOString();
        const { data: run_record } = await supabase
            .from("agent_runs")
            .insert({
                type: "chat",
                session_id,
                status: "running",
                cli,
                model: resolved_model,
                started_at,
            })
            .select("id")
            .single();

        const proc = Bun.spawn(
            [COPILOT_BIN, "-p", content, "--model", resolved_model, "--allow-all-tools"],
            {
                cwd: process.env.HOME ?? "/tmp",
                stdout: "pipe",
                stderr: "pipe",
                env: build_agent_env(),
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
            } catch (error) {
                console.warn("[chat_service] Stream read error:", error);
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
