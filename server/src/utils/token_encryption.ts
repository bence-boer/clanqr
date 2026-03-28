import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function derive_key(secret: string): Buffer {
    return createHash('sha256').update(secret).digest();
}

export function encrypt_token(plaintext: string, secret: string): string {
    const key = derive_key(secret);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const auth_tag = cipher.getAuthTag();
    return Buffer.concat([iv, auth_tag, encrypted]).toString('base64');
}

export function decrypt_token(ciphertext: string, secret: string): string {
    const key = derive_key(secret);
    const data = Buffer.from(ciphertext, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const auth_tag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(auth_tag);
    return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}
