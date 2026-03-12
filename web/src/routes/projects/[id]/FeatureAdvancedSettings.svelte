<script lang="ts">
    import { api } from '$lib/api/client';
    import { Input } from '$lib/components/primitives/input';
    import { Select } from '$lib/components/primitives/select';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { FailureBehavior } from '$lib/types';

    interface ModelOption {
        value: string
        label: string
    }

    interface Props {
        cli: string
        execution_cli: string
        planning_model: string
        execution_model: string
        on_task_failure: FailureBehavior
        task_timeout_minutes: number
    }

    let {
        cli = $bindable(),
        execution_cli = $bindable(),
        planning_model = $bindable(),
        execution_model = $bindable(),
        on_task_failure = $bindable(),
        task_timeout_minutes = $bindable()
    }: Props = $props();

    let planning_models = $state<ModelOption[]>([]);
    let execution_models = $state<ModelOption[]>([]);
    let loading_planning = $state(false);
    let loading_execution = $state(false);
    let last_planning_cli = $state('');
    let last_execution_cli = $state('');
    let show_advanced = $state(false);

    const plan_lbl = $derived(`Planning Model ${loading_planning ? '(loading...)' : ''}`);
    const exec_lbl = $derived(`Execution Model ${loading_execution ? '(loading...)' : ''}`);

    const is_default_planning = $derived.by(() => {
        if (!planning_models.length || !planning_model) return false;
        return planning_model === planning_models[0].value;
    });
    const is_default_execution = $derived.by(() => {
        if (!execution_models.length || !execution_model) return false;
        return execution_model === execution_models[0].value;
    });

    async function load_models_for(target_cli: string, kind: 'planning' | 'execution') {
        const is_planning = kind === 'planning';
        const last = is_planning ? last_planning_cli : last_execution_cli;
        if (target_cli === last) return;
        if (is_planning) loading_planning = true;
        else loading_execution = true;
        try {
            const result = await api.list_models(target_cli);
            if (is_planning) {
                planning_models = result;
                last_planning_cli = target_cli;
                if (!result.find((m) => m.value === planning_model) && result.length > 0) planning_model = result[0].value;
            }
            else {
                execution_models = result;
                last_execution_cli = target_cli;
                if (!result.find((m) => m.value === execution_model) && result.length > 0) execution_model = result[0].value;
            }
        }
        catch {
            toast_store.error(`Failed to load ${kind} models`);
        }
        finally {
            if (is_planning) loading_planning = false;
            else loading_execution = false;
        }
    }

    $effect(() => {
        load_models_for(cli, 'planning');
        load_models_for(execution_cli, 'execution');
    });
</script>

<button type="button" class="advanced-toggle" onclick={() => (show_advanced = !show_advanced)}>
    <span class="icon" style="font-size:16px">{show_advanced ? 'expand_less' : 'expand_more'}</span>
    Advanced Settings
</button>

{#if show_advanced}
    <div class="advanced-section">
        <div class="selection-grid">
            <div class="field">
                <Select id="cli-select" label="Planning CLI" bind:value={cli} class="input select">
                    <option value="copilot">Copilot CLI</option>
                    <option value="gemini">Gemini CLI</option>
                </Select>
            </div>
            <div class="field">
                <Select id="planning-model-select" label={plan_lbl} bind:value={planning_model} disabled={loading_planning}>
                    {#each planning_models as m (m.value)}
                        <option value={m.value}>{m.label}{is_default_planning && m.value === planning_models[0]?.value ? ' (Recommended)' : ''}</option>
                    {/each}
                </Select>
                <span class="help-text">The AI model that breaks your feature into tasks</span>
            </div>
            <div class="field">
                <Select id="execution-cli-select" label="Execution CLI" bind:value={execution_cli} class="input select">
                    <option value="copilot">Copilot CLI</option>
                    <option value="gemini">Gemini CLI</option>
                </Select>
            </div>
            <div class="field">
                <Select id="execution-model-select" label={exec_lbl} bind:value={execution_model} disabled={loading_execution}>
                    {#each execution_models as m (m.value)}
                        <option value={m.value}>{m.label}{is_default_execution && m.value === execution_models[0]?.value ? ' (Recommended)' : ''}</option>
                    {/each}
                </Select>
                <span class="help-text">The AI model that implements each task</span>
            </div>
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
    .selection-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .field { display: flex; flex-direction: column; gap: 0.35rem; }
    .help-text { font-size: 0.7rem; color: var(--fg-muted); font-style: italic; }
    .advanced-toggle {
        display: flex; align-items: center; gap: 0.3rem;
        background: transparent; border: 1px solid var(--border); border-radius: var(--radius);
        padding: 0.5rem 0.75rem; color: var(--fg-muted); font-size: 0.85rem;
        cursor: pointer; transition: all 0.15s; width: 100%;
        font-family: var(--font);
    }
    .advanced-toggle:hover { border-color: var(--accent); color: var(--fg); }
    .advanced-section { animation: slide-down 200ms ease; }
    @keyframes slide-down {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 768px) {
        .selection-grid { grid-template-columns: 1fr; }
    }
</style>
