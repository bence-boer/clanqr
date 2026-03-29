import { logger } from '../utils/logger';

interface ModelOption {
    value: string
    label: string
}

const copilot_models: ModelOption[] = [
    { value: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
    { value: 'claude-opus-4', label: 'Claude Opus 4' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'o4-mini', label: 'O4 Mini' }
];

export async function get_models(): Promise<ModelOption[]> {
    try {
        return copilot_models;
    }
    catch (err) {
        logger.error('Failed to get models', { service: 'system', error: String(err) });
        return copilot_models;
    }
}
