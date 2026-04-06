/**
 * SDK session hooks for audit logging, permission control, context injection, and error recovery.
 */
import type { SessionConfig } from '@github/copilot-sdk';
import type { SdkSessionConfig } from './types';
import { audit_service } from '../services/audit_service';
import { logger } from '../utils/logger';

type SessionHooks = NonNullable<SessionConfig['hooks']>;

const SECRET_PATTERNS = [
    /(?:sk|pk)[-_][a-zA-Z0-9]{20,}/g,
    /ghp_[a-zA-Z0-9]{36}/g,
    /gho_[a-zA-Z0-9]{36}/g,
    /-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY-----/g
];

function redact_secrets(text: string): string {
    let result = text;
    for (const pattern of SECRET_PATTERNS) {
        result = result.replace(pattern, '[REDACTED]');
    }
    return result;
}

export function build_hooks(
    config: SdkSessionConfig,
    context_text: string,
    permissions: { allowed: string[], denied: string[] }
): SessionHooks {
    const { agent_type, session_id, entity_id } = config;

    return {
        onSessionStart: async () => {
            logger.info('SDK session started', { service: 'sdk', session_id, agent_type, entity_id });
            audit_service.log_event(session_id, null, 'session_start', { agent_type, entity_id: entity_id ?? '' });
            if (context_text) return { additionalContext: context_text };
        },

        onSessionEnd: async (input) => {
            const reason = 'reason' in input ? String(input.reason) : 'unknown';
            logger.info('SDK session ended', { service: 'sdk', session_id, reason });
            audit_service.log_event(session_id, null, 'session_end', { reason });
        },

        onPreToolUse: async (input) => {
            const tool = input.toolName;
            if (permissions.denied.length > 0 && permissions.denied.includes(tool)) {
                const reason = `Tool '${tool}' is not permitted for ${agent_type} agent`;
                audit_service.log_event(session_id, null, 'permission_denied', { tool_name: tool });
                logger.warn('Tool denied', { service: 'sdk', session_id, tool, agent_type });
                return { permissionDecision: 'deny' as const, permissionDecisionReason: reason };
            }
            audit_service.log_tool_call(session_id, null, tool, input.toolArgs);
            return { permissionDecision: 'allow' as const };
        },

        onPostToolUse: async (input) => {
            const result_str = typeof input.toolResult === 'string'
                ? input.toolResult
                : JSON.stringify(input.toolResult);
            const redacted = redact_secrets(result_str);
            const summary = redacted.length > 500 ? redacted.slice(0, 500) + '...' : redacted;
            audit_service.log_tool_result(session_id, null, input.toolName, summary);
        },

        onUserPromptSubmitted: async () => {
            // No-op: no prompt filtering needed
        },

        onErrorOccurred: async (input) => {
            const error_msg = 'errorMessage' in input ? String(input.errorMessage) : 'unknown';
            logger.error('SDK session error', {
                service: 'sdk', session_id, error: error_msg, agent_type
            });
            audit_service.log_event(session_id, null, 'error', { error: error_msg });
        }
    };
}
