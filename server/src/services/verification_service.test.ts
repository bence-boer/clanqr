import { describe, expect, it } from 'bun:test';
import { should_verify } from './verification_service';

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
