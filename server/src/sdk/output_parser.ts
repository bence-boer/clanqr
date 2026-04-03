/**
 * Zod-validated parsing of structured agent output.
 * Extracts JSON from SDK session responses and validates with schemas.
 */
import { z } from 'zod';
import { logger } from '../utils/logger';

// ── Manager output schema ────────────────────────────────────────────────────

const task_schema = z.object({
    title: z.string().min(5).max(80),
    description: z.string().min(20).max(5000)
});

export const manager_output_schema = z.array(task_schema).min(1).max(50);

export type ManagerTask = z.infer<typeof task_schema>;

// ── Ralph output schema ──────────────────────────────────────────────────────

export const ralph_output_schema = z.object({
    status: z.enum(['completed', 'failed', 'partial']),
    summary: z.string().optional(),
    files_changed: z.array(z.string()).optional(),
    error_details: z.string().nullable().optional()
});

export type RalphResult = z.infer<typeof ralph_output_schema>;

// ── JSON extraction ──────────────────────────────────────────────────────────

function find_balanced_json(text: string, open: string, close: string): string | null {
    const start = text.indexOf(open);
    if (start === -1) return null;

    let depth = 0;
    let in_string = false;
    let escape_next = false;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (escape_next) {
            escape_next = false;
            continue;
        }
        if (ch === '\\') {
            escape_next = true;
            continue;
        }
        if (ch === '"') {
            in_string = !in_string;
            continue;
        }
        if (in_string) continue;
        if (ch === open) depth++;
        if (ch === close) depth--;
        if (depth === 0) return text.slice(start, i + 1);
    }
    return null;
}

function extract_json(text: string): string | null {
    const code_block = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
    if (code_block) return code_block[1].trim();

    return find_balanced_json(text, '[', ']')
      ?? find_balanced_json(text, '{', '}')
      ?? null;
}

function repair_json(raw: string): string {
    return raw.replace(/,\s*([}\]])/g, '$1');
}

export function parse_manager_output(content: string): { tasks: ManagerTask[] } | { error: string } {
    const raw = extract_json(content);
    if (!raw) {
        logger.warn('No JSON found in manager output', { service: 'sdk', content_length: content.length, content_preview: content.slice(0, 300) });
        return { error: 'No JSON found in manager output' };
    }

    try {
        const parsed = JSON.parse(repair_json(raw));
        const result = manager_output_schema.safeParse(parsed);
        if (result.success) {
            return { tasks: result.data };
        }
        logger.warn('Manager output validation failed', { service: 'sdk', errors: result.error.issues });
        return { error: `Validation failed: ${result.error.issues.map((i) => i.message).join(', ')}` };
    }
    catch (err) {
        logger.warn('Manager JSON parse error', { service: 'sdk', raw_length: raw.length, raw_preview: raw.slice(0, 300), error: String(err) });
        return { error: `JSON parse error: ${String(err)}` };
    }
}

export function parse_ralph_output(content: string): RalphResult | { error: string } {
    const raw = extract_json(content);
    if (!raw) {
        return { status: 'completed', summary: content.slice(0, 2000) };
    }

    try {
        const parsed = JSON.parse(repair_json(raw));
        const result = ralph_output_schema.safeParse(parsed);
        if (result.success) return result.data;
        return { status: 'completed', summary: content.slice(0, 2000) };
    }
    catch {
        return { status: 'completed', summary: content.slice(0, 2000) };
    }
}
