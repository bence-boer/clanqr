import { type Subprocess } from 'bun';
import { z } from 'zod';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

export const progress_schema = z.object({
    status: z.enum(['completed', 'failed', 'partial']),
    summary: z.string().optional(),
    files_changed: z.array(z.string()).optional(),
    error_details: z.string().nullable().optional()
});

export function read_progress(work_dir: string): z.infer<typeof progress_schema> | null {
    const progress_file = join(work_dir, 'progress.json');
    if (!existsSync(progress_file)) return null;
    try {
        const raw = JSON.parse(readFileSync(progress_file, 'utf-8'));
        const result = progress_schema.safeParse(raw);
        return result.success ? result.data : null;
    }
    catch {
        return null;
    }
}

export async function collect_output(
    proc: Subprocess,
    on_chunk: (text: string) => void
): Promise<void> {
    const decoder = new TextDecoder();
    const read_stream = async (stream: ReadableStream<Uint8Array> | null | undefined) => {
        if (!stream) return;
        const reader = stream.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                on_chunk(decoder.decode(value, { stream: true }));
            }
        }
        catch (error) {
            logger.warn('Stream read error', { service: 'spawn_agent', error: String(error) });
        }
    };
    await Promise.all([
        read_stream(proc.stdout as ReadableStream<Uint8Array> | null),
        read_stream(proc.stderr as ReadableStream<Uint8Array> | null)
    ]);
}

export function kill_agent_process(proc: Subprocess): void {
    try {
        process.kill(-proc.pid, 'SIGKILL');
    }
    catch {
        try {
            proc.kill();
        }
        catch {
            // Process already dead
        }
    }
}
