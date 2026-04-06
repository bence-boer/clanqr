import { describe, expect, it } from 'bun:test';
import {
    extract_json, repair_json, find_balanced_json,
    parse_orchestrator_output, parse_implementer_output,
    parse_verifier_output, parse_reviewer_output, parse_text_output,
    parse_manager_output, parse_ralph_output
} from './output_parser';

describe('extract_json', () => {
    it('extracts from ```json code block', () => {
        const text = 'Here is output:\n```json\n[{"a":1}]\n```\nDone.';
        expect(extract_json(text)).toBe('[{"a":1}]');
    });

    it('extracts a bare JSON array', () => {
        expect(extract_json('result: [1, 2, 3] end')).toBe('[1, 2, 3]');
    });

    it('extracts a bare JSON object', () => {
        expect(extract_json('result: {"k":"v"} end')).toBe('{"k":"v"}');
    });

    it('returns null when no JSON is present', () => {
        expect(extract_json('no json here')).toBeNull();
    });
});

describe('repair_json', () => {
    it('removes trailing commas before } and ]', () => {
        expect(repair_json('{"a":1,}')).toBe('{"a":1}');
        expect(repair_json('[1,2,]')).toBe('[1,2]');
    });
});

describe('find_balanced_json', () => {
    it('handles nested brackets', () => {
        const text = 'prefix {"a":{"b":[1,2]}} suffix';
        expect(find_balanced_json(text, '{', '}')).toBe('{"a":{"b":[1,2]}}');
    });

    it('handles strings containing brackets', () => {
        const text = '{"msg":"hello {world}"}';
        expect(find_balanced_json(text, '{', '}')).toBe('{"msg":"hello {world}"}');
    });

    it('returns null when brackets are unbalanced', () => {
        expect(find_balanced_json('{"a":', '{', '}')).toBeNull();
    });
});

describe('parse_orchestrator_output', () => {
    const valid_task = {
        task_id: 't1', description: 'Implement the feature end to end',
        assignee_role: 'implementer', dependencies: [],
        context_paths: [], execution_strategy: 'sequential',
        skills: [], definition_of_done: 'All tests pass'
    };

    it('parses a valid JSON array of tasks', () => {
        const result = parse_orchestrator_output(JSON.stringify([valid_task]));
        expect('tasks' in result).toBe(true);
        if ('tasks' in result) expect(result.tasks).toHaveLength(1);
    });

    it('extracts tasks from a markdown code block', () => {
        const md = '```json\n' + JSON.stringify([valid_task]) + '\n```';
        const result = parse_orchestrator_output(md);
        expect('tasks' in result).toBe(true);
    });

    it('returns error when no JSON is found', () => {
        const result = parse_orchestrator_output('no json here');
        expect('error' in result).toBe(true);
    });

    it('returns error for invalid schema (missing required fields)', () => {
        const result = parse_orchestrator_output(JSON.stringify([{ task_id: 't1' }]));
        expect('error' in result).toBe(true);
    });
});

describe('parse_implementer_output', () => {
    it('parses valid implementer JSON', () => {
        const json = JSON.stringify({ status: 'completed', summary: 'Done' });
        const result = parse_implementer_output(json);
        expect('status' in result && result.status).toBe('completed');
    });

    it('returns fallback summary when no JSON is present', () => {
        const result = parse_implementer_output('plain text result');
        expect('status' in result && result.status).toBe('completed');
        expect('summary' in result && result.summary).toBe('plain text result');
    });

    it('returns fallback on invalid JSON', () => {
        const result = parse_implementer_output('{broken json!!!');
        expect('status' in result && result.status).toBe('completed');
    });
});

describe('parse_verifier_output', () => {
    it('parses valid verifier JSON', () => {
        const json = JSON.stringify({ verdict: 'approved', criteria: [] });
        const result = parse_verifier_output(json);
        expect('verdict' in result && result.verdict).toBe('approved');
    });

    it('returns error when no JSON is found', () => {
        const result = parse_verifier_output('no json here');
        expect('error' in result).toBe(true);
    });
});

describe('parse_reviewer_output', () => {
    it('parses valid reviewer JSON', () => {
        const json = JSON.stringify({ verdict: 'ship', findings: [] });
        const result = parse_reviewer_output(json);
        expect('verdict' in result && result.verdict).toBe('ship');
    });

    it('returns error when no JSON is found', () => {
        const result = parse_reviewer_output('no json');
        expect('error' in result).toBe(true);
    });
});

describe('parse_text_output', () => {
    it('returns trimmed content', () => {
        expect(parse_text_output('  hello world  \n')).toEqual({ content: 'hello world' });
    });
});

describe('legacy aliases', () => {
    it('parse_manager_output parses valid manager JSON', () => {
        const tasks = [{ title: 'A valid task title', description: 'A description that is at least twenty chars long' }];
        const result = parse_manager_output(JSON.stringify(tasks));
        expect('tasks' in result).toBe(true);
    });

    it('parse_ralph_output delegates to parse_implementer_output', () => {
        const json = JSON.stringify({ status: 'completed', summary: 'Done' });
        const result = parse_ralph_output(json);
        expect('status' in result && result.status).toBe('completed');
    });
});
