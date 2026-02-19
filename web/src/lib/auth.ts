import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { PUBLIC_API_URL } from "$env/static/public";

const BASE = PUBLIC_API_URL || "";

async function api_fetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error ?? `API error: ${response.status}`);
  }
  return response.json();
}

export interface AuthStatus {
  is_setup: boolean;
  authenticated: boolean;
}

export async function check_auth(): Promise<AuthStatus> {
  return api_fetch<AuthStatus>("/api/auth/status");
}

export async function register_passkey(display_name: string): Promise<boolean> {
  const options = await api_fetch<any>("/api/auth/register/options", {
    method: "POST",
    body: JSON.stringify({ display_name }),
  });

  const credential = await startRegistration({ optionsJSON: options });

  const result = await api_fetch<{ verified: boolean }>("/api/auth/register/verify", {
    method: "POST",
    body: JSON.stringify({ credential, display_name }),
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
