<script lang="ts">
    import { api } from '$lib/api/client';
    import { ErrorBanner, LoadingSpinner } from '$lib/components';
    import { Button } from '$lib/components/primitives/button';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { PromptRecord, Trait } from '$lib/types';
    import { onMount } from 'svelte';
    import PromptList from './PromptList.svelte';
    import TraitList from './TraitList.svelte';

    // ── Tab state ──────────────────────────────────────────────────────────────
    let active_tab = $state<'prompts' | 'traits'>('prompts');

    // ── Prompts state ──────────────────────────────────────────────────────────
    let prompts = $state<PromptRecord[]>([]);
    let prompts_loading = $state(true);
    let prompts_error = $state('');
    let syncing = $state(false);

    interface PromptEditState {
        editing: boolean;
        content: string;
        saving: boolean;
    }
    let edit_state = $state<Record<string, PromptEditState>>({});

    async function load_prompts() {
        try {
            prompts_error = '';
            const result = await api.list_prompts();
            prompts = result;
            for (const prompt of result) {
                if (!edit_state[prompt.role]) {
                    edit_state[prompt.role] = { editing: false, content: prompt.content, saving: false };
                }
            }
        } catch (err: any) {
            prompts_error = err.message ?? 'Failed to load prompts';
        } finally {
            prompts_loading = false;
        }
    }

    async function sync_from_repo() {
        syncing = true;
        try {
            await api.sync_prompts();
            toast_store.success('Synced successfully');
            await load_prompts();
            for (const prompt of prompts) {
                edit_state[prompt.role] = { editing: false, content: prompt.content, saving: false };
            }
        } catch (err: any) {
            toast_store.error(err.message ?? 'Sync failed');
        } finally {
            syncing = false;
        }
    }

    // ── Traits state ──────────────────────────────────────────────────────────
    let traits = $state<Trait[]>([]);
    let traits_loading = $state(true);
    let traits_error = $state('');
    let trait_list_ref: TraitList | undefined = $state();

    async function load_traits() {
        try {
            traits_error = '';
            traits = await api.list_traits();
        } catch (err: any) {
            traits_error = err.message ?? 'Failed to load traits';
        } finally {
            traits_loading = false;
        }
    }

    // ── Initial load ──────────────────────────────────────────────────────────
    onMount(() => {
        load_prompts();
        load_traits();
    });
</script>

<div class="page">
    <div class="page-header">
        <h2><span class="icon">tune</span> Prompts &amp; Traits</h2>
        {#if active_tab === 'prompts'}
            <Button variant="secondary" onclick={sync_from_repo} disabled={syncing}>
                <span class="icon" class:spin={syncing}>
                    {syncing ? 'progress_activity' : 'sync'}
                </span>
                {syncing ? 'Syncing…' : 'Sync from Repo'}
            </Button>
        {:else}
            <Button variant="primary" onclick={() => trait_list_ref?.open_new_form()}>
                <span class="icon">add</span>
                New Trait
            </Button>
        {/if}
    </div>

    <div class="tabs">
        <Button
            variant="tab"
            active={active_tab === 'prompts'}
            onclick={() => {
                active_tab = 'prompts';
            }}
            icon="description"
        >
            Base Prompts
        </Button>
        <Button
            variant="tab"
            active={active_tab === 'traits'}
            onclick={() => {
                active_tab = 'traits';
            }}
            icon="psychology"
        >
            Traits Library
            {#if traits.length > 0}
                <span class="count-badge">{traits.length}</span>
            {/if}
        </Button>
    </div>

    <!-- ── Tab 1: Base Prompts ──────────────────────────────────────────────── -->
    {#if active_tab === 'prompts'}
        {#if prompts_loading}
            <LoadingSpinner label="Loading prompts…" />
        {:else if prompts_error}
            <ErrorBanner message={prompts_error} />
        {:else}
            <PromptList {prompts} {edit_state} on_updated={load_prompts} />
        {/if}
    {/if}

    <!-- ── Tab 2: Traits Library ────────────────────────────────────────────── -->
    {#if active_tab === 'traits'}
        {#if traits_loading}
            <LoadingSpinner label="Loading traits…" />
        {:else if traits_error}
            <ErrorBanner message={traits_error} />
        {:else}
            <TraitList bind:this={trait_list_ref} {traits} on_updated={load_traits} />
        {/if}
    {/if}
</div>

<style>
    .page {
        max-width: 1100px;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
    .page-header h2 {
        font-size: 1.5rem;
        color: var(--fg);
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .tabs {
        display: flex;
        gap: 0.25rem;
        border-bottom: 1px solid var(--border);
        margin-bottom: 1.5rem;
    }

    .count-badge {
        background: var(--bg-elevated);
        color: var(--fg-muted);
        font-size: 0.65rem;
        padding: 0.1rem 0.4rem;
        border-radius: 10px;
        font-weight: 600;
    }


</style>
