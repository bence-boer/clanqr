import type { Page } from "@playwright/test";

export const DEV_SESSION_COOKIE = "dev-session-token";
export const DEV_ADMIN_SESSION_COOKIE = "dev-admin-session-token";

export const API_URL = process.env.API_URL || "http://localhost:3001";

export const AUTH_HEADERS = { Cookie: `session=${DEV_SESSION_COOKIE}` };
export const ADMIN_AUTH_HEADERS = { Cookie: `session=${DEV_ADMIN_SESSION_COOKIE}` };

function cookie_domain(): string {
    if (process.env.BASE_URL) {
        try {
            return new URL(process.env.BASE_URL).hostname;
        } catch {
            return "localhost";
        }
    }
    return "localhost";
}

export async function authenticate(page: Page, admin = false): Promise<void> {
    const token = admin ? DEV_ADMIN_SESSION_COOKIE : DEV_SESSION_COOKIE;
    await page.context().addCookies([
        {
            name: "session",
            value: token,
            domain: cookie_domain(),
            path: "/",
        },
    ]);
}
