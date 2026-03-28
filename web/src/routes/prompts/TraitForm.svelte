<script lang="ts">
    import { Button, Input, Select, Textarea } from '$lib/components/primitives';

    import type { TraitTarget } from '$lib/types';

    interface TraitFormData {
        name: string
        description: string
        target: TraitTarget
        is_global: boolean
        content: string
    }

    interface Props {
        form: TraitFormData
        editing_id: string | null
        form_saving: boolean
        form_error: string
        on_save: () => void
        on_close: () => void
    }

    let { form = $bindable(), editing_id, form_saving, form_error, on_save, on_close }: Props = $props();
</script>

<div class="trait-form-panel">
    <div class="trait-form-header">
        <h3>
            <span class="icon" style="font-size:18px">
                {editing_id ? 'edit' : 'add_circle'}
            </span>
            {editing_id ? 'Edit Trait' : 'New Trait'}
        </h3>
        <Button variant="ghost" size="icon" onclick={on_close} aria-label="Close form" icon="close" />
    </div>

    <div class="trait-form-body">
        <div class="form-row">
            <Input id="trait-name" type="text" class="form-input" bind:value={form.name} placeholder="e.g. verbose_logging" label="Name" required />
            <Select id="trait-target" bind:value={form.target} label="Target" required>
                <option value="ralph">Ralph</option>
                <option value="manager">Manager</option>
                <option value="researcher">Researcher</option>
                <option value="editor">Editor</option>
                <option value="chat">Chat</option>
                <option value="custom">Custom</option>
            </Select>
        </div>

        <div class="form-field">
            <Input id="trait-desc" type="text" class="form-input" bind:value={form.description}
                placeholder="Short description of this trait…" label="Description" />
        </div>

        <div class="form-field">
            <Textarea
                id="trait-content"
                bind:value={form.content}
                rows={6}
                placeholder="Write instructions that will be injected into the agent's system prompt."
                label="Content"
                required
            />
            <span class="char-count">{form.content.length} characters</span>
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
            <Button variant="primary" icon={form_saving ? 'progress_activity' : 'save'} onclick={on_save} disabled={form_saving}>
                {form_saving ? 'Saving…' : editing_id ? 'Update Trait' : 'Create Trait'}
            </Button>
            <Button variant="secondary" onclick={on_close} disabled={form_saving}>Cancel</Button>
        </div>
    </div>
</div>

<style>
    .trait-form-panel {
        background: var(--bg-surface); border: 1px solid var(--accent);
        border-radius: var(--radius); margin-bottom: 1.25rem; overflow: hidden;
    }
    .trait-form-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 0.85rem 1.25rem; background: var(--bg-elevated);
        border-bottom: 1px solid var(--border);
    }
    .trait-form-header h3 { font-size: 0.9rem; font-weight: 600; color: var(--fg); display: flex; align-items: center; gap: 0.4rem; }
    .trait-form-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
    .form-field { display: flex; flex-direction: column; gap: 0.35rem; }
    .form-toggle-row { display: flex; align-items: center; }
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
        transition: background 0.2s, border-color 0.2s;
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
        transition: transform 0.2s, background 0.2s;
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
    .char-count {
        font-size: 0.75rem;
        color: var(--fg-muted);
        text-align: right;
        margin-top: 0.15rem;
    }
    .form-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        padding-top: 0.25rem;
    }
    @media (max-width: 768px) {
        .form-row {
            grid-template-columns: 1fr;
        }
    }
</style>
