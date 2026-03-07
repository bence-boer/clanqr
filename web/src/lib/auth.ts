import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { BASE_URL } from '$lib/api/client';

async function auth_fetch<ResultType>(path: string, options?: RequestInit): Promise<ResultType> {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
    });
    if (!res.ok) throw new Error(`Auth error: ${res.status}`);
    if (res.status === 204) return {} as ResultType;
    return res.json();
}

export interface AuthStatus {
    is_setup: boolean
    authenticated: boolean
    role: 'admin' | 'user' | null
    passkey_id: string | null
}

export async function check_auth(): Promise<AuthStatus> {
    return auth_fetch<AuthStatus>('/api/auth/status');
}

export async function register_passkey(display_name: string, invite_token?: string): Promise<boolean> {
    type RegistrationOptions = Parameters<typeof startRegistration>[0]['optionsJSON'];
    const options = await auth_fetch<RegistrationOptions>('/api/auth/register/options', {
        method: 'POST',
        body: JSON.stringify({ display_name, ...(invite_token ? { invite_token } : {}) })
    });

    const credential = await startRegistration({ optionsJSON: options });

    const result = await auth_fetch<{ verified: boolean }>('/api/auth/register/verify', {
        method: 'POST',
        body: JSON.stringify({ credential, display_name, ...(invite_token ? { invite_token } : {}) })
    });

    return result.verified;
}

export async function login_passkey(): Promise<boolean> {
    type AuthenticationOptions = Parameters<typeof startAuthentication>[0]['optionsJSON'];
    const options = await auth_fetch<AuthenticationOptions>('/api/auth/login/options', {
        method: 'POST'
    });

    const credential = await startAuthentication({ optionsJSON: options });

    const result = await auth_fetch<{ verified: boolean }>('/api/auth/login/verify', {
        method: 'POST',
        body: JSON.stringify({ credential })
    });

    return result.verified;
}

export async function logout(): Promise<void> {
    await auth_fetch('/api/auth/logout', { method: 'POST' });
}
