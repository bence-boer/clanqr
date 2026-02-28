import { Hono } from "hono";
import { z } from "zod";
import { admin_middleware } from "../middleware/auth";
import type { AppBindings } from "../middleware/supabase";
import { validate_uuid_params } from "../middleware/validate_params";
import { get_users, check_last_admin, get_invites, generate_invite } from "../services/admin_service";
import { agent_service } from "../services/agent_service";
import { get_metrics } from "../middleware/metrics";
import { logger } from "../utils/logger";

const update_role_schema = z.object({
    role: z.enum(["admin", "user"]),
});

const create_invite_schema = z.object({
    role: z.enum(["admin", "user"]),
    expires_at: z.string().datetime(),
    label: z.string().optional(),
});

export const admin_routes = new Hono<AppBindings>();

admin_routes.use("*", admin_middleware());

// List all passkeys as users
admin_routes.get("/", async (context) => {
    const db = context.get("supabase");
    try {
        const users = await get_users(db);
        return context.json(users);
    } catch (error) {
        logger.error("Failed to fetch users", { route: "GET /api/admin", error: String(error) });
        return context.json({ error: "Failed to fetch users" }, 500);
    }
});

// Update a user's role
admin_routes.patch("/:id", validate_uuid_params("id"), async (context) => {
    const id = context.req.param("id");
    const current_passkey_id = context.get("passkey_id");

    const body = await context.req.json();
    const parsed = update_role_schema.safeParse(body);
    if (!parsed.success) return context.json({ error: parsed.error.flatten() }, 400);

    const { role } = parsed.data;

    if (id === current_passkey_id && role !== "admin") {
        return context.json({ error: "Cannot demote yourself" }, 400);
    }

    const db = context.get("supabase");

    if (role !== "admin") {
        const is_last = await check_last_admin(db);
        if (is_last) {
            return context.json({ error: "Cannot demote the last admin" }, 400);
        }
    }

    const { data, error } = await db
        .from("passkeys")
        .update({ role })
        .eq("id", id)
        .select("id, display_name, role, created_at")
        .single();

    if (error) {
        logger.error("Failed to update role", { route: "PATCH /api/admin/:id", id, error: String(error) });
        return context.json({ error: "Failed to update role" }, 500);
    }
    return context.json(data);
});

// Revoke all sessions for a user
admin_routes.delete("/:id/sessions", validate_uuid_params("id"), async (context) => {
    const id = context.req.param("id");
    const current_passkey_id = context.get("passkey_id");

    if (id === current_passkey_id) {
        return context.json({ error: "Cannot revoke your own sessions" }, 400);
    }

    const db = context.get("supabase");
    const { error } = await db.from("sessions").delete().eq("passkey_id", id);
    if (error) {
        logger.error("Failed to revoke sessions", { route: "DELETE /api/admin/:id/sessions", id, error: String(error) });
        return context.json({ error: "Failed to revoke sessions" }, 500);
    }
    return context.json({ success: true });
});

// Delete a passkey
admin_routes.delete("/:id", validate_uuid_params("id"), async (context) => {
    const id = context.req.param("id");
    const current_passkey_id = context.get("passkey_id");

    if (id === current_passkey_id) {
        return context.json({ error: "Cannot delete yourself" }, 400);
    }

    const db = context.get("supabase");

    const { data: target } = await db
        .from("passkeys")
        .select("role")
        .eq("id", id)
        .single();

    if (target?.role === "admin") {
        const is_last = await check_last_admin(db);
        if (is_last) {
            return context.json({ error: "Cannot delete the last admin" }, 400);
        }
    }

    const { error } = await db.from("passkeys").delete().eq("id", id);
    if (error) {
        logger.error("Failed to delete user", { route: "DELETE /api/admin/:id", id, error: String(error) });
        return context.json({ error: "Failed to delete user" }, 500);
    }
    return context.json({ success: true });
});

// Bulk clear expired and used invites
admin_routes.delete("/invites/bulk-clear", async (context) => {
    const db = context.get("supabase");
    const now = new Date().toISOString();

    const { count } = await db
        .from("invite_tokens")
        .select("*", { count: "exact", head: true })
        .or(`used_at.not.is.null,expires_at.lt.${now}`);

    await db
        .from("invite_tokens")
        .delete()
        .or(`used_at.not.is.null,expires_at.lt.${now}`);

    return context.json({ deleted: count ?? 0 });
});

// List invite tokens
admin_routes.get("/invites", async (context) => {
    const db = context.get("supabase");
    try {
        const invites = await get_invites(db);
        return context.json(invites);
    } catch (error) {
        logger.error("Failed to fetch invites", { route: "GET /api/admin/invites", error: String(error) });
        return context.json({ error: "Failed to fetch invites" }, 500);
    }
});

// Create invite token
admin_routes.post("/invites", async (context) => {
    const body = await context.req.json();
    const parsed = create_invite_schema.safeParse(body);
    if (!parsed.success) return context.json({ error: parsed.error.flatten() }, 400);

    const { role, expires_at, label } = parsed.data;
    const now = Date.now();
    const expires_ms = new Date(expires_at).getTime();

    if (expires_ms <= now) {
        return context.json({ error: "expires_at must be in the future" }, 400);
    }
    if (expires_ms - now > 24 * 60 * 60 * 1000) {
        return context.json({ error: "expires_at must be at most 24 hours from now" }, 400);
    }

    const db = context.get("supabase");
    const created_by_passkey_id = context.get("passkey_id");

    try {
        const invite = await generate_invite(db, { role, expires_at, label, created_by_passkey_id });
        return context.json(invite, 201);
    } catch (error) {
        logger.error("Failed to create invite", { route: "POST /api/admin/invites", error: String(error) });
        return context.json({ error: "Failed to create invite" }, 500);
    }
});

// Delete invite token
admin_routes.delete("/invites/:id", validate_uuid_params("id"), async (context) => {
    const id = context.req.param("id");
    const db = context.get("supabase");

    const { data: invite } = await db
        .from("invite_tokens")
        .select("used_at")
        .eq("id", id)
        .single();

    if (!invite) return context.json({ error: "Invite not found" }, 404);
    if (invite.used_at) return context.json({ error: "Cannot delete a used invite" }, 400);

    const { error } = await db.from("invite_tokens").delete().eq("id", id);
    if (error) {
        logger.error("Failed to delete invite", { route: "DELETE /api/admin/invites/:id", id, error: String(error) });
        return context.json({ error: "Failed to delete invite" }, 500);
    }
    return context.json({ success: true });
});

// M-5.4: Trigger workspace cleanup manually
admin_routes.post("/cleanup-workspaces", async (context) => {
    const cleaned = agent_service.cleanup_old_workspaces(7);
    return context.json({ cleaned });
});

// M-10.3: Request metrics endpoint
admin_routes.get("/metrics", async (context) => {
    return context.json(get_metrics());
});
