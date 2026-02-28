import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { AppBindings } from "./supabase";

interface SessionWithPasskey {
    id: string;
    passkey_id: string;
    expires_at: string;
    passkeys: { role: "admin" | "user" }[] | null;
}

export function auth_middleware() {
    return createMiddleware<AppBindings>(async (context, next) => {
        const token = getCookie(context, "session");
        if (!token) {
            return context.json({ error: "Authentication required" }, 401);
        }

        const db = context.get("supabase");

        // Single query with join to get session + role (BE-012)
        const { data: session } = await db
            .from("sessions")
            .select("id, passkey_id, expires_at, passkeys(role)")
            .eq("token", token)
            .gt("expires_at", new Date().toISOString())
            .single();

        if (!session) {
            return context.json({ error: "Session expired" }, 401);
        }

        const typed_session = session as unknown as SessionWithPasskey;
        const role = typed_session.passkeys?.[0]?.role ?? "user";
        context.set("passkey_id", typed_session.passkey_id);
        context.set("role", role);

        await next();
    });
}

export function admin_middleware() {
    return createMiddleware<AppBindings>(async (context, next) => {
        if (context.get("role") !== "admin") {
            return context.json({ error: "Forbidden" }, 403);
        }
        await next();
    });
}
