import type { PipelineStatus } from '$lib/types';

export interface EmptyStateConfig {
    icon: string
    message: string
    detail: string
    action_label: string
    action_href: string
}

export function get_empty_state(pipeline: PipelineStatus | null): EmptyStateConfig {
    if (pipeline?.state === 'running') {
        return {
            icon: 'hourglass_top',
            message: 'Pipeline is running.',
            detail: 'Agents will appear here when tasks are picked up.',
            action_label: 'View Pipeline',
            action_href: '/pipeline'
        };
    }
    if (pipeline?.state === 'paused') {
        return {
            icon: 'pause_circle',
            message: 'Pipeline is paused.',
            detail: 'Resume the pipeline to start processing tasks.',
            action_label: 'View Pipeline',
            action_href: '/pipeline'
        };
    }
    return {
        icon: 'smart_toy',
        message: 'Pipeline is idle.',
        detail: 'Submit a feature to start agent processing.',
        action_label: 'Go to Projects',
        action_href: '/projects'
    };
}
