/**
 * Chat session management — persistent multi-turn SDK sessions.
 *
 * The same SDK session is reused across messages via resumeSession(),
 * giving the model full conversation memory. On server restart, the cache
 * is empty but resumeSession() reconnects from CLI disk state.
 */
import type { CopilotSession } from '@github/copilot-sdk';
import { get_connected_client } from '../sdk/client_factory';
import { get_custom_agents } from '../sdk/custom_agents';
import { build_hooks } from '../sdk/hooks';
import { increment_session_count, decrement_session_count } from './session_pool_service';
import { logger } from '../utils/logger';
import type { SdkSessionConfig } from '../sdk/types';

const CHAT_MESSAGE_TIMEOUT_MS = 90 * 1000;

const chat_sessions = new Map<string, CopilotSession>();

function build_chat_session_id(chat_session_id: string): string {
    return `chat-${chat_session_id}`;
}

async function get_or_create_chat_session(
    chat_session_id: string, model: string
): Promise<CopilotSession> {
    const sdk_sid = build_chat_session_id(chat_session_id);
    const cached = chat_sessions.get(chat_session_id);
    if (cached) return cached;

    const client = await get_connected_client();
    const config: SdkSessionConfig = {
        session_id: sdk_sid, agent_type: 'researcher', model,
        entity_id: chat_session_id, entity_type: 'chat'
    };
    const hooks = build_hooks(config, '');
    const session_config = {
        sessionId: sdk_sid,
        model,
        customAgents: get_custom_agents(),
        agent: 'researcher',
        hooks,
        onPermissionRequest: async () => ({ kind: 'approved' as const })
    };

    let session: CopilotSession;
    try {
        session = await client.resumeSession(sdk_sid, session_config);
        logger.info('Resumed chat SDK session', { service: 'sdk', sdk_sid });
    }
    catch {
        session = await client.createSession(session_config);
        logger.info('Created new chat SDK session', { service: 'sdk', sdk_sid });
    }

    chat_sessions.set(chat_session_id, session);
    return session;
}

export async function chat_send(
    chat_session_id: string, model: string, message: string
): Promise<{ content: string }> {
    increment_session_count();
    try {
        const session = await get_or_create_chat_session(chat_session_id, model);
        const response = await session.sendAndWait({ prompt: message }, CHAT_MESSAGE_TIMEOUT_MS);
        return { content: response?.data?.content ?? '' };
    }
    catch (err) {
        const is_retryable = String(err).includes('session')
          || String(err).includes('disconnect')
          || String(err).includes('timeout');

        if (is_retryable && chat_sessions.has(chat_session_id)) {
            logger.warn('Chat session error, retrying with fresh session', {
                service: 'sdk', chat_session_id, error: String(err)
            });
            chat_sessions.delete(chat_session_id);
            const session = await get_or_create_chat_session(chat_session_id, model);
            const response = await session.sendAndWait({ prompt: message }, CHAT_MESSAGE_TIMEOUT_MS);
            return { content: response?.data?.content ?? '' };
        }
        throw err;
    }
    finally {
        decrement_session_count();
    }
}

export async function chat_delete_session(chat_session_id: string): Promise<void> {
    const sdk_sid = build_chat_session_id(chat_session_id);
    const cached = chat_sessions.get(chat_session_id);
    if (cached) {
        try {
            await cached.disconnect();
        }
        catch {
            // already disconnected
        }
        chat_sessions.delete(chat_session_id);
    }
    try {
        const client = await get_connected_client();
        await client.deleteSession(sdk_sid);
        logger.info('Deleted chat SDK session', { service: 'sdk', sdk_sid });
    }
    catch {
        // Session may not exist on CLI side — that's fine
    }
}
