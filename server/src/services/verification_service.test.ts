import { describe, expect, it } from 'bun:test';
import { should_verify, dispatch_verifier } from './verification_service';
import { create_mock_supabase } from '../test-utils';

describe('should_verify', () => {
    it('returns true for implementer with definition_of_done', () => {
        expect(should_verify({ agent_type: 'implementer', definition_of_done: 'All tests pass' })).toBe(true);
    });

    it('returns true for architect with definition_of_done', () => {
        expect(should_verify({ agent_type: 'architect', definition_of_done: 'Design approved' })).toBe(true);
    });

    it('returns false for explorer (not in VERIFIABLE_ROLES)', () => {
        expect(should_verify({ agent_type: 'explorer', definition_of_done: 'Explore done' })).toBe(false);
    });

    it('returns false for orchestrator', () => {
        expect(should_verify({ agent_type: 'orchestrator', definition_of_done: 'Plan done' })).toBe(false);
    });

    it('returns false for reviewer', () => {
        expect(should_verify({ agent_type: 'reviewer', definition_of_done: 'Review done' })).toBe(false);
    });

    it('returns false when definition_of_done is null', () => {
        expect(should_verify({ agent_type: 'implementer', definition_of_done: null })).toBe(false);
    });

    it('returns false when definition_of_done is empty string', () => {
        expect(should_verify({ agent_type: 'implementer', definition_of_done: '' })).toBe(false);
    });

    it('returns false when definition_of_done is whitespace-only', () => {
        expect(should_verify({ agent_type: 'implementer', definition_of_done: '   \n\t  ' })).toBe(false);
    });
});

describe('dispatch_verifier', () => {
    it('returns rejected when task is not found', async () => {
        const { client } = create_mock_supabase({ tasks: [] });
        const result = await dispatch_verifier('nonexistent-id', 'feat-1', client as never);
        expect(result.verdict).toBe('rejected');
        expect(result.reasons).toContain('Task not found for verification');
    });

    it('returns approved stub when task exists', async () => {
        const { client } = create_mock_supabase({
            tasks: [{
                id: 'task-1', title: 'T', description: 'D',
                definition_of_done: 'Tests pass', output: '', agent_type: 'implementer'
            }]
        });
        const result = await dispatch_verifier('task-1', 'feat-1', client as never);
        expect(result.verdict).toBe('approved');
        expect(result.reasons).toEqual([]);
    });
});
