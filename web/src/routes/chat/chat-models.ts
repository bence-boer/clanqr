import { generate_id } from '$lib/utils/id';
import type { ChatMessage } from '$lib/types';

export interface ModelGroup {
    group: string
    models: string[]
}

export const chat_models: ModelGroup[] = [
    {
        group: 'Claude',
        models: [
            'claude-sonnet-4.6', 'claude-sonnet-4.5', 'claude-haiku-4.5',
            'claude-opus-4.6', 'claude-opus-4.6-fast', 'claude-opus-4.5', 'claude-sonnet-4'
        ]
    },
    { group: 'Gemini', models: ['gemini-3-pro-preview'] },
    {
        group: 'GPT',
        models: [
            'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.2', 'gpt-5.1-codex-max',
            'gpt-5.1-codex', 'gpt-5.1', 'gpt-5.1-codex-mini', 'gpt-5-mini', 'gpt-4.1'
        ]
    }
];

export function format_session_title(session: { title?: string | null, created_at: string }): string {
    return session.title ?? `Chat ${new Date(session.created_at).toLocaleDateString()}`;
}

export function build_message(session_id: string, role: 'user' | 'assistant', content: string): ChatMessage {
    return { id: generate_id(), session_id, role, content, created_at: new Date().toISOString() };
}
