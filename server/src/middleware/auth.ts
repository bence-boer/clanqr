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

    await next();
  });
}
