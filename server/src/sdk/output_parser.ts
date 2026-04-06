/**
 * Zod-validated parsing of structured agent output.
 * Extracts JSON from SDK session responses and validates with schemas.
 * V2: adds parsers for orchestrator, implementer, verifier, reviewer, and text output.
 */
import { logger } from '../utils/logger';
import {
    manager_output_schema,
    orchestrator_output_schema,
    implementer_output_schema,
    verifier_output_schema,
    reviewer_output_schema,
    type ManagerTask,
    type OrchestratorTask,
    type ImplementerResult,
    type VerifierResult,
    type ReviewerResult
} from './output_schemas';
import type { RalphResult } from './output_schemas';

// Re-export types and schemas for backward compat
export {
    manager_output_schema, ralph_output_schema,
    orchestrator_output_schema, implementer_output_schema,
    verifier_output_schema, reviewer_output_schema
} from './output_schemas';
export type { ManagerTask, RalphResult, OrchestratorTask, ImplementerResult, VerifierResult, ReviewerResult };

// ── JSON extraction utilities ────────────────────────────────────────────────

export function find_balanced_json(text: string, open: string, close: string): string | null {
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

export function extract_json(text: string): string | null {
    const code_block = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
    if (code_block) return code_block[1].trim();
    return find_balanced_json(text, '[', ']')
      ?? find_balanced_json(text, '{', '}')
      ?? null;
}

export function repair_json(raw: string): string {
    return raw.replace(/,\s*([}\]])/g, '$1');
}

// ── V2 parsers ───────────────────────────────────────────────────────────────

export function parse_orchestrator_output(
    content: string
): { tasks: OrchestratorTask[] } | { error: string } {
    const raw = extract_json(content);
    if (!raw) {
        logger.warn('No JSON found in orchestrator output', {
            service: 'sdk', content_length: content.length, content_preview: content.slice(0, 300)
        });
        return { error: 'No JSON found in orchestrator output' };
    }
    try {
        const parsed = JSON.parse(repair_json(raw));
        const result = orchestrator_output_schema.safeParse(parsed);
        if (result.success) return { tasks: result.data };
        logger.warn('Orchestrator output validation failed', { service: 'sdk', errors: result.error.issues });
        return { error: `Validation failed: ${result.error.issues.map((i) => i.message).join(', ')}` };
    }
    catch (err) {
        logger.warn('Orchestrator JSON parse error', { service: 'sdk', error: String(err) });
        return { error: `JSON parse error: ${String(err)}` };
    }
}

export function parse_implementer_output(content: string): ImplementerResult | { error: string } {
    const raw = extract_json(content);
    if (!raw) {
        return { status: 'completed', summary: content.slice(0, 2000) };
    }
    try {
        const parsed = JSON.parse(repair_json(raw));
        const result = implementer_output_schema.safeParse(parsed);
        if (result.success) return result.data;
        return { status: 'completed', summary: content.slice(0, 2000) };
    }
    catch {
        return { status: 'completed', summary: content.slice(0, 2000) };
    }
}

export function parse_verifier_output(
    content: string
): VerifierResult | { error: string } {
    const raw = extract_json(content);
    if (!raw) {
        logger.warn('No JSON found in verifier output', {
            service: 'sdk', content_length: content.length
        });
        return { error: 'No JSON found in verifier output' };
    }
    try {
        const parsed = JSON.parse(repair_json(raw));
        const result = verifier_output_schema.safeParse(parsed);
        if (result.success) return result.data;
        logger.warn('Verifier output validation failed', { service: 'sdk', errors: result.error.issues });
        return { error: `Validation failed: ${result.error.issues.map((i) => i.message).join(', ')}` };
    }
    catch (err) {
        logger.warn('Verifier JSON parse error', { service: 'sdk', error: String(err) });
        return { error: `JSON parse error: ${String(err)}` };
    }
}

export function parse_reviewer_output(
    content: string
): ReviewerResult | { error: string } {
    const raw = extract_json(content);
    if (!raw) {
        logger.warn('No JSON found in reviewer output', {
            service: 'sdk', content_length: content.length
        });
        return { error: 'No JSON found in reviewer output' };
    }
    try {
        const parsed = JSON.parse(repair_json(raw));
        const result = reviewer_output_schema.safeParse(parsed);
        if (result.success) return result.data;
        logger.warn('Reviewer output validation failed', { service: 'sdk', errors: result.error.issues });
        return { error: `Validation failed: ${result.error.issues.map((i) => i.message).join(', ')}` };
    }
    catch (err) {
        logger.warn('Reviewer JSON parse error', { service: 'sdk', error: String(err) });
        return { error: `JSON parse error: ${String(err)}` };
    }
}

/** Parse plain-text output for explorer, architect, synthesizer, and researcher agents */
export function parse_text_output(content: string): { content: string } {
    return { content: content.trim() };
}

// ── Legacy parsers (deprecated aliases) ──────────────────────────────────────

/** @deprecated Use parse_orchestrator_output instead */
export function parse_manager_output(content: string): { tasks: ManagerTask[] } | { error: string } {
    const raw = extract_json(content);
    if (!raw) {
        logger.warn('No JSON found in manager output', {
            service: 'sdk', content_length: content.length, content_preview: content.slice(0, 300)
        });
        return { error: 'No JSON found in manager output' };
    }
    try {
        const parsed = JSON.parse(repair_json(raw));
        const result = manager_output_schema.safeParse(parsed);
        if (result.success) return { tasks: result.data };
        logger.warn('Manager output validation failed', { service: 'sdk', errors: result.error.issues });
        return { error: `Validation failed: ${result.error.issues.map((i) => i.message).join(', ')}` };
    }
    catch (err) {
        logger.warn('Manager JSON parse error', { service: 'sdk', error: String(err) });
        return { error: `JSON parse error: ${String(err)}` };
    }
}

/** @deprecated Use parse_implementer_output instead */
export function parse_ralph_output(content: string): RalphResult | { error: string } {
    return parse_implementer_output(content);
}
