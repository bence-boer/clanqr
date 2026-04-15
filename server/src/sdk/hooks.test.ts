import { describe, it, expect, mock } from 'bun:test';

// --- Mocks must be registered before importing ---
mock.module('../services/audit_service', () => ({
    audit_service: {
        log_event: () => {
        },
        log_tool_call: () => {
        },
        log_tool_result: () => {
        }
    }
}));

mock.module('../utils/logger', () => ({
    logger: {
        debug: () => {
        },
        info: () => {
        },
        warn: () => {
        },
        error: () => {
        }
    }
}));

import { redact_secrets } from './hooks';

describe('redact_secrets', () => {
    it('redacts Stripe-style sk_ keys', () => {
        const input = 'key=sk-abc123def456ghi789jkl012';
        expect(redact_secrets(input)).toBe('key=[REDACTED]');
    });

    it('redacts Stripe-style pk_ keys', () => {
        const input = 'key=pk-abc123def456ghi789jkl012';
        expect(redact_secrets(input)).toBe('key=[REDACTED]');
    });

    it('redacts GitHub personal access tokens (ghp_)', () => {
        const input = 'token=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
        expect(redact_secrets(input)).toBe('token=[REDACTED]');
    });

    it('redacts GitHub OAuth tokens (gho_)', () => {
        const input = 'token=gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
        expect(redact_secrets(input)).toBe('token=[REDACTED]');
    });

    it('redacts GitHub server tokens (ghs_)', () => {
        const input = 'token=ghs_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
        expect(redact_secrets(input)).toBe('token=[REDACTED]');
    });

    it('redacts GitHub user tokens (ghu_)', () => {
        const input = 'token=ghu_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
        expect(redact_secrets(input)).toBe('token=[REDACTED]');
    });

    it('redacts GitHub fine-grained tokens (github_pat_)', () => {
        const input = 'token=github_pat_ABCDEFGHIJKLMNOPQRSTUV';
        expect(redact_secrets(input)).toBe('token=[REDACTED]');
    });

    it('redacts RSA private key headers', () => {
        const input = 'found -----BEGIN RSA PRIVATE KEY-----';
        expect(redact_secrets(input)).toBe('found [REDACTED]');
    });

    it('redacts EC private key headers', () => {
        const input = 'found -----BEGIN EC PRIVATE KEY-----';
        expect(redact_secrets(input)).toBe('found [REDACTED]');
    });

    it('redacts OPENSSH private key headers', () => {
        const input = 'found -----BEGIN OPENSSH PRIVATE KEY-----';
        expect(redact_secrets(input)).toBe('found [REDACTED]');
    });

    it('redacts AWS access keys (AKIA prefix)', () => {
        const input = 'aws_key=AKIAIOSFODNN7EXAMPLE';
        expect(redact_secrets(input)).toBe('aws_key=[REDACTED]');
    });

    it('redacts JWT tokens (eyJ...)', () => {
        const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
        const payload = Buffer.from('{"sub":"1234567890","role":"service_role"}').toString('base64url');
        const input = `token=${header}.${payload}.signature`;
        expect(redact_secrets(input)).not.toContain(header);
        expect(redact_secrets(input)).toContain('[REDACTED]');
    });

    it('redacts Slack tokens (xoxb-)', () => {
        const input = 'slack=xoxb-fake-test-value-not-real';
        expect(redact_secrets(input)).toBe('slack=[REDACTED]');
    });

    it('redacts Slack tokens (xoxp-)', () => {
        const input = 'slack=xoxp-fake-test-value-not-real';
        expect(redact_secrets(input)).toBe('slack=[REDACTED]');
    });

    it('does not redact normal text', () => {
        const input = 'This is a normal response with no secrets.';
        expect(redact_secrets(input)).toBe(input);
    });

    it('redacts multiple secrets in a single string', () => {
        const input = 'keys: sk-abc123def456ghi789jkl012 and AKIAIOSFODNN7EXAMPLE';
        const result = redact_secrets(input);
        expect(result).toBe('keys: [REDACTED] and [REDACTED]');
    });

    it('handles empty string', () => {
        expect(redact_secrets('')).toBe('');
    });
});
