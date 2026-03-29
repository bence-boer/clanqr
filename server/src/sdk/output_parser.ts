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

function extract_json(text: string): string | null {
    // Try: markdown code block with json
    const code_block = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
    if (code_block) return code_block[1].trim();

    // Try: raw JSON array or object
    const json_match = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (json_match) return json_match[1].trim();

    return null;
}

function repair_json(raw: string): string {
    return raw
        .replace(/\\n/g, '\\n')
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/'/g, '"');
}

export function parse_manager_output(content: string): { tasks: ManagerTask[] } | { error: string } {
    const raw = extract_json(content);
    if (!raw) {
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
