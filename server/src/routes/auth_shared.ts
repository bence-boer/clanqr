// In-memory challenge store (short-lived, per-session)
export const challenge_store = new Map<string, string>();

export function generate_session_token(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('base64url');
}
