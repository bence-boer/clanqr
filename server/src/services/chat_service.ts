import type { SupabaseClient } from "../db";
import { COPILOT_BIN, GEMINI_BIN, ENRICHED_PATH, build_agent_env } from "../env";
import { logger } from "../utils/logger";
import { can_spawn_agent, increment_agent_count, decrement_agent_count } from "./agent_service";

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
        // M-10.4: Check agent concurrency limit
        if (!can_spawn_agent()) {
            throw new Error("Agent concurrency limit reached — please try again shortly");
        }

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

        increment_agent_count();
        this.active_sessions.set(session_id, { session_id, process: proc });

        try {
            let full_response = "";
            const reader = proc.stdout?.getReader();
            const decoder = new TextDecoder();

            const CHAT_TIMEOUT_MS = 10 * 60 * 1000;
            const timeout_promise = new Promise<void>((_, reject) =>
                setTimeout(() => {
                    try { proc.kill(); } catch {}
                    reject(new Error("Chat timed out"));
                }, CHAT_TIMEOUT_MS)
            );

            const read_promise = (async () => {
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
                        logger.warn("Stream read error", { service: "chat", session_id, error: String(error) });
                    }
                }

                const exit_code = await proc.exited;
                return exit_code;
            })();

            let exit_code: number;
            try {
                exit_code = await Promise.race([
                    read_promise,
                    timeout_promise.then(() => -1),
                ]) as number;
            } catch {
                exit_code = -1;
            }

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
        } finally {
            decrement_agent_count();
            this.active_sessions.delete(session_id);
        }
    }

    cancel(session_id: string): boolean {
        const active = this.active_sessions.get(session_id);
        if (active) {
            active.process.kill();
            this.active_sessions.delete(session_id);
            decrement_agent_count();
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
