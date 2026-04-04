import type { TypedSupabaseClient } from '../db';

export interface UsageSummaryStats {
    total_runs: number
    today_runs: number
    week_runs: number
    completed_runs: number
    failed_runs: number
    total_duration_ms: number
    total_prompt_tokens: number
    total_completion_tokens: number
    total_cache_read_tokens: number
    total_cache_write_tokens: number
    total_estimated_cost: number
}

export interface UsageBreakdownStats {
    by_type: Record<string, number>
    by_model: Record<string, number>
    by_status: Record<string, number>
    by_model_cost: Record<string, number>
    total_prompt_tokens: number
    total_completion_tokens: number
    total_cache_read_tokens: number
    total_cache_write_tokens: number
    total_estimated_cost: number
}

export async function get_usage_summary(supabase: TypedSupabaseClient): Promise<UsageSummaryStats> {
    const now = new Date();
    const today_start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const week_start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [total_result, today_result, week_result] = await Promise.all([
        supabase.from('agent_sessions').select('id', { count: 'exact', head: true }),
        supabase
            .from('agent_sessions')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', today_start),
        supabase
            .from('agent_sessions')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', week_start)
    ]);

    const { data: stats_data } = await supabase
        .from('agent_sessions')
        .select('duration_ms, prompt_tokens, completion_tokens, cache_read_tokens, cache_write_tokens, status, estimated_cost');

    type AccType = {
        total_duration_ms: number
        total_prompt_tokens: number
        total_completion_tokens: number
        total_cache_read_tokens: number
        total_cache_write_tokens: number
        total_estimated_cost: number
        completed: number
        failed: number
    };
    type RunType = {
        duration_ms: number | null
        prompt_tokens: number | null
        completion_tokens: number | null
        cache_read_tokens: number | null
        cache_write_tokens: number | null
        estimated_cost: number | null
        status: string
    };

    const initial: AccType = {
        total_duration_ms: 0,
        total_prompt_tokens: 0,
        total_completion_tokens: 0,
        total_cache_read_tokens: 0,
        total_cache_write_tokens: 0,
        total_estimated_cost: 0,
        completed: 0,
        failed: 0
    };

    const stats = (stats_data ?? []).reduce(
        (acc: AccType, run: RunType) => ({
            total_duration_ms: acc.total_duration_ms + (run.duration_ms ?? 0),
            total_prompt_tokens: acc.total_prompt_tokens + (run.prompt_tokens ?? 0),
            total_completion_tokens: acc.total_completion_tokens + (run.completion_tokens ?? 0),
            total_cache_read_tokens: acc.total_cache_read_tokens + (run.cache_read_tokens ?? 0),
            total_cache_write_tokens: acc.total_cache_write_tokens + (run.cache_write_tokens ?? 0),
            total_estimated_cost: acc.total_estimated_cost + (run.estimated_cost ?? 0),
            completed: acc.completed + (run.status === 'completed' ? 1 : 0),
            failed: acc.failed + (run.status === 'failed' ? 1 : 0)
        }),
        initial
    );

    return {
        total_runs: total_result.count ?? 0,
        today_runs: today_result.count ?? 0,
        week_runs: week_result.count ?? 0,
        completed_runs: stats.completed,
        failed_runs: stats.failed,
        total_duration_ms: stats.total_duration_ms,
        total_prompt_tokens: stats.total_prompt_tokens,
        total_completion_tokens: stats.total_completion_tokens,
        total_cache_read_tokens: stats.total_cache_read_tokens,
        total_cache_write_tokens: stats.total_cache_write_tokens,
        total_estimated_cost: stats.total_estimated_cost
    };
}

export async function get_usage_breakdown(supabase: TypedSupabaseClient): Promise<UsageBreakdownStats> {
    const { data: runs, error } = await supabase
        .from('agent_sessions')
        .select('agent_type, model, status, prompt_tokens, completion_tokens, cache_read_tokens, cache_write_tokens, estimated_cost');

    if (error) throw error;

    const by_type: Record<string, number> = {};
    const by_model: Record<string, number> = {};
    const by_status: Record<string, number> = {};
    const by_model_cost: Record<string, number> = {};
    let total_prompt = 0;
    let total_completion = 0;
    let total_cache_read = 0;
    let total_cache_write = 0;
    let total_cost = 0;

    for (const run of runs ?? []) {
        by_type[run.agent_type] = (by_type[run.agent_type] ?? 0) + 1;
        by_status[run.status] = (by_status[run.status] ?? 0) + 1;
        const model_name = run.model || 'unknown';
        by_model[model_name] = (by_model[model_name] ?? 0) + 1;
        const cost = run.estimated_cost ?? 0;
        by_model_cost[model_name] = (by_model_cost[model_name] ?? 0) + cost;
        total_prompt += run.prompt_tokens ?? 0;
        total_completion += run.completion_tokens ?? 0;
        total_cache_read += run.cache_read_tokens ?? 0;
        total_cache_write += run.cache_write_tokens ?? 0;
        total_cost += cost;
    }

    return {
        by_type,
        by_model,
        by_status,
        by_model_cost,
        total_prompt_tokens: total_prompt,
        total_completion_tokens: total_completion,
        total_cache_read_tokens: total_cache_read,
        total_cache_write_tokens: total_cache_write,
        total_estimated_cost: total_cost
    };
}
