import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { AppBindings } from "./supabase";

export function auth_middleware() {
  return createMiddleware<AppBindings>(async (context, next) => {
    const token = getCookie(context, "session");
    if (!token) {
      return context.json({ error: "Authentication required" }, 401);
    }

    const db = context.get("supabase");
    const { data: session } = await db
      .from("sessions")
      .select("id, passkey_id, expires_at")
      .eq("token", token)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!session) {
      return context.json({ error: "Session expired" }, 401);
    }

    const { data: passkey } = await db
      .from("passkeys")
      .select("role")
      .eq("id", session.passkey_id)
      .single();

    context.set("passkey_id", session.passkey_id);
    context.set("role", passkey?.role ?? "user");

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
