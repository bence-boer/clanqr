<script lang="ts">
    import { api } from '$lib/api/client';
    import { Button, Input, Select } from '$lib/components/primitives';
    import { V2_AGENT_TYPES } from '$lib/components/agent-type-badge/agent-type-colors';
    import { onMount } from 'svelte';

    interface V2Fields {
        agent_type: string
        execution_strategy: string
        definition_of_done: string
        skills_text: string
        context_paths_text: string
    }

    interface Props {
        task_id: string
        title: string
        description: string
        model: string | null
        v2?: V2Fields
        saving: boolean
        on_save: () => Promise<void>
        on_cancel: () => void
    }

    let {
        task_id, title = $bindable(), description = $bindable(),
        model = $bindable(), v2 = $bindable({ agent_type: 'implementer', execution_strategy: 'sequential', definition_of_done: '', skills_text: '', context_paths_text: '' }),
        saving, on_save, on_cancel
    }: Props = $props();

    let model_options = $state<{ value: string, label: string }[]>([]);
    let loading_models = $state(false);
    let models_loaded = $state(false);

    async function load_models() {
        if (models_loaded) return;
        loading_models = true;
        try {
            model_options = await api.list_models();
            models_loaded = true;
        }
        catch {
            model_options = [];
        }
        finally {
            loading_models = false;
        }
    }

    onMount(() => {
        load_models();
    });

    function handle_save() {
        if (model === '') model = null;
        return on_save();
    }

    const agent_types = V2_AGENT_TYPES.filter((t) => t !== 'chat');
    const strategies = ['sequential', 'parallel', 'background'] as const;
</script>

<div class="task-edit-form">
    <Input
        class="task-input"
        type="text"
        placeholder="Task title (optional)"
        bind:value={title}
        aria-label="Task title"
        onkeydown={(event) => {
            if (event.key === 'Enter') on_save();
            if (event.key === 'Escape') on_cancel();
        }}
    />
    <textarea
        class="task-desc-input"
        placeholder="Task description…"
        bind:value={description}
        rows="4"
        aria-label="Task description"
        onkeydown={(event) => {
            if (event.key === 'Escape') on_cancel();
        }}
    ></textarea>
    <div class="task-model-field">
        <Select id="task-model-{task_id}" label={`Model Override ${loading_models ? '(...)' : ''}`} bind:value={model} class="input select" disabled={loading_models}>
            <option value="">Feature default</option>
            {#each model_options as m (m.value)}
                <option value={m.value}>{m.label}</option>
            {/each}
        </Select>
    </div>
    <div class="v2-fields">
        <div class="v2-row">
            <Select id="task-agent-type-{task_id}" label="Agent Type" bind:value={v2.agent_type}>
                {#each agent_types as at (at)}<option value={at}>{at.charAt(0).toUpperCase() + at.slice(1)}</option>{/each}
            </Select>
            <Select id="task-strategy-{task_id}" label="Execution Strategy" bind:value={v2.execution_strategy}>
                {#each strategies as s (s)}<option value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>{/each}
            </Select>
        </div>
        <textarea class="task-desc-input" placeholder="Definition of done…"
            bind:value={v2.definition_of_done} rows="2" aria-label="Definition of done"></textarea>
        <Input type="text" placeholder="Skills (comma-separated)" bind:value={v2.skills_text} aria-label="Skills" />
        <Input type="text" placeholder="Context paths (comma-separated)" bind:value={v2.context_paths_text} aria-label="Context paths" />
    </div>
    <div class="task-edit-actions">
        <Button variant="primary" size="sm" onclick={handle_save} disabled={saving}>Save</Button>
        <Button variant="secondary" size="sm" onclick={on_cancel}>Cancel</Button>
    </div>
</div>

<style>
    .task-edit-form {
        display: flex; flex-direction: column; gap: 0.5rem;
        background: var(--bg); border: 1px solid var(--accent);
        border-radius: var(--radius); padding: 0.75rem;
    }
    .task-desc-input {
        width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius);
        background: var(--bg); color: var(--fg); font-size: 0.85rem; font-family: inherit;
        resize: vertical; line-height: 1.5;
    }
    .task-model-field { max-width: 300px; }
    .v2-fields { display: flex; flex-direction: column; gap: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border); }
    .v2-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
    .task-edit-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
</style>
