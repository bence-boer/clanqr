import {
    generateRegistrationOptions,
    verifyRegistrationResponse
} from '@simplewebauthn/server';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import type { AppBindings } from '../middleware/supabase';
import { logger } from '../utils/logger';
import { challenge_store, generate_session_token, RP_NAME, RP_ID, RP_ORIGIN } from './auth_shared';

export const register_routes = new Hono<AppBindings>();

// Generate registration options (first-time setup or invite-based)
register_routes.post('/options', async (context) => {
    const db = context.get('supabase');

    const { count } = await db
        .from('passkeys')
        .select('*', { count: 'exact', head: true });
    const passkeys_exist = (count ?? 0) > 0;

    const body = await context.req.json<{ display_name?: string, invite_token?: string }>();

    if (passkeys_exist) {
        if (!body.invite_token) {
            return context.json({ error: 'Passkey already registered' }, 403);
        }
        // Validate invite token
        const { data: invite } = await db
            .from('invite_tokens')
            .select('id')
            .eq('token', body.invite_token)
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString())
            .single();
        if (!invite) {
            return context.json({ error: 'Invalid or expired invite token' }, 400);
        }
    }

    const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: body.display_name ?? 'admin',
        userDisplayName: body.display_name ?? 'Admin',
        attestationType: 'none',
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred'
        }
    });

    // Store challenge: keyed by invite token for invited flows, generic key for first-time setup
    const challenge_key = body.invite_token
        ? `registration:${body.invite_token}`
        : 'registration';
    challenge_store.set(challenge_key, options.challenge);
    setTimeout(() => challenge_store.delete(challenge_key), 120000);

    return context.json(options);
});

// Verify registration response
register_routes.post('/verify', async (context) => {
    const db = context.get('supabase');

    const { count } = await db
        .from('passkeys')
        .select('*', { count: 'exact', head: true });
    const passkeys_exist = (count ?? 0) > 0;

    const body = await context.req.json();
    const invite_token: string | undefined = body.invite_token;

    const challenge_key = invite_token
        ? `registration:${invite_token}`
        : 'registration';
    const expected_challenge = challenge_store.get(challenge_key);

    if (!expected_challenge) {
        return context.json({ error: 'Registration challenge expired' }, 400);
    }

    try {
        const verification = await verifyRegistrationResponse({
            response: body.credential,
            expectedChallenge: expected_challenge,
            expectedOrigin: RP_ORIGIN.split(',').map((o: string) => o.trim()),
            expectedRPID: RP_ID
        });

        if (!verification.verified || !verification.registrationInfo) {
            return context.json({ error: 'Verification failed' }, 400);
        }

        const { credential, credentialDeviceType: device_type, credentialBackedUp: backed_up }
            = verification.registrationInfo;

        const passkey_id = crypto.randomUUID();

        // Determine role
        let role: string;
        if (!passkeys_exist) {
            // First-time setup: admin
            role = 'admin';
        }
        else {
            // Invite flow: atomically claim the token (without FK reference yet)
            const { data: claimed } = await db
                .from('invite_tokens')
                .update({
                    used_at: new Date().toISOString()
                })
                .eq('token', invite_token)
                .is('used_at', null)
                .gt('expires_at', new Date().toISOString())
                .select('role')
                .single();
            if (!claimed) {
                return context.json({ error: 'Invite token already used or expired' }, 409);
            }
            role = claimed.role;
        }

        // Store the passkey
        const { error } = await db.from('passkeys').insert({
            id: passkey_id,
            credential_id: Buffer.from(credential.id).toString('base64url'),
            public_key: Buffer.from(credential.publicKey).toString('base64url'),
            counter: Number(credential.counter),
            device_type,
            backed_up,
            transports: body.credential.response?.transports ?? null,
            display_name: body.display_name ?? 'Admin',
            role
        });

        if (error) {
            return context.json({ error: 'Failed to store passkey' }, 500);
        }

        // Now update invite with the passkey reference (FK is satisfied)
        if (passkeys_exist && invite_token) {
            await db
                .from('invite_tokens')
                .update({ used_by_passkey_id: passkey_id })
                .eq('token', invite_token);
        }

        challenge_store.delete(challenge_key);

        // Create session
        const session_token = generate_session_token();
        const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        await db.from('sessions').insert({
            passkey_id,
            token: session_token,
            expires_at: expires_at.toISOString()
        });

        setCookie(context, 'session', session_token, {
            httpOnly: true,
            secure: RP_ID !== 'localhost',
            sameSite: 'Lax',
            path: '/',
            expires: expires_at
        });

        return context.json({ verified: true });
    }
    catch (err) {
        logger.error('Auth register/verify error', { route: 'POST /api/auth/register/verify', error: String(err) });
        return context.json({ error: 'Registration verification failed' }, 400);
    }
});
