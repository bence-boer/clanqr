import { describe, expect, it } from 'bun:test';
import { format_log_detail } from './pipeline_dispatch';

describe('format_log_detail', () => {
    it('returns tool name for tool_start', () => {
        const result = format_log_detail({ type: 'tool_start', data: { tool_name: 'read_file' } });
        expect(result).toBe('read_file');
    });

    it('returns "name (✓)" for successful tool_complete', () => {
        const result = format_log_detail({ type: 'tool_complete', data: { tool_name: 'write_file', success: true } });
        expect(result).toBe('write_file (✓)');
    });

    it('returns "name (✗)" for failed tool_complete', () => {
        const result = format_log_detail({ type: 'tool_complete', data: { tool_name: 'write_file', success: false } });
        expect(result).toBe('write_file (✗)');
    });

    it('returns intent string for agent_intent', () => {
        const result = format_log_detail({ type: 'agent_intent', data: { intent: 'Fixing the bug' } });
        expect(result).toBe('Fixing the bug');
    });

    it('returns truncated content for agent_output', () => {
        const long = 'x'.repeat(200);
        const result = format_log_detail({ type: 'agent_output', data: { content: long } });
        expect(result).toHaveLength(120);
    });

    it('returns model + token info for usage', () => {
        const result = format_log_detail({ type: 'usage', data: { model: 'gpt-4.1', output: 500 } });
        expect(result).toBe('gpt-4.1 +500 tokens');
    });

    it('returns error message for error type', () => {
        const result = format_log_detail({ type: 'error', data: { message: 'timeout' } });
        expect(result).toBe('timeout');
    });

    it('falls back to error field when message is missing', () => {
        const result = format_log_detail({ type: 'error', data: { error: 'connection lost' } });
        expect(result).toBe('connection lost');
    });

    it('returns empty string for unknown type', () => {
        const result = format_log_detail({ type: 'unknown_thing', data: {} });
        expect(result).toBe('');
    });

    it('handles missing data fields gracefully', () => {
        expect(format_log_detail({ type: 'tool_start', data: {} })).toBe('unknown');
        expect(format_log_detail({ type: 'agent_intent', data: {} })).toBe('');
    });
});
