import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AppBindings } from "../middleware/supabase";

const RP_NAME = "Ralph Agent Workspace";
const RP_ID = process.env.RP_ID ?? "localhost";
const RP_ORIGIN = process.env.RP_ORIGIN ?? "http://localhost:5173";

// In-memory challenge store (short-lived, per-session)
const challenge_store = new Map<string, string>();

export const auth_routes = new Hono<AppBindings>();

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
  if (token) {
    const { data } = await db
      .from("sessions")
      .select("id, expires_at")
      .eq("token", token)
      .gt("expires_at", new Date().toISOString())
      .single();
    authenticated = !!data;
  }

  return context.json({ is_setup, authenticated });
});

// Generate registration options (first-time setup only)
auth_routes.post("/register/options", async (context) => {
  const db = context.get("supabase");

  // Block registration if a passkey already exists
  const { count } = await db
    .from("passkeys")
    .select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    return context.json({ error: "Passkey already registered" }, 403);
  }

  const body = await context.req.json<{ display_name?: string }>();

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

  // Store challenge temporarily
  challenge_store.set("registration", options.challenge);
  setTimeout(() => challenge_store.delete("registration"), 120000);

  return context.json(options);
});

// Verify registration response
auth_routes.post("/register/verify", async (context) => {
  const db = context.get("supabase");

  // Block registration if a passkey already exists
  const { count } = await db
    .from("passkeys")
    .select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    return context.json({ error: "Passkey already registered" }, 403);
  }

  const body = await context.req.json();
  const expected_challenge = challenge_store.get("registration");

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

    // Store the passkey
    const passkey_id = crypto.randomUUID();
    const { error } = await db.from("passkeys").insert({
      id: passkey_id,
      credential_id: Buffer.from(credential.id).toString("base64url"),
      public_key: Buffer.from(credential.publicKey).toString("base64url"),
      counter: Number(credential.counter),
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      transports: body.credential.response?.transports?.join(",") ?? null,
      display_name: body.display_name ?? "Admin",
    });

    if (error) {
      return context.json({ error: "Failed to store passkey" }, 500);
    }

    challenge_store.delete("registration");

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
  } catch (err: any) {
    return context.json({ error: err.message }, 400);
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
    transports: p.transports?.split(",").filter(Boolean) ?? [],
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
        transports: passkey.transports?.split(",").filter(Boolean) ?? [],
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
  } catch (err: any) {
    return context.json({ error: err.message }, 400);
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
