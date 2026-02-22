import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AppBindings } from "../middleware/supabase";
import { env } from "../env";

const RP_NAME = "Ralph Agent Workspace";
const RP_ID = env.RP_ID;
const RP_ORIGIN = env.RP_ORIGIN;

// In-memory challenge store (short-lived, per-session)
const challenge_store = new Map<string, string>();

export const auth_routes = new Hono<AppBindings>();

// Check invite token status (public, no auth required)
auth_routes.get("/invite/status", async (context) => {
    const token = context.req.query("token");
    if (!token) return context.json({ valid: false, reason: "missing" });

    const db = context.get("supabase");
    const { data: invite } = await db
        .from("invite_tokens")
        .select("role, label, expires_at, used_at")
        .eq("token", token)
        .single();

    if (!invite) return context.json({ valid: false, reason: "not_found" });
    if (invite.used_at) return context.json({ valid: false, reason: "used" });
    if (new Date(invite.expires_at) <= new Date()) return context.json({ valid: false, reason: "expired" });

    return context.json({ valid: true, role: invite.role, label: invite.label, expires_at: invite.expires_at });
});

// Check if any passkeys are registered (setup status)
auth_routes.get("/status", async (context) => {
    const db = context.get("supabase");
    const { count } = await db
        .from("passkeys")
        .select("*", { count: "exact", head: true });
    const is_setup = (count ?? 0) > 0;

    // Check if current session is valid
    const token = getCookie(context, "session");
    let authenticated = false;
    let role: string | null = null;
    let passkey_id: string | null = null;
    if (token) {
        const { data } = await db
            .from("sessions")
            .select("id, expires_at, passkey_id")
            .eq("token", token)
            .gt("expires_at", new Date().toISOString())
            .single();
        if (data) {
            authenticated = true;
            passkey_id = data.passkey_id;
            const { data: passkey } = await db
                .from("passkeys")
                .select("role")
                .eq("id", data.passkey_id)
                .single();
            role = passkey?.role ?? null;
        }
    }

    return context.json({ is_setup, authenticated, role, passkey_id });
});

// Generate registration options (first-time setup or invite-based)
auth_routes.post("/register/options", async (context) => {
    const db = context.get("supabase");

    const { count } = await db
        .from("passkeys")
        .select("*", { count: "exact", head: true });
    const passkeys_exist = (count ?? 0) > 0;

    const body = await context.req.json<{ display_name?: string; invite_token?: string }>();

    if (passkeys_exist) {
        if (!body.invite_token) {
            return context.json({ error: "Passkey already registered" }, 403);
        }
        // Validate invite token
        const { data: invite } = await db
            .from("invite_tokens")
            .select("id")
            .eq("token", body.invite_token)
            .is("used_at", null)
            .gt("expires_at", new Date().toISOString())
            .single();
        if (!invite) {
            return context.json({ error: "Invalid or expired invite token" }, 400);
        }
    }

    const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: body.display_name ?? "admin",
        userDisplayName: body.display_name ?? "Admin",
        attestationType: "none",
        authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "preferred",
        },
    });

    // Store challenge: keyed by invite token for invited flows, generic key for first-time setup
    const challenge_key = body.invite_token
        ? `registration:${body.invite_token}`
        : "registration";
    challenge_store.set(challenge_key, options.challenge);
    setTimeout(() => challenge_store.delete(challenge_key), 120000);

    return context.json(options);
});

