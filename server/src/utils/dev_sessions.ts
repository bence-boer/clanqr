const dev_session_tokens = new Set([
    'dev-session-token',
    'dev-admin-session-token'
]);

const dev_user_ids = new Set([
    'dev-user',
    'dev-admin'
]);

export function is_dev_session_token(token: string): boolean {
    return dev_session_tokens.has(token);
}

export function is_dev_user_id(user_id: string): boolean {
    return dev_user_ids.has(user_id);
}
