import { COPILOT_BIN, build_agent_env } from '../env';
import { logger } from '../utils/logger';

interface ModelOption {
    value: string
    label: string
}

let cached_copilot_models: ModelOption[] | null = null;
const cached_gemini_models: ModelOption[] = [
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' }
];

function format_model_label(id: string): string {
    return id
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export async function get_models(cli: string): Promise<ModelOption[]> {
    if (cli === 'gemini') {
        return cached_gemini_models;
    }

    if (cached_copilot_models) return cached_copilot_models;

    try {
        const proc = Bun.spawn([COPILOT_BIN, '--help'], {
            stdout: 'pipe',
            stderr: 'pipe',
            env: build_agent_env()
        });
        const output = await new Response(proc.stdout).text();
        await proc.exited;

        const match = output.match(/--model\s+<model>\s+.*?\(choices:\s*([\s\S]*?)\)/);
        if (match) {
            const choices_str = match[1];
            const model_ids = [...choices_str.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
            cached_copilot_models = model_ids.map((id) => ({ value: id, label: format_model_label(id) }));
        }
    }
    catch (err) {
        logger.error('Failed to parse models from Copilot CLI', { service: 'system', error: String(err) });
    }

    if (!cached_copilot_models) {
        cached_copilot_models = [];
    }

    return cached_copilot_models;
}
