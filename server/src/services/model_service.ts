import { get_connected_client, check_cli_health } from '../sdk/client_factory';
import { logger } from '../utils/logger';

export interface ModelOption {
    value: string
    label: string
    billing_multiplier?: number
    capabilities?: {
        supports_vision?: boolean
        supports_reasoning_effort?: boolean
        max_context_tokens?: number
    }
    policy_state?: string
    reasoning_efforts?: string[]
    default_reasoning_effort?: string
}

const FALLBACK_MODELS: ModelOption[] = [
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
    { value: 'o4-mini', label: 'O4 Mini' }
];

let cached_models: ModelOption[] | null = null;
let cache_expires_at = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function get_models(): Promise<ModelOption[]> {
    const now = Date.now();
    if (cached_models && now < cache_expires_at) {
        return cached_models;
    }

    try {
        const healthy = await check_cli_health();
        if (!healthy) {
            logger.warn('CLI not healthy, returning fallback models', { service: 'system' });
            return cached_models ?? FALLBACK_MODELS;
        }

        const client = await get_connected_client();
        const sdk_models = await client.listModels();

        const models: ModelOption[] = sdk_models
            .filter((m) => m.policy?.state !== 'disabled')
            .map((m) => ({
                value: m.id,
                label: m.name,
                billing_multiplier: m.billing?.multiplier,
                capabilities: {
                    supports_vision: m.capabilities?.supports?.vision,
                    supports_reasoning_effort: m.capabilities?.supports?.reasoningEffort,
                    max_context_tokens: m.capabilities?.limits?.max_context_window_tokens
                },
                policy_state: m.policy?.state,
                reasoning_efforts: m.supportedReasoningEfforts,
                default_reasoning_effort: m.defaultReasoningEffort
            }));

        if (models.length === 0) {
            logger.warn('SDK returned no models, using fallback', { service: 'system' });
            return cached_models ?? FALLBACK_MODELS;
        }

        cached_models = models;
        cache_expires_at = now + CACHE_TTL_MS;
        logger.info('Fetched models from SDK', { service: 'system', count: models.length });
        return models;
    }
    catch (err) {
        logger.error('Failed to fetch models from SDK', { service: 'system', error: String(err) });
        return cached_models ?? FALLBACK_MODELS;
    }
}

export function invalidate_model_cache(): void {
    cached_models = null;
    cache_expires_at = 0;
}
