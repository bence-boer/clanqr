<script lang="ts">
    import { api } from '$lib/api/client';
    import { EmptyState } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import { Textarea } from '$lib/components/primitives/textarea';
    import type { PromptRecord } from '$lib/types';

    interface PromptEditState {
        editing: boolean;
        content: string;
        saving: boolean;
    }

    interface Props {
        prompts: PromptRecord[];
        edit_state: Record<string, PromptEditState>;
        on_updated: () => void;
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

    function start_edit(role: string, current_content: string) {
        edit_state[role] = { editing: true, content: current_content, saving: false };
    }

    function cancel_edit(role: string, original_content: string) {
        edit_state[role] = { editing: false, content: original_content, saving: false };
    }

    async function save_prompt(role: string) {
        const state = edit_state[role];
        if (!state) return;
        state.saving = true;
        try {
            await api.update_prompt(role, state.content);
            edit_state[role] = { editing: false, content: state.content, saving: false };
            on_updated();
        } catch (err: any) {
            state.saving = false;
        }
    }
</script>

{#if prompts.length === 0}
    <EmptyState icon="description" message="No prompts found." detail='Click "Sync from Repo" to load prompts from the agents/prompts/ directory.' />
{:else}
    <div class="prompts-grid">
        {#each prompts as prompt (prompt.role)}
            {@const role_state = edit_state[prompt.role]}
            <div class="prompt-card" class:editing={role_state?.editing}>
                <div class="prompt-card-header">
                    <div class="prompt-role-info">
                        <span class="icon role-icon">
                            {prompt.role === 'manager' ? 'assignment' : 'build'}
                        </span>
                        <div>
                            <h3 class="prompt-role">
                                {prompt.role === 'manager' ? 'Manager' : 'Ralph'} Prompt
                            </h3>
                            <span class="prompt-meta">
                                v{prompt.version} · Updated {format_date(prompt.updated_at)}
                            </span>
                        </div>
                    </div>
                    {#if !role_state?.editing}
                        <Button variant="secondary" size="sm" onclick={() => start_edit(prompt.role, prompt.content)}>
                            <span class="icon" style="font-size:16px">edit</span>
                            Edit
                        </Button>
                    {/if}
                </div>

                <Textarea
                    class="prompt-textarea {role_state?.editing ? 'editable' : ''}"
                    readonly={!role_state?.editing}
                    value={role_state?.content ?? prompt.content}
                    oninput={(event) => {
                        if (role_state) role_state.content = (event.target as HTMLTextAreaElement).value;
                    }}
                    rows={18}
                />

                {#if role_state?.editing}
                    <div class="prompt-actions">
                        <Button variant="primary" onclick={() => save_prompt(prompt.role)} disabled={role_state.saving}>
                            <span class="icon" style="font-size:16px" class:spin={role_state.saving}>
                                {role_state.saving ? 'progress_activity' : 'save'}
                            </span>
                            {role_state.saving ? 'Saving…' : 'Save'}
                        </Button>
                        <Button variant="secondary" onclick={() => cancel_edit(prompt.role, prompt.content)} disabled={role_state.saving}>Cancel</Button>
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
        font-family: 'SF Mono', 'Fira Code', monospace;
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
