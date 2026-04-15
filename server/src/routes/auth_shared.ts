import { createHash } from 'crypto';

export function generate_session_token(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('base64url');
}

export function hash_session_token(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}
