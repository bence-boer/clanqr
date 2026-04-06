<script lang="ts">
    import { api } from '$lib/api/client';
    import { EmptyState } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import { Textarea } from '$lib/components/primitives/textarea';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { PromptRecord } from '$lib/types';

    interface PromptEditState {
        editing: boolean
        content: string
        saving: boolean
    }

    interface Props {
        prompts: PromptRecord[]
        edit_state: Record<string, PromptEditState>
        on_updated: () => void
    }

    let { prompts, edit_state, on_updated }: Props = $props();

    function format_date(date_string: string): string {
        return new Date(date_string).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function start_edit(agent_type: string, current_content: string) {
        edit_state[agent_type] = { editing: true, content: current_content, saving: false };
    }

    function cancel_edit(agent_type: string, original_content: string) {
        edit_state[agent_type] = { editing: false, content: original_content, saving: false };
    }

    async function save_prompt(agent_type: string) {
        const state = edit_state[agent_type];
        if (!state) return;
        state.saving = true;
        try {
            await api.update_prompt(agent_type, state.content);
            edit_state[agent_type] = { editing: false, content: state.content, saving: false };
            on_updated();
        }
        catch (error) {
            console.error(error);
            toast_store.error('Failed to save prompt');
            state.saving = false;
        }
    }
</script>

{#if prompts.length === 0}
    <EmptyState icon="description" message="No prompts found." detail='Click "Sync from Repo" to load prompts from the agents/prompts/ directory.' />
{:else}
    <div class="prompts-grid">
        {#each prompts as prompt (prompt.agent_type)}
            {@const role_state = edit_state[prompt.agent_type]}
            <div class="prompt-card" class:editing={role_state?.editing}>
                <div class="prompt-card-header">
                    <div class="prompt-role-info">
                        <span class="icon role-icon">
                            {prompt.agent_type === 'orchestrator' ? 'assignment' : prompt.agent_type === 'researcher' ? 'search' : 'build'}
                        </span>
                        <div>
                            <h3 class="prompt-role">
                                {prompt.agent_type.charAt(0).toUpperCase() + prompt.agent_type.slice(1)} Prompt
                            </h3>
                            <span class="prompt-meta">
                                v{prompt.version} · Updated {format_date(prompt.updated_at)}
                            </span>
                        </div>
                    </div>
                    {#if !role_state?.editing}
                        <Button variant="secondary" size="sm" onclick={() => start_edit(prompt.agent_type, prompt.content)}>
                            <span class="icon" style="font-size:16px">edit</span>
                            Edit
                        </Button>
                    {/if}
                </div>

                <Textarea
                    class={['prompt-textarea', role_state?.editing ? 'editable' : ''].filter(Boolean).join(' ')}
                    readonly={!role_state?.editing}
                    value={role_state?.content ?? prompt.content}
                    oninput={(event) => {
                        if (role_state) role_state.content = (event.target as HTMLTextAreaElement).value;
                    }}
                    rows={18}
                    aria-label="{prompt.agent_type.charAt(0).toUpperCase() + prompt.agent_type.slice(1)} prompt content"
                />

                {#if role_state?.editing}
                    <div class="prompt-actions">
                        <Button variant="primary" onclick={() => save_prompt(prompt.agent_type)} disabled={role_state.saving}>
                            <span class="icon" style="font-size:16px" class:spin={role_state.saving}>
                                {role_state.saving ? 'progress_activity' : 'save'}
                            </span>
                            {role_state.saving ? 'Saving…' : 'Save'}
                        </Button>
                        <Button variant="secondary" onclick={() => cancel_edit(prompt.agent_type, prompt.content)} disabled={role_state.saving}>Cancel</Button>
                    </div>
                {/if}
            </div>
        {/each}
    </div>
{/if}

<style>
    .prompts-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.25rem;
    }

    .prompt-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        transition: border-color 0.15s;
    }

    .prompt-card.editing {
        border-color: var(--accent);
    }

    .prompt-card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.75rem;
    }

    .prompt-role-info {
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }

    .role-icon {
        font-size: 24px;
        color: var(--accent);
        flex-shrink: 0;
    }

    .prompt-role {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--fg);
        margin-bottom: 0.15rem;
    }

    .prompt-meta {
        font-size: 0.75rem;
        color: var(--fg-muted);
    }

    :global(.prompt-textarea) {
        width: 100%;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--fg-muted);
        font-size: 0.78rem;
        font-family: var(--font-mono);
        line-height: 1.6;
        padding: 0.75rem;
        resize: vertical;
        transition:
            border-color 0.15s,
            color 0.15s;
        outline: none;
    }

    :global(.prompt-textarea.editable) {
        border-color: var(--accent);
        color: var(--fg);
        background: var(--bg-elevated);
        box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.12);
    }

    .prompt-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    @media (max-width: 768px) {
        .prompts-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
