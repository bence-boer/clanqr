import { describe, expect, it } from 'bun:test';
import { encrypt_token, decrypt_token } from './token_encryption';

describe('token_encryption', () => {
    const secret = 'test-secret-key-for-encryption';

    it('round-trip: encrypt then decrypt returns original plaintext', () => {
        const plaintext = 'ghp_abc123tokenvalue';
        const ciphertext = encrypt_token(plaintext, secret);
        const decrypted = decrypt_token(ciphertext, secret);
        expect(decrypted).toBe(plaintext);
    });

    it('decrypt with wrong secret throws', () => {
        const plaintext = 'ghp_abc123tokenvalue';
        const ciphertext = encrypt_token(plaintext, secret);
        expect(() => decrypt_token(ciphertext, 'wrong-secret')).toThrow(
            'Token decryption failed — token may have been encrypted with old key'
        );
    });

    it('decrypt with corrupted ciphertext throws', () => {
        const plaintext = 'ghp_abc123tokenvalue';
        const ciphertext = encrypt_token(plaintext, secret);
        const corrupted = ciphertext.slice(0, -4) + 'AAAA';
        expect(() => decrypt_token(corrupted, secret)).toThrow(
            'Token decryption failed — token may have been encrypted with old key'
        );
    });

    it('different plaintexts produce different ciphertexts', () => {
        const ciphertext_a = encrypt_token('plaintext-a', secret);
        const ciphertext_b = encrypt_token('plaintext-b', secret);
        expect(ciphertext_a).not.toBe(ciphertext_b);
    });

    it('same plaintext encrypted twice produces different ciphertexts (random IV)', () => {
        const plaintext = 'ghp_abc123tokenvalue';
        const ciphertext_a = encrypt_token(plaintext, secret);
        const ciphertext_b = encrypt_token(plaintext, secret);
        expect(ciphertext_a).not.toBe(ciphertext_b);
    });

    it('empty string round-trip works', () => {
        const plaintext = '';
        const ciphertext = encrypt_token(plaintext, secret);
        const decrypted = decrypt_token(ciphertext, secret);
        expect(decrypted).toBe(plaintext);
    });

    it('unicode string round-trip works', () => {
        const plaintext = '🔐 tökën-válüe 日本語テスト';
        const ciphertext = encrypt_token(plaintext, secret);
        const decrypted = decrypt_token(ciphertext, secret);
        expect(decrypted).toBe(plaintext);
    });
});
