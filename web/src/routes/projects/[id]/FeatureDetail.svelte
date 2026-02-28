<script lang="ts">
    import { api } from '$lib/api/client';
    import { ErrorBanner } from '$lib/components';
    import { Badge, Button, Input, Select, Textarea } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { AgentRun, Feature, PipelineStatus } from '$lib/types';
    import { status_icon, status_class } from '$lib/utils/status';
    import TaskList from './TaskList.svelte';

    interface Props {
        feature: Feature;
        agent_info: { processes: AgentRun[]; pipeline: PipelineStatus } | null;
        on_submit: (feature_id: string) => Promise<void>;
        on_delete: (feature_id: string) => Promise<void>;
        on_update: () => Promise<void>;
        on_back: () => void;
    }

    let { feature, agent_info, on_submit, on_delete, on_update, on_back }: Props = $props();

    let editing = $state(false);
    let edit_title = $state('');
    let edit_description = $state('');
    let edit_model = $state('');
    let edit_cli = $state('copilot');
    let edit_models = $state<{ value: string; label: string }[]>([]);
    let loading_edit_models = $state(false);
    let saving_edit = $state(false);

    let new_resource_url = $state('');
    let new_resource_title = $state('');

    let last_edit_cli = $state('');
    let last_edit_feature_id = $state('');

    async function load_edit_models(cli: string) {
        if (cli === last_edit_cli && feature.id === last_edit_feature_id) return;
        loading_edit_models = true;
        try {
            edit_models = await api.list_models(cli);
            if (!edit_models.find((m) => m.value === edit_model) && edit_models.length > 0) {
                edit_model = edit_models[0].value;
            }
            last_edit_cli = cli;
            last_edit_feature_id = feature.id;
        } catch (err) {
            console.error('Failed to load edit models:', err);
            toast_store.error('Failed to load models');
        } finally {
            loading_edit_models = false;
        }
    }

    $effect(() => {
        if (editing) {
            load_edit_models(edit_cli);
        }
    });

    function start_editing() {
        edit_title = feature.title;
        edit_description = feature.description ?? '';
        edit_cli = feature.cli ?? 'copilot';
        edit_model = feature.model ?? '';
        editing = true;
    }

    function cancel_editing() {
        editing = false;
    }

    async function save_edit() {
        if (!edit_title.trim()) return;
        saving_edit = true;
        try {
            await api.update_feature(feature.id, {
                title: edit_title.trim(),
                description: edit_description.trim() || null,
                cli: edit_cli,
                model: edit_model || null
            } as Partial<Feature>);
            editing = false;
            await on_update();
        } catch (error) {
            console.error('Failed to update feature:', error);
            toast_store.error('Failed to update feature');
        } finally {
            saving_edit = false;
        }
    }

    async function add_resource() {
        if (!new_resource_url.trim()) return;
        try {
            await api.add_resource(feature.id, {
                url: new_resource_url.trim(),
                title: new_resource_title.trim() || undefined
            });
            new_resource_url = '';
            new_resource_title = '';
            await on_update();
        } catch (error) {
            console.error('Failed to add resource:', error);
            toast_store.error('Failed to add resource');
        }
    }

    async function remove_resource(resource_id: string) {
        try {
            await api.delete_resource(feature.id, resource_id);
            await on_update();
        } catch (error) {
            console.error('Failed to delete resource:', error);
            toast_store.error('Failed to delete resource');
        }
    }

    async function handle_approve(task_id: string) {
        try {
            await api.approve_task(task_id);
            await on_update();
        } catch (error) {
            console.error('Failed to approve task:', error);
            toast_store.error('Failed to approve task');
        }
    }

    async function handle_approve_all(feature_id: string) {
        try {
            await api.approve_all_tasks(feature_id);
            await on_update();
        } catch (error) {
            console.error('Failed to approve tasks:', error);
            toast_store.error('Failed to approve tasks');
        }
    }

    async function handle_spawn(task_id: string) {
        try {
            await api.spawn_ralph(task_id);
            await on_update();
        } catch (error) {
            console.error('Failed to spawn ralph:', error);
            toast_store.error('Failed to spawn ralph');
        }
    }

    async function handle_add_task(description: string) {
        try {
            await api.create_task({ feature_id: feature.id, description });
            await on_update();
        } catch (error) {
            console.error('Failed to add task:', error);
            toast_store.error('Failed to add task');
        }
    }

    async function handle_update_task(task_id: string, description: string) {
        try {
            await api.update_task(task_id, { description });
            await on_update();
        } catch (error) {
            console.error('Failed to update task:', error);
            toast_store.error('Failed to update task');
        }
    }

    async function handle_delete_task(task_id: string) {
        if (!confirm('Delete this task?')) return;
        try {
            await api.delete_task(task_id);
            await on_update();
        } catch (error) {
            console.error('Failed to delete task:', error);
            toast_store.error('Failed to delete task');
        }
    }

    async function handle_toggle_auto_approve(enabled: boolean) {
        try {
            await api.update_feature(feature.id, { auto_approve: enabled } as Partial<Feature>);
            await on_update();
        } catch (error) {
            console.error('Failed to update auto-approve:', error);
            toast_store.error('Failed to update auto-approve');
        }
    }
