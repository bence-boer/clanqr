/**
 * Factory for creating and managing the shared CopilotClient connection.
 * The client requires an explicit start() call to establish the TCP connection
 * before any RPC methods (getStatus, listModels, etc.) can be used.
 */
import { CopilotClient } from '@github/copilot-sdk';
import { env } from '../env';
import { logger } from '../utils/logger';

let shared_client: CopilotClient | null = null;
let client_started = false;
let start_promise: Promise<void> | null = null;
let health_interval: ReturnType<typeof setInterval> | null = null;

/**
 * Returns a connected CopilotClient. Lazily creates and starts the client
 * on the first call, reusing the same connection for subsequent calls.
 */
export async function get_connected_client(): Promise<CopilotClient> {
    if (shared_client && client_started) {
        return shared_client;
    }

    if (!shared_client) {
        shared_client = new CopilotClient({
            cliUrl: env.CLI_URL,
            autoStart: false
        });
    }

    if (!start_promise) {
        start_promise = shared_client.start().then(() => {
            client_started = true;
            logger.info('SDK client connected', {
                service: 'sdk',
                cli_url: env.CLI_URL
            });
        }).catch((err) => {
            start_promise = null;
            throw err;
        });
    }

    await start_promise;
    return shared_client;
}

export async function check_cli_health(): Promise<boolean> {
    try {
        const client = await get_connected_client();
        const status = await client.getStatus();
        return status !== undefined;
    }
    catch {
        logger.error('CLI server unreachable', { service: 'sdk' });
        return false;
    }
}

export function start_health_monitor(): void {
    if (health_interval) return;
    health_interval = setInterval(async () => {
        const healthy = await check_cli_health();
        if (!healthy) {
            logger.error('CLI health check failed', {
                service: 'sdk',
                cli_url: env.CLI_URL
            });
        }
    }, 30_000);
}

export function stop_health_monitor(): void {
    if (health_interval) {
        clearInterval(health_interval);
        health_interval = null;
    }
}

export async function stop_client(): Promise<void> {
    stop_health_monitor();
    if (shared_client && client_started) {
        try {
            await shared_client.stop();
        }
        catch (err) {
            logger.warn('Error stopping SDK client', {
                service: 'sdk',
                error: String(err)
            });
        }
    }
    shared_client = null;
    client_started = false;
    start_promise = null;
}

export async function cleanup_expired_sessions(
    max_age_ms: number
): Promise<void> {
    try {
        const client = await get_connected_client();
        const sessions = await client.listSessions();
        const now = Date.now();
        for (const session of sessions) {
            const age = now - new Date(session.startTime).getTime();
            if (age > max_age_ms) {
                await client.deleteSession(session.sessionId);
                logger.info('Deleted expired SDK session', {
                    service: 'sdk',
                    session_id: session.sessionId
                });
            }
        }
    }
    catch (err) {
        logger.warn('Failed to cleanup SDK sessions', {
            service: 'sdk',
            error: String(err)
        });
    }
}
