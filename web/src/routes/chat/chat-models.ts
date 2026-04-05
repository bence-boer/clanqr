import { generate_id } from '$lib/utils/id';
import type { ChatMessage, ModelOption } from '$lib/types';

export interface ModelGroup {
    group: string
    models: string[]
}

export function group_models(models: ModelOption[]): ModelGroup[] {
    const groups = new Map<string, string[]>();
    for (const m of models) {
        const id = m.value.toLowerCase();
        let group: string;
        if (id.startsWith('claude') || id.startsWith('anthropic')) group = 'Claude';
        else if (id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4')) group = 'GPT';
        else if (id.startsWith('gemini')) group = 'Gemini';
        else group = 'Other';

        const existing = groups.get(group);
        if (existing) {
            existing.push(m.value);
        }
        else {
            groups.set(group, [m.value]);
        }
    }
    return Array.from(groups.entries()).map(([group, models]) => ({ group, models }));
}

export function format_session_title(session: { title?: string | null, created_at: string }): string {
    return session.title ?? `Chat ${new Date(session.created_at).toLocaleDateString()}`;
}

export function build_message(role: 'user' | 'assistant', content: string): ChatMessage {
    return { id: generate_id(), role, content, created_at: new Date().toISOString() };
}
