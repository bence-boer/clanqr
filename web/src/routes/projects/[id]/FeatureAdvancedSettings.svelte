<script lang="ts">
    import { Input } from '$lib/components/primitives/input';
    import { Select } from '$lib/components/primitives/select';
    import type { FailureBehavior } from '$lib/types';

    interface Props {
        on_task_failure: FailureBehavior
        task_timeout_minutes: number
    }

    let {
        on_task_failure = $bindable(),
        task_timeout_minutes = $bindable()
    }: Props = $props();

    let show_advanced = $state(false);
</script>

<button type="button" class="advanced-toggle" onclick={() => (show_advanced = !show_advanced)}>
    <span class="icon" style="font-size:16px">{show_advanced ? 'expand_less' : 'expand_more'}</span>
    Advanced Settings
</button>

{#if show_advanced}
    <div class="advanced-section">
        <div class="selection-grid">
            <div class="field">
                <Select id="failure-select" label="On Task Failure" bind:value={on_task_failure} class="input select">
                    <option value="stop">Stop</option>
                    <option value="retry">Retry</option>
                    <option value="skip">Skip</option>
                </Select>
            </div>
            <div class="field">
                <Input id="timeout-input" type="number" bind:value={task_timeout_minutes} class="input" label="Task Timeout (min)" min="1" max="60" />
            </div>
        </div>
    </div>
{/if}

<style>
    .selection-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
    }
    .field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }
    .advanced-toggle {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        background: transparent;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.5rem 0.75rem;
        color: var(--fg-muted);
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.15s;
        width: 100%;
        font-family: var(--font);
    }
    .advanced-toggle:hover {
        border-color: var(--accent);
        color: var(--fg);
    }
    .advanced-section {
        animation: slide-down 200ms ease;
    }
    @keyframes slide-down {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 768px) {
        .selection-grid { grid-template-columns: 1fr; }
    }
</style>
