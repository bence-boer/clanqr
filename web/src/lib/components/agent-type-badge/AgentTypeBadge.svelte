<script lang="ts">
    import { get_agent_visual } from './agent-type-colors';

    let {
        agent_type,
        size = 'md'
    }: {
        agent_type: string
        size?: 'sm' | 'md'
    } = $props();

    const visual = $derived(get_agent_visual(agent_type));
    const is_sm = $derived(size === 'sm');
</script>

<span
    class="agent-badge"
    class:sm={is_sm}
    style:--agent-color={visual.color}
    title={visual.label}
>
    <span class="icon" style:font-size={is_sm ? '12px' : '14px'}>{visual.icon}</span>
    <span class="agent-label">{visual.label}</span>
</span>

<style>
    .agent-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        white-space: nowrap;
        background: color-mix(in srgb, var(--agent-color) 15%, transparent);
        color: var(--agent-color);
    }

    .agent-badge.sm {
        padding: 0.1rem 0.45rem;
        font-size: 0.65rem;
        gap: 0.2rem;
    }

    .agent-label {
        text-transform: capitalize;
    }
</style>
