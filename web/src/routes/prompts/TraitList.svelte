<script lang="ts">
    import { api } from '$lib/api/client';
    import { EmptyState, ErrorBanner } from '$lib/components';
    import { Badge, Button, Input, Select, Textarea } from '$lib/components/primitives';
    import type { Trait } from '$lib/types';

    interface TraitForm {
        name: string;
        description: string;
        target: 'manager' | 'ralph';
        is_global: boolean;
        content: string;
    }

    interface Props {
        traits: Trait[];
        on_updated: () => void;
    }

    let { traits, on_updated }: Props = $props();

    let trait_filter = $state<'all' | 'manager' | 'ralph'>('all');
    let filtered_traits = $derived(trait_filter === 'all' ? traits : traits.filter((trait) => trait.target === trait_filter));

    const default_trait_form = (): TraitForm => ({
        name: '',
        description: '',
        target: 'ralph',
        is_global: false,
        content: ''
    });

    let show_form = $state(false);
    let editing_id = $state<string | null>(null);
    let form = $state<TraitForm>(default_trait_form());
    let form_saving = $state(false);
    let form_error = $state('');
    let delete_confirm_id = $state<string | null>(null);
    let deleting_id = $state<string | null>(null);
    let list_error = $state('');

    export function open_new_form() {
        editing_id = null;
        form = default_trait_form();
        form_error = '';
        show_form = true;
    }

    function open_edit_form(trait: Trait) {
        editing_id = trait.id;
        form = {
            name: trait.name,
            description: trait.description ?? '',
            target: trait.target,
            is_global: trait.is_global,
            content: trait.content
        };
        form_error = '';
        show_form = true;
    }

    function close_form() {
        show_form = false;
        editing_id = null;
        form = default_trait_form();
        form_error = '';
    }

    async function save_trait() {
        if (!form.name.trim()) {
            form_error = 'Name is required';
            return;
        }
        if (!form.content.trim()) {
            form_error = 'Content is required';
            return;
        }
        form_saving = true;
        form_error = '';
        try {
            const data = {
                name: form.name.trim(),
                description: form.description.trim() || null,
                target: form.target,
                is_global: form.is_global,
                content: form.content
            };
            if (editing_id) {
                await api.update_trait(editing_id, data);
            } else {
                await api.create_trait(data as any);
            }
            close_form();
            on_updated();
        } catch (err: any) {
            form_error = err.message ?? 'Save failed';
        } finally {
            form_saving = false;
        }
    }

    async function delete_trait(id: string) {
        deleting_id = id;
        try {
            await api.delete_trait(id);
            delete_confirm_id = null;
            on_updated();
        } catch (err: any) {
            list_error = err.message ?? 'Delete failed';
        } finally {
            deleting_id = null;
        }
    }

    function truncate(text: string | null, max_len = 80): string {
        if (!text) return '';
        return text.length > max_len ? text.slice(0, max_len) + '…' : text;
    }
</script>

