import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { api_fetch } from "$lib/api/client";

export interface AuthStatus {
    is_setup: boolean;
    authenticated: boolean;
    role: 'admin' | 'user' | null;
    passkey_id: string | null;
}

export async function check_auth(): Promise<AuthStatus> {
    return api_fetch<AuthStatus>("/api/auth/status");
}

export async function register_passkey(display_name: string, invite_token?: string): Promise<boolean> {
    const options = await api_fetch<any>("/api/auth/register/options", {
        method: "POST",
        body: JSON.stringify({ display_name, ...(invite_token ? { invite_token } : {}) }),
    });

    const credential = await startRegistration({ optionsJSON: options });

    const result = await api_fetch<{ verified: boolean }>("/api/auth/register/verify", {
        method: "POST",
        body: JSON.stringify({ credential, display_name, ...(invite_token ? { invite_token } : {}) }),
    });

    return result.verified;
}

export async function login_passkey(): Promise<boolean> {
    const options = await api_fetch<any>("/api/auth/login/options", {
        method: "POST",
    });

    const credential = await startAuthentication({ optionsJSON: options });

    const result = await api_fetch<{ verified: boolean }>("/api/auth/login/verify", {
        method: "POST",
        body: JSON.stringify({ credential }),
    });

    return result.verified;
}

export async function logout(): Promise<void> {
    await api_fetch("/api/auth/logout", { method: "POST" });
}