</script>

<div class="detail-top-bar">
    <Button variant="ghost" size="sm" onclick={on_back}>
        <span class="icon">arrow_back</span>
    </Button>
</div>
<div class="detail-header">
    <div style="display:flex; flex-direction:column; gap:0.25rem">
        <h3>{feature.title}</h3>
        {#if agent_info && (agent_info.processes.some((p) => p.status === 'running') || ((agent_info.pipeline as any).is_active_feature && agent_info.pipeline.state === 'running'))}
            <div class="agent-running-indicator">
                <span class="icon spin" style="font-size:12px; color:var(--accent)">progress_activity</span>
                <span style="font-size:0.65rem; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:0.05em">
                    {agent_info.processes.some((p) => p.status === 'running' && p.type === 'manager') ? 'Manager Processing' : 'Ralph Working'}
                </span>
            </div>
        {/if}
    </div>
    <div class="detail-actions">
        {#if feature.status === 'Draft' && !editing}
            <Button variant="secondary" size="sm" onclick={start_editing}>
                <span class="icon" style="font-size:14px">edit</span> Edit
            </Button>
            <Button variant="primary" size="sm" onclick={() => on_submit(feature.id)}>
                <span class="icon" style="font-size:14px">send</span> Submit
            </Button>
        {/if}
        <Button variant="danger" size="sm" onclick={() => on_delete(feature.id)}>
            <span class="icon" style="font-size:14px">delete</span>
        </Button>
    </div>
</div>

{#if feature.last_error}
    <ErrorBanner message="{feature.last_error}{feature.manager_retry_count > 0 ? ` (retry ${feature.manager_retry_count}/3)` : ''}" />
{/if}

<div class="detail-body">
    {#if editing}
        <form
            class="edit-feature-form"
            onsubmit={(e) => {
                e.preventDefault();
                save_edit();
            }}
        >
            <Input id="edit-title" type="text" bind:value={edit_title} label="Title" required />
            <Textarea id="edit-desc" bind:value={edit_description} label="Description" rows={4} />

            <div class="selection-grid">
                <div class="field">
                    <Select id="edit-cli" label="CLI Engine" bind:value={edit_cli} class="input select">
                        <option value="copilot">Copilot CLI</option>
                        <option value="gemini">Gemini CLI</option>
                    </Select>
                </div>
                <div class="field">
                    <Select
                        id="edit-model"
                        label={`Model ${loading_edit_models ? '(...)' : ''}`}
                        bind:value={edit_model}
                        class="input select"
                        disabled={loading_edit_models}
                    >
                        {#each edit_models as m}
                            <option value={m.value}>{m.label}</option>
                        {/each}
                    </Select>
                </div>
            </div>

            <div class="form-actions">
                <Button type="button" variant="secondary" size="sm" onclick={cancel_editing}>Cancel</Button>
                <Button type="submit" variant="primary" size="sm" disabled={saving_edit || !edit_title.trim()}>
                    {saving_edit ? 'Saving...' : 'Save'}
                </Button>
            </div>
        </form>
    {:else}
        <div class="detail-section">
            <h4><span class="icon" style="font-size:16px">description</span> Description</h4>
            <div class="description-text">{feature.description ?? 'No description'}</div>
        </div>

        <div class="detail-section">
            <h4><span class="icon" style="font-size:16px">smart_toy</span> Engine & Model</h4>
            <div style="display:flex; gap:0.5rem">
                <Badge variant="muted">{feature.cli || 'copilot'}</Badge>
                <Badge variant="info">{feature.model || 'Default (auto)'}</Badge>
            </div>
        </div>

        {#if feature.resources && feature.resources.length > 0}
            <div class="detail-section">
                <h4><span class="icon" style="font-size:16px">link</span> Resources</h4>
                <ul class="resource-list">
                    {#each feature.resources as resource}
                        <li>
                            <a href={resource.url} target="_blank" rel="noopener">
                                <span class="icon" style="font-size:14px">open_in_new</span>
                                {resource.title ?? resource.url}
                            </a>
                            <div class="resource-actions">
                                <span class="badge badge-{status_class(resource.status)}">
                                    <span class="icon" style="font-size:11px">{status_icon(resource.status)}</span>
                                    {resource.status}
                                </span>
                                {#if feature.status === 'Draft'}
                                    <Button variant="danger" size="icon" onclick={() => remove_resource(resource.id)} title="Remove resource">
                                        <span class="icon" style="font-size:14px">close</span>
                                    </Button>
                                {/if}
                            </div>
                        </li>
                    {/each}
                </ul>
            </div>
        {/if}

        {#if feature.status === 'Draft'}
            <div class="detail-section">
                <h4><span class="icon" style="font-size:16px">add_link</span> Add Resource</h4>
                <div class="add-resource-row">
                    <Input type="url" placeholder="https://..." bind:value={new_resource_url} class="input" />
                    <Input type="text" placeholder="Title" bind:value={new_resource_title} class="input input-title" />
                    <Button variant="primary" size="sm" onclick={add_resource} disabled={!new_resource_url.trim()}>
                        <span class="icon" style="font-size:14px">add</span> Add
                    </Button>
                </div>
            </div>
        {/if}

        <TaskList
            {feature}
            on_approve={handle_approve}
            on_approve_all={handle_approve_all}
            on_spawn={handle_spawn}
            on_add={handle_add_task}
            on_update={handle_update_task}
            on_delete={handle_delete_task}
            on_toggle_auto_approve={handle_toggle_auto_approve}
        />
    {/if}
</div>

<style>
    .detail-top-bar {
        display: none;
    }
    .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border);
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .detail-header h3 {
        font-size: 1.25rem;
        color: var(--fg);
    }
    .agent-running-indicator {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.15rem 0.5rem;
        background: rgba(212, 175, 55, 0.1);
        border-radius: 4px;
        border: 1px solid rgba(212, 175, 55, 0.2);
    }
    .detail-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .detail-section {
        margin-bottom: 1.25rem;
    }
    .detail-section h4 {
        font-size: 0.85rem;
        color: var(--fg-muted);
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.3rem;
    }
    .description-text {
        font-size: 0.875rem;
        color: var(--fg);
        line-height: 1.6;
        white-space: pre-wrap;
    }
    .resource-actions {
        display: flex;
        align-items: center;
        gap: 0.35rem;
    }
    .add-resource-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
    }
    :global(.input-title) {
        max-width: 180px;
    }
    .edit-feature-form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 1.25rem;
    }
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
    .form-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
    }
    .resource-list {
        list-style: none;
    }
    .resource-list li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.4rem 0;
        border-bottom: 1px solid var(--border);
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .resource-list a {
        color: var(--accent);
        text-decoration: none;
        font-size: 0.85rem;
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
    }

    @media (max-width: 768px) {
        .detail-top-bar {
            display: block;
            margin-bottom: 0.75rem;
        }
        .input-title {
            max-width: 100%;
        }
        .selection-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
