import type { TypedSupabaseClient } from '../db';

export interface ActivityEvent {
    id: string;
    type: 'feature_complete' | 'task_failed' | 'task_complete' | 'manager_started' | 'agent_started' | 'agent_complete';
    message: string;
    timestamp: string;
    severity: 'success' | 'danger' | 'info' | 'warning' | 'muted';
    link?: string;
    icon: string;
}

export async function get_activity_feed(supabase: TypedSupabaseClient, limit = 20): Promise<ActivityEvent[]> {
    const { data: runs, error } = await supabase
        .from('agent_runs')
        .select('id, type, status, feature_id, task_id, started_at, finished_at, error, model')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error || !runs) return [];

    return runs.map((run) => {
        const ts = run.finished_at || run.started_at || new Date().toISOString();

        if (run.status === 'failed') {
            return {
                id: run.id,
                type: 'task_failed' as const,
                message: `${run.type === 'manager' ? 'Manager' : 'Task'} failed${run.error ? `: ${run.error.slice(0, 100)}` : ''}`,
                timestamp: ts,
                severity: 'danger' as const,
                link: run.feature_id ? `/projects?feature=${run.feature_id}` : undefined,
                icon: 'error'
            };
        }

        if (run.status === 'completed') {
            return {
                id: run.id,
                type: run.type === 'manager' ? 'manager_started' as const : 'task_complete' as const,
                message: run.type === 'manager'
                    ? 'Manager completed for feature'
                    : 'Task agent completed successfully',
                timestamp: ts,
                severity: 'success' as const,
                link: run.feature_id ? `/projects?feature=${run.feature_id}` : undefined,
                icon: 'check_circle'
            };
        }

        if (run.status === 'running') {
            return {
                id: run.id,
                type: 'agent_started' as const,
                message: `${run.type === 'manager' ? 'Manager' : 'Task agent'} is running`,
                timestamp: ts,
                severity: 'info' as const,
                link: run.feature_id ? `/projects?feature=${run.feature_id}` : undefined,
                icon: 'play_circle'
            };
        }

        return {
            id: run.id,
            type: 'agent_started' as const,
            message: `Agent ${run.status}`,
            timestamp: run.started_at || new Date().toISOString(),
            severity: 'muted' as const,
            icon: 'radio_button_unchecked'
        };
    });
}
