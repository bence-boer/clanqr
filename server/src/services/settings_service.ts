/** Service for system-wide settings (key/value store backed by system_settings table). */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export interface SdkDefaults {
    default_model: string
    default_reasoning_effort: string
    default_timeout_minutes: number
    max_concurrent_sessions: number
    cost_per_premium_request: number
}

const SDK_DEFAULTS_KEY = 'sdk_defaults';

const FALLBACK: SdkDefaults = {
    default_model: 'gpt-4.1',
    default_reasoning_effort: 'medium',
    default_timeout_minutes: 30,
    max_concurrent_sessions: 3,
    cost_per_premium_request: 0.04
};

export async function get_sdk_defaults(supabase: SupabaseClient): Promise<SdkDefaults> {
    const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', SDK_DEFAULTS_KEY)
        .single();

    if (error || !data) {
        logger.warn('Failed to load sdk_defaults, using fallback', { error: String(error) });
        return FALLBACK;
    }
    return { ...FALLBACK, ...(data.value as Partial<SdkDefaults>) };
}

export async function update_sdk_defaults(
    supabase: SupabaseClient,
    updates: Partial<SdkDefaults>
): Promise<SdkDefaults> {
    const current = await get_sdk_defaults(supabase);
    const merged = { ...current, ...updates };

    const { error } = await supabase
        .from('system_settings')
        .upsert({ key: SDK_DEFAULTS_KEY, value: merged as unknown as Record<string, unknown> });

    if (error) {
        logger.error('Failed to update sdk_defaults', { error: String(error) });
        throw new Error('Failed to save settings');
    }
    return merged;
}
