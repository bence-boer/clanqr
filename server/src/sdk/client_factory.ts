/**
 * Factory for creating CopilotClient instances and monitoring CLI health.
 */
import { CopilotClient } from '@github/copilot-sdk';
import { env } from '../env';
import { logger } from '../utils/logger';

let shared_client: CopilotClient | null = null;
let health_interval: ReturnType<typeof setInterval> | null = null;

export function get_client(): CopilotClient {
    if (!shared_client) {
        shared_client = new CopilotClient({
            cliUrl: env.CLI_URL
        });
    }
    return shared_client;
}

export async function check_cli_health(): Promise<boolean> {
    try {
        const client = get_client();
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
            logger.error('CLI health check failed', { service: 'sdk', cli_url: env.CLI_URL });
        }
    }, 30_000);
}

export function stop_health_monitor(): void {
    if (health_interval) {
        clearInterval(health_interval);
        health_interval = null;
    }
}

export async function cleanup_expired_sessions(max_age_ms: number): Promise<void> {
    try {
        const client = get_client();
        const sessions = await client.listSessions();
        const now = Date.now();
        for (const session of sessions) {
            const age = now - new Date(session.startTime).getTime();
            if (age > max_age_ms) {
                await client.deleteSession(session.sessionId);
                logger.info('Deleted expired SDK session', { service: 'sdk', session_id: session.sessionId });
            }
        }
    }
    catch (err) {
        logger.warn('Failed to cleanup SDK sessions', { service: 'sdk', error: String(err) });
    }
}
