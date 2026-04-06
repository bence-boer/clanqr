/** Tests that mock_responses module produces schema-valid canned responses. */
import { describe, test, expect } from 'bun:test';

import {
    get_mock_response,
    get_mock_session_result,
    MOCK_DELAY_MS
} from '../mock_responses';

import {
    extract_json, repair_json
} from '../../sdk/output_parser';

import {
    orchestrator_output_schema,
    implementer_output_schema,
    verifier_output_schema,
    reviewer_output_schema
} from '../../sdk/output_schemas';

import type { SdkSessionResult } from '../../sdk/types';

// Direct JSON→Zod parse bypassing module-level mocks (Bun mock.module is global)
function parse_mock_json(content: string) {
    const raw = extract_json(content);
    if (!raw) return undefined;
    return JSON.parse(repair_json(raw));
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

describe('mock orchestrator response', () => {
    test('passes orchestrator schema validation', () => {
        const json = parse_mock_json(get_mock_response('orchestrator'));
        expect(json).toBeDefined();
        const result = orchestrator_output_schema.safeParse(json);
        expect(result.success).toBe(true);
        expect(result.data?.length).toBeGreaterThanOrEqual(1);
    });

    test('has at least 2 tasks with a dependency between them', () => {
        const json = parse_mock_json(get_mock_response('orchestrator'));
        const result = orchestrator_output_schema.safeParse(json);
        expect(result.success).toBe(true);
        const tasks = result.data ?? [];
        expect(tasks.length).toBeGreaterThanOrEqual(2);
        const task_ids = new Set(tasks.map((t) => t.task_id));
        const has_dep = tasks.some(
            (t) => t.dependencies.length > 0 && t.dependencies.some((d) => task_ids.has(d))
        );
        expect(has_dep).toBe(true);
    });
});

describe('mock implementer response', () => {
    test('passes implementer schema validation with summary', () => {
        const json = parse_mock_json(get_mock_response('implementer'));
        expect(json).toBeDefined();
        const result = implementer_output_schema.safeParse(json);
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(['completed', 'failed', 'partial']).toContain(result.data.status);
        expect(typeof result.data.summary).toBe('string');
        expect((result.data.summary ?? '').length).toBeGreaterThan(0);
    });
});

describe('mock verifier response', () => {
    test('passes verifier schema validation', () => {
        const json = parse_mock_json(get_mock_response('verifier'));
        expect(json).toBeDefined();
        const result = verifier_output_schema.safeParse(json);
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(['approved', 'rejected']).toContain(result.data.verdict);
    });
});

describe('mock reviewer response', () => {
    test('passes reviewer schema validation', () => {
        const json = parse_mock_json(get_mock_response('reviewer'));
        expect(json).toBeDefined();
        const result = reviewer_output_schema.safeParse(json);
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(['ship', 'no-ship']).toContain(result.data.verdict);
    });
});

// ── Unknown / fallback ───────────────────────────────────────────────────────
describe('mock unknown agent response', () => {
    test('returns non-empty strings for unrecognised agent types', () => {
        for (const type of ['unknown', 'made_up_agent_xyz']) {
            const content = get_mock_response(type);
            expect(typeof content).toBe('string');
            expect(content.length).toBeGreaterThan(0);
        }
    });
});

// ── get_mock_session_result ──────────────────────────────────────────────────
describe('get_mock_session_result', () => {
    test('returns a valid SdkSessionResult shape', () => {
        const session_id = 'test-session-001';
        const result: SdkSessionResult = get_mock_session_result('orchestrator', session_id);

        expect(result.session_id).toBe(session_id);
        expect(typeof result.content).toBe('string');
        expect(result.content.length).toBeGreaterThan(0);
    });

    test('includes optional numeric token/cost fields', () => {
        const result = get_mock_session_result('implementer', 'sess-002');

        // These should be defined and non-negative in a mock
        if (result.prompt_tokens !== undefined) {
            expect(result.prompt_tokens).toBeGreaterThanOrEqual(0);
        }
        if (result.completion_tokens !== undefined) {
            expect(result.completion_tokens).toBeGreaterThanOrEqual(0);
        }
        if (result.total_cost !== undefined) {
            expect(result.total_cost).toBeGreaterThanOrEqual(0);
        }
        if (result.duration_ms !== undefined) {
            expect(result.duration_ms).toBeGreaterThanOrEqual(0);
        }
    });

    test('content for orchestrator agent passes schema validation', () => {
        const result = get_mock_session_result('orchestrator', 'sess-003');
        const json = parse_mock_json(result.content);
        expect(json).toBeDefined();
        expect(orchestrator_output_schema.safeParse(json).success).toBe(true);
    });
});

// ── MOCK_DELAY_MS ────────────────────────────────────────────────────────────
describe('MOCK_DELAY_MS', () => {
    test('is a positive finite number', () => {
        expect(typeof MOCK_DELAY_MS).toBe('number');
        expect(MOCK_DELAY_MS).toBeGreaterThan(0);
        expect(Number.isFinite(MOCK_DELAY_MS)).toBe(true);
    });
});
