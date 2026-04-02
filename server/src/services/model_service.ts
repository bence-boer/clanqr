import { get_client, check_cli_health } from '../sdk/client_factory';
import { logger } from '../utils/logger';

export interface ModelOption {
    value: string
    label: string
    billing_multiplier?: number
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

        const client = get_client();
        const sdk_models = await client.listModels();

        const models: ModelOption[] = sdk_models
            .filter((m) => m.policy?.state !== 'disabled')
            .map((m) => ({
                value: m.id,
                label: m.name,
                billing_multiplier: m.billing?.multiplier
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
