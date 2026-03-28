import { z } from 'zod';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { TypedSupabaseClient } from '../db';
import { logger } from '../utils/logger';

const task_output_schema = z.object({
    title: z.string().min(5, 'Task title must be at least 5 characters').max(80, 'Task title must not exceed 80 characters'),
    description: z.string().min(20, 'Task description must be at least 20 characters').max(5000, 'Task description must not exceed 5000 characters')
}).strict();

// Also accept legacy format (description only) for backwards compatibility
const legacy_task_schema = z.object({
    description: z.string().min(20, 'Task description must be at least 20 characters').max(5000, 'Task description must not exceed 5000 characters')
}).strict();

const manager_output_schema = z.array(z.union([task_output_schema, legacy_task_schema]))
    .min(1, 'At least one task is required')
    .max(50, 'Maximum 50 tasks allowed');

const MAX_OUTPUT_FILE_SIZE = 1024 * 1024; // 1MB
const STRUCTURAL_CHARS = new Set([',', '}', ']', ':']);

function repair_json(raw: string): string {
    let result = '';
    let in_string = false;
    let escaped = false;
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (escaped) {
            result += ch;
            escaped = false;
            continue;
        }
        if (ch === '\\' && in_string) {
            result += ch;
            escaped = true;
            continue;
        }
        if (ch === '"') {
            if (!in_string) {
                in_string = true;
                result += ch;
                continue;
            }
            const rest = raw.substring(i + 1).trimStart();
            if (rest.length === 0 || STRUCTURAL_CHARS.has(rest[0])) {
                in_string = false;
                result += ch;
            }
            else {
                result += '\\"';
            }
            continue;
        }
        if (in_string && (ch === '\n' || ch === '\r')) {
            result += ch === '\n' ? '\\n' : '\\r';
            continue;
        }
        if (in_string && ch === '\t') {
            result += '\\t';
            continue;
        }
        result += ch;
    }
    return result;
}

function try_parse_json(content: string): unknown | null {
    try {
        return JSON.parse(content);
    }
    catch {
        try {
            return JSON.parse(repair_json(content));
        }
        catch {
            return null;
        }
    }
}

function extract_json_from_log(log: string): string | null {
    // Try markdown code block first: ```json [...] ```
    const code_block_match = log.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    if (code_block_match) return code_block_match[1].trim();
    // Try raw JSON array (line starting with [)
    const raw_match = log.match(/^\s*(\[[\s\S]*\])\s*$/m);
    if (raw_match) return raw_match[1].trim();
    return null;
}

export async function parse_manager_output(
    feature_id: string,
    work_dir: string,
    supabase: TypedSupabaseClient,
    run_id?: string,
    agent_log?: string
) {
    const tasks_file = join(work_dir, 'tasks.json');

    if (!existsSync(tasks_file) && agent_log) {
        const extracted = extract_json_from_log(agent_log);
        if (extracted) {
            const parsed = try_parse_json(extracted);
            if (parsed) {
                writeFileSync(tasks_file, JSON.stringify(parsed, null, 2));
                logger.info('Extracted tasks.json from agent stdout', { service: 'agent', feature_id });
            }
            if (!parsed) {
                // Extracted content wasn't valid JSON — fall through to error
            }
        }
    }

    if (!existsSync(tasks_file)) {
        logger.error('Manager exited 0 but no tasks.json', { service: 'agent', feature_id });
        await supabase.from('features')
            .update({ status: 'draft' })
            .eq('id', feature_id);
        if (run_id) {
            await supabase.from('agent_sessions')
                .update({ status: 'failed', error: 'Manager completed but produced no tasks.json' })
                .eq('id', run_id);
        }
        return;
    }

    try {
        const { size } = Bun.file(tasks_file);
        if (size > MAX_OUTPUT_FILE_SIZE) {
            const error_msg = `tasks.json exceeds maximum size (${size} bytes > ${MAX_OUTPUT_FILE_SIZE})`;
            logger.error('tasks.json exceeds size limit', { service: 'agent', feature_id, size, max: MAX_OUTPUT_FILE_SIZE });
            await supabase.from('features')
                .update({ status: 'draft' })
                .eq('id', feature_id);
            if (run_id) {
                await supabase.from('agent_sessions')
                    .update({ status: 'failed', error: error_msg })
                    .eq('id', run_id);
            }
            return;
        }

        const content = readFileSync(tasks_file, 'utf-8');
        const raw = try_parse_json(content);
        if (raw === null) throw new Error('JSON Parse error after repair attempt');
        const result = manager_output_schema.safeParse(raw);

        if (!result.success) {
            const error_msg = `Invalid tasks.json: ${result.error.issues.map((i) => i.message).join('; ')}`;
            logger.error('Invalid tasks.json schema', { service: 'agent', feature_id, error: error_msg });
            await supabase.from('features')
                .update({ status: 'draft' })
                .eq('id', feature_id);
            if (run_id) {
                await supabase.from('agent_sessions')
                    .update({ status: 'failed', error: error_msg })
                    .eq('id', run_id);
            }
            return;
        }

        const task_rows = result.data.map((t, index) => ({
            feature_id,
            title: 'title' in t ? t.title : null,
            description: t.description,
            status: 'queued' as const,
            sort_order: index
        }));

        const { error: insert_error } = await supabase.from('tasks').insert(task_rows);
        if (insert_error) {
            logger.error('Failed to insert tasks', { service: 'agent', feature_id, error: insert_error.message });
            await supabase.from('features').update({ status: 'draft' }).eq('id', feature_id);
            return;
        }
    }
    catch (error) {
        const error_msg = error instanceof Error ? error.message : 'Unknown parse error';
        logger.error('Failed to parse manager tasks output', { service: 'agent', feature_id, error: error_msg });
        await supabase.from('features')
            .update({ status: 'draft' })
            .eq('id', feature_id);
        if (run_id) {
            await supabase.from('agent_sessions')
                .update({ status: 'failed', error: `Failed to parse tasks.json: ${error_msg}` })
                .eq('id', run_id);
        }
    }
}
