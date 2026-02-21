import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { AppBindings } from "./middleware/supabase";
import { create_mock_supabase, TEST_SEED } from "./test-utils";
import type { SupabaseClient } from "@supabase/supabase-js";

type MockStore = Record<string, Record<string, any>[]>;

/**
 * Create a test Hono app with mock Supabase middleware and auth.
 * Returns the app instance and the backing data store for assertions.
 */
export function create_test_app(seed?: MockStore): {
    app: Hono<AppBindings>;
    store: MockStore;
    client: SupabaseClient;
} {
    const { client, store } = create_mock_supabase(seed ?? TEST_SEED);

    const app = new Hono<AppBindings>();

    // Mock supabase middleware — injects mock client
    app.use(
        "*",
        createMiddleware<AppBindings>(async (context, next) => {
            context.set("supabase", client);
            await next();
        })
    );

    // Mock auth middleware — reads session cookie like the real one
    app.use(
        "/api/*",
        createMiddleware<AppBindings>(async (context, next) => {
            const token = getCookie(context, "session");
            if (!token) {
                return context.json({ error: "Authentication required" }, 401);
            }

            // Look up session in mock store
            const sessions = store.sessions ?? [];
            const session = sessions.find(
                (s) => s.token === token && new Date(s.expires_at) > new Date()
            );
            if (!session) {
                return context.json({ error: "Session expired" }, 401);
            }

            const passkeys = store.passkeys ?? [];
            const passkey = passkeys.find((p) => p.id === session.passkey_id);

            context.set("passkey_id", session.passkey_id);
            context.set("role", passkey?.role ?? "user");
            await next();
        })
    );

    return { app, store, client };
}

/** Helper to make a request with a session cookie */
export function auth_headers(token: string = "test-session-token"): { Cookie: string } {
    return { Cookie: `session=${token}` };
}

export function admin_headers(): { Cookie: string } {
    return { Cookie: "session=test-admin-session-token" };
}
