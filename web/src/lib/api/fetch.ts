import { PUBLIC_API_URL } from '$env/static/public';
import { auth_store } from '$lib/stores/auth.svelte';
import { toast_store } from '$lib/stores/toast.svelte';

export const BASE_URL = PUBLIC_API_URL || '';

if (typeof window !== 'undefined' && !PUBLIC_API_URL) {
    console.warn(
        '[api] PUBLIC_API_URL is not set. API calls will use relative paths, '
        + 'which may route to the SvelteKit server instead of the Hono API.'
    );
}

export async function api_fetch<ReturnType>(path: string, options?: RequestInit): Promise<ReturnType> {
    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            auth_store.state = 'login';
            auth_store.role = null;
            auth_store.passkey_id = null;
            toast_store.error('Session expired — please sign in again');
            throw new Error('Session expired');
        }

        if (response.status === 403) {
            toast_store.error('You don\'t have permission to perform this action');
            throw new Error('Forbidden');
        }

        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error ?? `API error: ${response.status}`);
    }

    return response.json();
}