<div class="filter-bar">
    {#each ['all', 'manager', 'ralph'] as const as filter_val}
        <Button
            variant="filter"
            active={trait_filter === filter_val}
            onclick={() => {
                trait_filter = filter_val;
            }}
        >
            {filter_val === 'all' ? 'All' : filter_val === 'manager' ? 'Manager' : 'Ralph'}
        </Button>
    {/each}
    <span class="filter-count">
        {filtered_traits.length} trait{filtered_traits.length !== 1 ? 's' : ''}
    </span>
</div>

{#if show_form}
    <div class="trait-form-panel">
        <div class="trait-form-header">
            <h3>
                <span class="icon" style="font-size:18px">
                    {editing_id ? 'edit' : 'add_circle'}
                </span>
                {editing_id ? 'Edit Trait' : 'New Trait'}
            </h3>
            <Button variant="ghost" size="icon" onclick={close_form} aria-label="Close form" icon="close" />
        </div>

        <div class="trait-form-body">
            <div class="form-row">
                <Input id="trait-name" type="text" class="form-input" bind:value={form.name} placeholder="e.g. verbose_logging" label="Name" required />
                <Select id="trait-target" bind:value={form.target} label="Target" required>
                    <option value="ralph">Ralph</option>
                    <option value="manager">Manager</option>
                </Select>
            </div>

            <div class="form-field">
                <Input
                    id="trait-desc"
                    type="text"
                    class="form-input"
                    bind:value={form.description}
                    placeholder="Short description of this trait…"
                    label="Description"
                />
            </div>

            <div class="form-field">
                <Textarea
                    id="trait-content"
                    bind:value={form.content}
                    rows={6}
                    placeholder="The prompt text injected by this trait…"
                    label="Content"
                    required
                />
            </div>

            <div class="form-toggle-row">
                <label class="toggle-label">
                    <button
                        type="button"
                        class="toggle-btn"
                        class:active={form.is_global}
                        onclick={() => {
                            form.is_global = !form.is_global;
                        }}
                        role="switch"
                        aria-checked={form.is_global}
                        aria-label="Toggle global trait"
                    >
                        <span class="toggle-thumb"></span>
                    </button>
                    <span>
                        Global trait
                        <span class="form-hint">(applied to all tasks automatically)</span>
                    </span>
                </label>
            </div>

            {#if form_error}
                <div class="form-error">
                    <span class="icon" style="font-size:15px">error</span>
                    {form_error}
                </div>
            {/if}

            <div class="form-actions">
                <Button variant="primary" icon={form_saving ? 'progress_activity' : 'save'} onclick={save_trait} disabled={form_saving}>
                    {form_saving ? 'Saving…' : editing_id ? 'Update Trait' : 'Create Trait'}
                </Button>
                <Button variant="secondary" onclick={close_form} disabled={form_saving}>Cancel</Button>
            </div>
        </div>
    </div>
{/if}

{#if list_error}
    <ErrorBanner message={list_error} />
{/if}

{#if filtered_traits.length === 0}
    <EmptyState icon="psychology" message={trait_filter === 'all' ? 'No traits yet.' : `No ${trait_filter} traits.`} detail="Create a trait to extend agent behaviour on specific tasks." />
{:else}
    <div class="traits-list">
        {#each filtered_traits as trait (trait.id)}
            <div class="trait-row">
                <div class="trait-main">
                    <div class="trait-header-row">
                        <span class="trait-name">{trait.name}</span>
                        <div class="trait-badges">
                            <Badge variant={trait.target === 'manager' ? 'info' : trait.target === 'ralph' ? 'warning' : 'default'}>{trait.target}</Badge>
                            {#if trait.is_global}
                                <Badge variant="success">global</Badge>
                            {/if}
                        </div>
                    </div>
                    {#if trait.description}
                        <p class="trait-desc">{truncate(trait.description)}</p>
                    {/if}
                    <p class="trait-preview">{truncate(trait.content, 120)}</p>
                </div>

                <div class="trait-actions">
                    {#if delete_confirm_id === trait.id}
                        <span class="confirm-text">Delete?</span>
                        <Button variant="danger" size="sm" onclick={() => delete_trait(trait.id)} disabled={deleting_id === trait.id}>
                            {deleting_id === trait.id ? '…' : 'Yes'}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onclick={() => {
                                delete_confirm_id = null;
                            }}>No</Button
                        >
                    {:else}
                        <Button variant="secondary" size="sm" icon="edit" onclick={() => open_edit_form(trait)}>Edit</Button>
                        <Button
                            variant="danger"
                            size="sm"
                            icon="delete"
                            onclick={() => {
                                delete_confirm_id = trait.id;
                            }}
                            aria-label="Delete {trait.name}"
                        />
                    {/if}
                </div>
            </div>
        {/each}
    </div>
{/if}

<style>
    .filter-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1.25rem;
        flex-wrap: wrap;
    }

    .filter-count {
        margin-left: auto;
        font-size: 0.8rem;
        color: var(--fg-muted);
    }

    .trait-form-panel {
        background: var(--bg-surface);
        border: 1px solid var(--accent);
        border-radius: var(--radius);
        margin-bottom: 1.25rem;
        overflow: hidden;
    }

    .trait-form-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.85rem 1.25rem;
        background: var(--bg-elevated);
        border-bottom: 1px solid var(--border);
    }
    .trait-form-header h3 {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--fg);
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .trait-form-body {
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
    }

    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.85rem;
    }
    .form-field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .form-toggle-row {
        display: flex;
        align-items: center;
    }
    .toggle-label {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        font-size: 0.875rem;
        color: var(--fg);
        cursor: pointer;
        user-select: none;
    }
    .form-hint {
        color: var(--fg-muted);
        font-size: 0.8rem;
    }

    .toggle-btn {
        width: 36px;
        height: 20px;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 20px;
        cursor: pointer;
        transition:
            background 0.2s,
            border-color 0.2s;
        position: relative;
        flex-shrink: 0;
    }
    .toggle-btn.active {
        background: var(--accent);
        border-color: var(--accent);
    }
    .toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        background: var(--fg-muted);
        border-radius: 50%;
        transition:
            transform 0.2s,
            background 0.2s;
    }
    .toggle-btn.active .toggle-thumb {
        transform: translateX(16px);
        background: var(--bg);
    }

    .form-error {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.82rem;
        color: var(--danger);
    }
    .form-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        padding-top: 0.25rem;
    }

    .traits-list {
        overflow-x: hidden;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .trait-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.85rem 1.1rem;
        transition: border-color 0.15s;
        flex-wrap: wrap;
        max-width: 100%;
        overflow: hidden;
        box-sizing: border-box;
    }
    .trait-row:hover {
        border-color: var(--bg-elevated);
    }

    .trait-main {
        flex: 1;
        min-width: 0;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }
    .trait-header-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .trait-name {
        font-weight: 600;
        color: var(--fg);
        font-size: 0.875rem;
        font-family: 'SF Mono', 'Fira Code', monospace;
    }
    .trait-badges {
        display: flex;
        gap: 0.35rem;
        flex-wrap: wrap;
    }

    .trait-desc {
        font-size: 0.82rem;
        color: var(--fg-muted);
    }
    .trait-preview {
        font-size: 0.75rem;
        color: var(--fg-muted);
        opacity: 0.55;
        font-family: 'SF Mono', 'Fira Code', monospace;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .trait-actions {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-shrink: 0;
    }
    .confirm-text {
        font-size: 0.8rem;
        color: var(--danger);
        font-weight: 600;
        white-space: nowrap;
    }

    @media (max-width: 768px) {
        .form-row {
            grid-template-columns: 1fr;
        }
        .filter-bar {
            flex-direction: column;
            align-items: stretch;
        }
        .filter-count {
            margin-left: 0;
            width: 100%;
        }
        .trait-row {
            flex-direction: column;
            align-items: flex-start;
        }
        .trait-actions {
            align-self: flex-end;
            flex-wrap: wrap;
        }
    }
</style>
