const dev_session_tokens = new Set([
    'dev-session-token',
    'dev-admin-session-token'
]);

const dev_passkey_ids = new Set([
    'dev-passkey',
    'dev-admin'
]);

export function is_dev_session_token(token: string): boolean {
    return dev_session_tokens.has(token);
}

export function is_dev_passkey_id(passkey_id: string): boolean {
    return dev_passkey_ids.has(passkey_id);
}
