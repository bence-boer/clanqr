/**
 * Dev session tokens used in test/development seed data.
 * These are intentionally non-secret — they are blocked in production
 * by the guard in middleware/auth.ts.
 *
 * Note: A previous `is_dev_user_id()` function was removed (SEC-013) because
 * it checked usernames ('dev-user', 'dev-admin') against UUIDs from
 * session.user_id — the check never matched and was dead code.
 * The `is_dev_session_token` check is the correct defense.
 */
const dev_session_tokens = new Set([
    'dev-session-token',
    'dev-admin-session-token'
]);

export function is_dev_session_token(token: string): boolean {
    return dev_session_tokens.has(token);
}
