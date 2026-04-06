/**
 * Deterministic, schema-valid mock responses for each agent type.
 * Used when the server runs in TEST_MODE to bypass the Copilot SDK.
 *
 * All responses are wrapped in markdown code blocks so they pass through
 * the output parser's `extract_json()` regex extraction path.
 */
import type {
    OrchestratorTask,
    ImplementerResult,
    VerifierResult,
    ReviewerResult
} from '../sdk/output_schemas';
import type { SdkSessionResult } from '../sdk/types';

// ── Constants ────────────────────────────────────────────────────────────────

/** Simulated latency for mock responses (ms) */
export const MOCK_DELAY_MS = 500;

// ── Mock data ────────────────────────────────────────────────────────────────

const orchestrator_tasks: OrchestratorTask[] = [
    {
        task_id: 'task-1',
        description: 'Implement the data access layer with repository pattern',
        assignee_role: 'implementer',
        dependencies: [],
        context_paths: ['src/db/repository.ts'],
        execution_strategy: 'sequential',
        skills: ['typescript', 'database'],
        definition_of_done: 'Repository module exports CRUD functions with passing unit tests'
    },
    {
        task_id: 'task-2',
        description: 'Add API endpoint that delegates to the data access layer',
        assignee_role: 'implementer',
        dependencies: ['task-1'],
        context_paths: ['src/routes/api.ts', 'src/db/repository.ts'],
        execution_strategy: 'sequential',
        skills: ['typescript', 'rest-api'],
        definition_of_done: 'GET /api/items returns 200 with JSON array from repository'
    }
];

const implementer_result: ImplementerResult = {
    status: 'completed',
    summary: 'All changes implemented and tests passing.',
    files_changed: ['src/db/repository.ts', 'src/routes/api.ts'],
    error_details: null
};

const verifier_result: VerifierResult = {
    verdict: 'approved',
    criteria: [
        { name: 'type_check', passed: true, evidence: 'tsc --noEmit exited 0' },
        { name: 'unit_tests', passed: true, evidence: '12/12 tests passed' },
        { name: 'lint', passed: true, evidence: 'No lint errors found' }
    ],
    summary: 'All verification criteria passed.'
};

const reviewer_result: ReviewerResult = {
    verdict: 'ship',
    findings: [
        {
            severity: 'nitpick',
            description: 'Consider adding JSDoc to the exported repository functions.',
            file: 'src/db/repository.ts',
            suggestion: 'Add @param and @returns annotations.'
        }
    ],
    summary: 'Code is clean and ready to merge.'
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Wrap a JSON-serialisable value in a markdown code block for extract_json() */
function wrap_in_code_block(data: unknown): string {
    const json = JSON.stringify(data, null, 2);
    return `Here is the output:\n\n\`\`\`json\n${json}\n\`\`\``;
}

const fallback_response = 'Mock response: no structured output for this agent type.';

const response_map: Record<string, string> = {
    orchestrator: wrap_in_code_block(orchestrator_tasks),
    implementer: wrap_in_code_block(implementer_result),
    verifier: wrap_in_code_block(verifier_result),
    reviewer: wrap_in_code_block(reviewer_result)
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Return a canned response string for the given agent type.
 * The string is formatted as the `content` field that session_runner returns —
 * JSON wrapped in a markdown code block so `extract_json()` can parse it.
 */
export function get_mock_response(agent_type: string): string {
    return response_map[agent_type] ?? fallback_response;
}

/**
 * Return a full `SdkSessionResult`-compatible object for the given agent type.
 * Includes realistic token counts and timing metadata.
 */
export function get_mock_session_result(
    agent_type: string,
    session_id: string
): SdkSessionResult {
    const content = get_mock_response(agent_type);
    const files_changed = agent_type === 'implementer'
        ? implementer_result.files_changed
        : [];

    return {
        content,
        session_id,
        prompt_tokens: 150,
        completion_tokens: 80,
        cache_read: 0,
        cache_write: 0,
        total_cost: 0.002,
        duration_ms: MOCK_DELAY_MS,
        files_changed
    };
}