// Verify registration response
auth_routes.post("/register/verify", async (context) => {
    const db = context.get("supabase");

    const { count } = await db
        .from("passkeys")
        .select("*", { count: "exact", head: true });
    const passkeys_exist = (count ?? 0) > 0;

    const body = await context.req.json();
    const invite_token: string | undefined = body.invite_token;

    const challenge_key = invite_token
        ? `registration:${invite_token}`
        : "registration";
    const expected_challenge = challenge_store.get(challenge_key);

    if (!expected_challenge) {
        return context.json({ error: "Registration challenge expired" }, 400);
    }

    try {
        const verification = await verifyRegistrationResponse({
            response: body.credential,
            expectedChallenge: expected_challenge,
            expectedOrigin: RP_ORIGIN.split(",").map((o: string) => o.trim()),
            expectedRPID: RP_ID,
        });

        if (!verification.verified || !verification.registrationInfo) {
            return context.json({ error: "Verification failed" }, 400);
        }

        const { credential, credentialDeviceType, credentialBackedUp } =
            verification.registrationInfo;

        const passkey_id = crypto.randomUUID();

        // Determine role
        let role: string;
        if (!passkeys_exist) {
            // First-time setup: admin
            role = "admin";
        } else {
            // Invite flow: atomically claim the token and get role
            const { data: claimed } = await db
                .from("invite_tokens")
                .update({
                    used_at: new Date().toISOString(),
                    used_by_passkey_id: passkey_id,
                })
                .eq("token", invite_token)
                .is("used_at", null)
                .gt("expires_at", new Date().toISOString())
                .select("role")
                .single();
            if (!claimed) {
                return context.json({ error: "Invite token already used or expired" }, 409);
            }
            role = claimed.role;
        }

        // Store the passkey
        const { error } = await db.from("passkeys").insert({
            id: passkey_id,
            credential_id: Buffer.from(credential.id).toString("base64url"),
            public_key: Buffer.from(credential.publicKey).toString("base64url"),
            counter: Number(credential.counter),
            device_type: credentialDeviceType,
            backed_up: credentialBackedUp,
            transports: body.credential.response?.transports ?? null,
            display_name: body.display_name ?? "Admin",
            role,
        });

        if (error) {
            return context.json({ error: "Failed to store passkey" }, 500);
        }

        challenge_store.delete(challenge_key);

        // Create session
        const session_token = generate_session_token();
        const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        await db.from("sessions").insert({
            passkey_id,
            token: session_token,
            expires_at: expires_at.toISOString(),
        });

        setCookie(context, "session", session_token, {
            httpOnly: true,
            secure: RP_ID !== "localhost",
            sameSite: "Lax",
            path: "/",
            expires: expires_at,
        });

        return context.json({ verified: true });
    } catch (err) {
        console.error("[Auth register/verify error]", err);
        return context.json({ error: "Registration verification failed" }, 400);
    }
});

// Generate authentication options (login)
auth_routes.post("/login/options", async (context) => {
    const db = context.get("supabase");
    const { data: passkeys, count } = await db
        .from("passkeys")
        .select("credential_id, transports", { count: "exact" });

    if (!count || count === 0) {
        return context.json({ error: "No passkeys registered" }, 403);
    }

    const allow = (passkeys ?? []).map((p: any) => ({
        id: p.credential_id as string,
        transports: p.transports ?? [],
    }));

    const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: allow,
        userVerification: "preferred",
    });

    challenge_store.set("authentication", options.challenge);
    setTimeout(() => challenge_store.delete("authentication"), 120000);

    return context.json(options);
});

// Verify authentication response (login)
auth_routes.post("/login/verify", async (context) => {
    const db = context.get("supabase");
    const body = await context.req.json();
    const expected_challenge = challenge_store.get("authentication");

    if (!expected_challenge) {
        return context.json({ error: "Authentication challenge expired" }, 400);
    }

    // Find the passkey by credential ID
    const credential_id = body.credential.id;
    const { data: passkey } = await db
        .from("passkeys")
        .select("*")
        .eq("credential_id", credential_id)
        .single();

    if (!passkey) {
        return context.json({ error: "Passkey not found" }, 400);
    }

    try {
        const verification = await verifyAuthenticationResponse({
            response: body.credential,
            expectedChallenge: expected_challenge,
            expectedOrigin: RP_ORIGIN.split(",").map((o: string) => o.trim()),
            expectedRPID: RP_ID,
            credential: {
                id: passkey.credential_id,
                publicKey: Buffer.from(passkey.public_key, "base64url"),
                counter: Number(passkey.counter),
                transports: passkey.transports ?? [],
            },
        });

        if (!verification.verified) {
            return context.json({ error: "Verification failed" }, 400);
        }

        // Update counter
        await db
            .from("passkeys")
            .update({ counter: verification.authenticationInfo.newCounter })
            .eq("id", passkey.id);

        challenge_store.delete("authentication");

        // Create session
        const session_token = generate_session_token();
        const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await db.from("sessions").insert({
            passkey_id: passkey.id,
            token: session_token,
            expires_at: expires_at.toISOString(),
        });

        setCookie(context, "session", session_token, {
            httpOnly: true,
            secure: RP_ID !== "localhost",
            sameSite: "Lax",
            path: "/",
            expires: expires_at,
        });

        return context.json({ verified: true });
    } catch (err) {
        console.error("[Auth login/verify error]", err);
        return context.json({ error: "Authentication failed" }, 400);
    }
});

// Logout
auth_routes.post("/logout", async (context) => {
    const db = context.get("supabase");
    const token = getCookie(context, "session");
    if (token) {
        await db.from("sessions").delete().eq("token", token);
    }
    deleteCookie(context, "session", { path: "/" });
    return context.json({ success: true });
});

function generate_session_token(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString("base64url");
}
