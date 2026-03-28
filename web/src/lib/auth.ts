import { BASE_URL } from '$lib/api/rpc';

export interface AuthStatus {
    authenticated: boolean
    is_setup: boolean
    user: {
        id: string
        github_id: number
        username: string
        display_name: string | null
        avatar_url: string | null
        role: string
    } | null
}

export async function check_auth(): Promise<AuthStatus> {
    try {
        const response = await fetch(`${BASE_URL}/api/auth/status`, {
            credentials: 'include'
        });
        if (!response.ok) {
            return { authenticated: false, is_setup: false, user: null };
        }
        return await response.json();
    }
    catch {
        return { authenticated: false, is_setup: false, user: null };
    }
}

export function login_github(): void {
    window.location.href = `${BASE_URL}/api/auth/login/github`;
}

export async function logout(): Promise<void> {
    await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
    });
}
