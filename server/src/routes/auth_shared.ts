import { env } from '../env';

export const RP_NAME = 'Ralph Agent Workspace';
export const RP_ID = env.RP_ID;
export const RP_ORIGIN = env.RP_ORIGIN;

// In-memory challenge store (short-lived, per-session)
export const challenge_store = new Map<string, string>();

export function generate_session_token(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('base64url');
}
