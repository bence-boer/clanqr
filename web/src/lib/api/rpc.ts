import { PUBLIC_API_URL } from '$env/static/public';
import { auth_store } from '$lib/stores/auth.svelte';
import { toast_store } from '$lib/stores/toast.svelte';
import type { AppType } from 'server/src/public';
import { hc } from 'hono/client';

export const API_URL: string = PUBLIC_API_URL || '';

if (typeof window !== 'undefined' && !PUBLIC_API_URL) {
    console.warn(
        '[api] PUBLIC_API_URL is not set. API calls will use relative paths, '
        + 'which may route to the SvelteKit server instead of the Hono API.'
    );
}

const custom_fetch = async (endpoint: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await fetch(endpoint, {
        ...init,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers || {})
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            auth_store.reset();
            toast_store.error('Session expired — please sign in again');
            throw new Error('Session expired');
        }
        if (response.status === 403) {
            toast_store.error('You don\'t have permission to perform this action');
            throw new Error('Forbidden');
        }

        try {
            const body: unknown = await response.json();
            if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
                throw new Error(body.error);
            }
            throw new Error(`API error: ${response.status}`);
        }
        catch (e: unknown) {
            if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
    }

    return response;
};

export const BASE_URL = API_URL;

export const client = hc<AppType>(API_URL, {
    init: { credentials: 'include' },
    fetch: custom_fetch
});

// Narrow Hono RPC response union to success type — backed by runtime check
type ErrorResponse = { error: unknown };

function is_error(data: unknown): data is ErrorResponse {
    return typeof data === 'object' && data !== null && 'error' in data;
}

export function unwrap<ResponseType>(
    data: ResponseType
): Exclude<ResponseType, ErrorResponse> {
    if (is_error(data)) {
        const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        throw new Error(msg);
    }
    // Runtime check above guarantees data is not an error variant.
    // TypeScript cannot narrow generic types after type guards — this assertion is backed by the runtime check.
    return data as Exclude<ResponseType, ErrorResponse>;
}
