<script lang="ts">
    import { api } from '$lib/api/client';
    import { admin_api } from '$lib/api/admin-client';
    import type { ModelOption, SdkDefaults } from '$lib/types';
    import { LoadingSpinner } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import { onMount } from 'svelte';

    let settings = $state<SdkDefaults | null>(null);
    let models = $state<ModelOption[]>([]);
    let loading = $state(true);
    let saving = $state(false);

    let draft_model = $state('');
    let draft_reasoning = $state('medium');
    let draft_timeout = $state(30);
    let draft_concurrency = $state(3);

    let has_changes = $derived(
        settings !== null && (
            draft_model !== settings.default_model
            || draft_reasoning !== settings.default_reasoning_effort
            || draft_timeout !== settings.default_timeout_minutes
            || draft_concurrency !== settings.max_concurrent_sessions
        )
    );

    onMount(async () => {
        try {
            const [s, m] = await Promise.all([
                admin_api.get_settings(),
                api.list_models()
            ]);
            settings = s;
            models = m;
            draft_model = s.default_model;
            draft_reasoning = s.default_reasoning_effort;
            draft_timeout = s.default_timeout_minutes;
            draft_concurrency = s.max_concurrent_sessions;
        }
        catch {
            toast_store.error('Failed to load settings');
        }
        finally {
            loading = false;
        }
    });

    async function save() {
        saving = true;
        try {
            const updated = await admin_api.update_settings({
                default_model: draft_model,
                default_reasoning_effort: draft_reasoning,
                default_timeout_minutes: draft_timeout,
                max_concurrent_sessions: draft_concurrency
            });
            settings = updated;
            toast_store.success('Settings saved');
        }
        catch {
            toast_store.error('Failed to save settings');
        }
        finally {
            saving = false;
        }
    }

    const reasoning_options = ['low', 'medium', 'high', 'xhigh'];
</script>

{#if loading}
    <LoadingSpinner label="Loading settings…" />
{:else if settings}
    <div class="settings-grid">
        <div class="setting-group">
            <h3 class="group-title">SDK Defaults</h3>
            <p class="group-desc">
                Default values used when creating new features.
                Individual features can override these.
            </p>

            <label class="field">
                <span class="field-label">Default Model</span>
                <select class="field-input" bind:value={draft_model}>
                    {#each models as m (m.value)}
                        <option value={m.value}>
                            {m.label}{m.billing_multiplier ? ` (${m.billing_multiplier}×)` : ''}
                        </option>
                    {/each}
                </select>
            </label>

            <label class="field">
                <span class="field-label">Reasoning Effort</span>
                <select class="field-input" bind:value={draft_reasoning}>
                    {#each reasoning_options as opt (opt)}
                        <option value={opt}>{opt}</option>
                    {/each}
                </select>
            </label>

            <label class="field">
                <span class="field-label">Task Timeout (minutes)</span>
                <input
                    class="field-input"
                    type="number"
                    min="1"
                    max="1440"
                    bind:value={draft_timeout}
                />
            </label>

            <label class="field">
                <span class="field-label">Max Concurrent Sessions</span>
                <input
                    class="field-input"
                    type="number"
                    min="1"
                    max="20"
                    bind:value={draft_concurrency}
                />
            </label>
        </div>

        <div class="actions">
            <Button
                variant="primary"
                onclick={save}
                disabled={saving || !has_changes}
            >
                {saving ? 'Saving…' : 'Save Changes'}
            </Button>
        </div>
    </div>
{/if}

<style>
    .settings-grid { display: flex; flex-direction: column; gap: 1.5rem; }
    .setting-group {
        background: var(--bg-surface); border: 1px solid var(--border);
        border-radius: var(--radius); padding: 1.25rem;
    }
    .group-title {
        font-size: 0.85rem; font-weight: 600; color: var(--fg); margin-bottom: 0.25rem;
    }
    .group-desc {
        font-size: 0.8rem; color: var(--fg-muted); margin-bottom: 1rem; line-height: 1.4;
    }
    .field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.85rem; }
    .field-label {
        font-size: 0.75rem; font-weight: 600; color: var(--fg-muted);
        text-transform: uppercase; letter-spacing: 0.04em;
    }
    .field-input {
        background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius);
        padding: 0.5rem 0.75rem; color: var(--fg); font-size: 0.85rem;
    }
    .field-input:focus {
        outline: none; border-color: var(--accent);
        box-shadow: 0 0 0 2px rgba(106, 168, 254, 0.2);
    }
    select.field-input { cursor: pointer; }
    .actions { display: flex; gap: 0.75rem; }
</style>
