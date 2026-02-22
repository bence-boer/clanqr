import { Hono } from "hono";
import { z } from "zod";
import { admin_middleware } from "../middleware/auth";
import type { AppBindings } from "../middleware/supabase";

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
    const { data, error } = await db
        .from("passkeys")
        .select("id, display_name, role, created_at, sessions(count)")
        .order("created_at", { ascending: true });

    if (error) {
        console.error(`[GET /api/admin]`, error);
        return context.json({ error: "Failed to fetch users" }, 500);
    }

    const users = (data ?? []).map((p: any) => ({
        id: p.id,
        display_name: p.display_name,
        role: p.role,
        created_at: p.created_at,
        session_count: p.sessions?.[0]?.count ?? 0,
    }));

    return context.json(users);
});

// Update a user's role
admin_routes.patch("/:id", async (context) => {
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

    // Check if this would remove the last admin
    if (role !== "admin") {
        const { count } = await db
            .from("passkeys")
            .select("*", { count: "exact", head: true })
            .eq("role", "admin");
        if ((count ?? 0) <= 1) {
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
        console.error(`[PATCH /api/admin/${id}]`, error);
        return context.json({ error: "Failed to update role" }, 500);
    }
    return context.json(data);
});

// Revoke all sessions for a user
admin_routes.delete("/:id/sessions", async (context) => {
    const id = context.req.param("id");
    const current_passkey_id = context.get("passkey_id");

    if (id === current_passkey_id) {
        return context.json({ error: "Cannot revoke your own sessions" }, 400);
    }

    const db = context.get("supabase");
    const { error } = await db.from("sessions").delete().eq("passkey_id", id);
    if (error) {
        console.error(`[DELETE /api/admin/${id}/sessions]`, error);
        return context.json({ error: "Failed to revoke sessions" }, 500);
    }
    return context.json({ success: true });
});

// Delete a passkey
admin_routes.delete("/:id", async (context) => {
    const id = context.req.param("id");
    const current_passkey_id = context.get("passkey_id");

    if (id === current_passkey_id) {
        return context.json({ error: "Cannot delete yourself" }, 400);
    }

    const db = context.get("supabase");

    // Check if this would remove the last admin
    const { data: target } = await db
        .from("passkeys")
        .select("role")
        .eq("id", id)
        .single();

    if (target?.role === "admin") {
        const { count } = await db
            .from("passkeys")
            .select("*", { count: "exact", head: true })
            .eq("role", "admin");
        if ((count ?? 0) <= 1) {
            return context.json({ error: "Cannot delete the last admin" }, 400);
        }
    }

    const { error } = await db.from("passkeys").delete().eq("id", id);
    if (error) {
        console.error(`[DELETE /api/admin/${id}]`, error);
        return context.json({ error: "Failed to delete user" }, 500);
    }
    return context.json({ success: true });
});

// Bulk clear expired and used invites — MUST be before /:id routes
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
    const now = new Date().toISOString();

    const { data, error } = await db
        .from("invite_tokens")
        .select(
            "id, label, role, expires_at, used_at, created_at, token, created_by_passkey_id, used_by_passkey_id, passkeys!invite_tokens_created_by_passkey_id_fkey(display_name), used_by:passkeys!invite_tokens_used_by_passkey_id_fkey(display_name)"
        )
        .order("created_at", { ascending: false });

    if (error) {
        console.error(`[GET /api/admin/invites]`, error);
        return context.json({ error: "Failed to fetch invites" }, 500);
    }

    const invites = (data ?? []).map((inv: any) => {
        const is_active = !inv.used_at && inv.expires_at > now;
        return {
            id: inv.id,
            label: inv.label,
            role: inv.role,
            expires_at: inv.expires_at,
            used_at: inv.used_at,
            created_at: inv.created_at,
            created_by_display_name: inv.passkeys?.display_name ?? null,
            used_by_display_name: inv.used_by?.display_name ?? null,
            token_preview: is_active ? inv.token.slice(0, 8) + "..." : null,
        };
    });

    return context.json(invites);
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

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Buffer.from(bytes).toString("base64url");

    const db = context.get("supabase");
    const created_by_passkey_id = context.get("passkey_id");

    const { data, error } = await db
        .from("invite_tokens")
        .insert({ role, expires_at, label: label ?? null, token, created_by_passkey_id })
        .select("id, label, role, expires_at, created_at")
        .single();

    if (error) {
        console.error(`[POST /api/admin/invites]`, error);
        return context.json({ error: "Failed to create invite" }, 500);
    }
    return context.json({ ...data, token }, 201);
});

// Delete invite token
admin_routes.delete("/invites/:id", async (context) => {
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
        console.error(`[DELETE /api/admin/invites/${id}]`, error);
        return context.json({ error: "Failed to delete invite" }, 500);
    }
    return context.json({ success: true });
});
