import { describe, it, expect } from 'bun:test';
import { generate_session_token, hash_session_token } from './auth_shared';

describe('auth_shared', () => {
    describe('generate_session_token', () => {
        it('generates base64url tokens', () => {
            const token = generate_session_token();
            expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
            expect(token.length).toBeGreaterThan(20);
        });

        it('generates unique tokens', () => {
            const tokens = new Set(Array.from({ length: 100 }, () => generate_session_token()));
            expect(tokens.size).toBe(100);
        });
    });

    describe('hash_session_token', () => {
        it('returns hex SHA-256 hash', () => {
            const hash = hash_session_token('test-token');
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });

        it('is deterministic', () => {
            expect(hash_session_token('abc')).toBe(hash_session_token('abc'));
        });

        it('different tokens produce different hashes', () => {
            expect(hash_session_token('token-a')).not.toBe(hash_session_token('token-b'));
        });
    });
});
