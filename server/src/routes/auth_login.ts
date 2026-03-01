import {
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} from '@simplewebauthn/server';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import type { AppBindings } from '../middleware/supabase';
import { logger } from '../utils/logger';
import { challenge_store, generate_session_token, RP_ID, RP_ORIGIN } from './auth_shared';

export const login_routes = new Hono<AppBindings>();

// Generate authentication options (login)
login_routes.post('/options', async (context) => {
    const db = context.get('supabase');
    const { data: passkeys, count } = await db
        .from('passkeys')
        .select('credential_id, transports', { count: 'exact' });

    if (!count || count === 0) {
        return context.json({ error: 'No passkeys registered' }, 403);
    }

    const allow = (passkeys ?? []).map((p: { credential_id: string, transports?: string[] }) => ({
        id: p.credential_id,
        transports: (p.transports ?? []) as import('@simplewebauthn/server').AuthenticatorTransportFuture[]
    }));

    const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: allow,
        userVerification: 'preferred'
    });

    // Store challenge keyed by itself — each challenge is unique, enabling concurrent logins
    challenge_store.set(`auth:${options.challenge}`, options.challenge);
    setTimeout(() => challenge_store.delete(`auth:${options.challenge}`), 120000);

    return context.json(options);
});

// Verify authentication response (login)
login_routes.post('/verify', async (context) => {
    const db = context.get('supabase');
    const body = await context.req.json();

    // Extract challenge from the credential's clientDataJSON to support concurrent logins
    let expected_challenge: string | undefined;
    try {
        const client_data_raw = Buffer.from(body.credential?.response?.clientDataJSON ?? '', 'base64url').toString();
        const client_data = JSON.parse(client_data_raw);
        const sent_challenge = client_data.challenge as string;
        expected_challenge = challenge_store.get(`auth:${sent_challenge}`);
    }
    catch {
    // Fall through to challenge expired error
    }

    if (!expected_challenge) {
        return context.json({ error: 'Authentication challenge expired' }, 400);
    }

    // Find the passkey by credential ID
    const credential_id = body.credential.id;
    const { data: passkey } = await db
        .from('passkeys')
        .select('*')
        .eq('credential_id', credential_id)
        .single();

    if (!passkey) {
        return context.json({ error: 'Passkey not found' }, 400);
    }

    try {
        const verification = await verifyAuthenticationResponse({
            response: body.credential,
            expectedChallenge: expected_challenge,
            expectedOrigin: RP_ORIGIN.split(',').map((o: string) => o.trim()),
            expectedRPID: RP_ID,
            credential: {
                id: passkey.credential_id,
                publicKey: Buffer.from(passkey.public_key, 'base64url'),
                counter: Number(passkey.counter),
                transports: passkey.transports ?? []
            }
        });

        if (!verification.verified) {
            return context.json({ error: 'Verification failed' }, 400);
        }

        // Update counter
        await db
            .from('passkeys')
            .update({ counter: verification.authenticationInfo.newCounter })
            .eq('id', passkey.id);

        challenge_store.delete(`auth:${expected_challenge}`);

        // Create session
        const session_token = generate_session_token();
        const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await db.from('sessions').insert({
            passkey_id: passkey.id,
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
        logger.error('Auth login/verify error', { route: 'POST /api/auth/login/verify', error: String(err) });
        return context.json({ error: 'Authentication failed' }, 400);
    }
});
