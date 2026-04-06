<script lang="ts">
    import { api } from '$lib/api/client';
    import { ConfirmModal, ErrorBanner, LoadingSpinner, Tabs } from '$lib/components';
    import type { DagEdge, DagNode } from '$lib/components/dag-graph';
    import { WaveProgress, type WaveInfo } from '$lib/components/wave-progress';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { AgentSession, PipelineStatus } from '$lib/types';
    import { use_event_stream } from '$lib/utils/event-stream.svelte';
    import { onMount } from 'svelte';
    import DagNodeDetail from './DagNodeDetail.svelte';
    import DagView from './DagView.svelte';
    import PipelineHistory from './PipelineHistory.svelte';
    import PipelineStats from './PipelineStats.svelte';
    import PipelineStatusBar from './PipelineStatusBar.svelte';
    import { map_dag_response, retry_task } from './pipeline-helpers';

    let pipeline = $state<PipelineStatus | null>(null);
    let history = $state.raw<AgentSession[]>([]);
    let history_total = $state(0);
    let history_page = $state(1);
    let history_total_pages = $state(1);
    let filter_status = $state('');
    let active_tab = $state('dag');
    let dag_nodes = $state.raw<DagNode[]>([]);
    let dag_edges = $state.raw<DagEdge[]>([]);
    let waves = $state.raw<WaveInfo[]>([]);
    let selected_node_id = $state<string | null>(null);
    let loading = $state(true);
    let action_error = $state('');
    let action_busy = $state(false);
    let show_stop_confirm = $state(false);
    const pipeline_sections = [{ label: 'DAG', value: 'dag' }, { label: 'History', value: 'history' }];
    const selected_node = $derived(dag_nodes.find((n) => n.id === selected_node_id) ?? null);
    function reset_dag() {
        dag_nodes = [];
        dag_edges = [];
        waves = [];
    }
    async function load_pipeline() {
        try {
            pipeline = await api.pipeline_status();
        }
        catch (err) {
            console.error('Pipeline load failed:', err);
            toast_store.error('Failed to load pipeline');
        }
    }
    async function load_dag() {
        const fid = pipeline?.current_feature_id;
        if (!fid) {
            reset_dag();
            return;
        }
        try {
            const mapped = map_dag_response(await api.get_dag(fid));
            dag_nodes = mapped.nodes;
            dag_edges = mapped.edges;
            waves = mapped.waves;
        }
        catch {
            reset_dag();
        }
    }
    async function load_all() {
        await load_pipeline();
        await load_dag();
        loading = false;
    }
    const stream = use_event_stream({
        pipeline_status: () => {
            load_pipeline().then(() => load_dag());
        },
        tasks_update: () => {
            load_dag();
        }
    }, load_all, 15_000);
    onMount(() => {
        load_all();
    });
    $effect(() => {
        void filter_status;
        void history_page;
        let cancelled = false;
        (async () => {
            try {
                const r = await api.usage_history(history_page, 20, undefined, filter_status || undefined);
                if (cancelled) return;
                history = r.runs;
                history_total = r.total;
                history_total_pages = r.total_pages;
            }
            catch (err) {
                if (cancelled) return;
                console.error('History load failed:', err);
                toast_store.error('Failed to load history');
                history = [];
            }
        })();
        return () => {
            cancelled = true;
        };
    });
    async function do_action(action: () => Promise<unknown>, fail_msg: string) {
        action_busy = true;
        action_error = '';
        try {
            await action();
            await load_pipeline();
        }
        catch (e) {
            action_error = e instanceof Error ? e.message : fail_msg;
        }
        finally {
            action_busy = false;
        }
    }
    const do_pause = () => do_action(() => api.pipeline_pause(), 'Failed to pause');
    const do_resume = () => do_action(() => api.pipeline_resume(), 'Failed to resume');
    async function do_stop() {
        show_stop_confirm = false;
        await do_action(() => api.pipeline_stop_current(), 'Failed to stop');
    }
    async function handle_verify(task_id: string) {
        try {
            await api.verify_task(task_id);
            toast_store.success('Verification triggered');
            await load_dag();
        }
        catch {
            toast_store.error('Failed to trigger verification');
        }
    }
    function toggle_node(id: string) {
        selected_node_id = selected_node_id === id ? null : id;
    }
    function clear_node_selection() {
        selected_node_id = null;
    }
    function handle_filter_change(status: string) {
        filter_status = status;
        history_page = 1;
    }
    function handle_page_change(page: number) {
        history_page = page;
    }
</script>
<div class="page" aria-busy={loading}>
    <div class="page-header">
        <h2>Pipeline</h2>
        <p class="subtitle">Execution DAG and task history</p>
    </div>
    {#if stream.is_stale}
        <ErrorBanner variant="stale" message="Data may be outdated — unable to reach server" />
    {/if}
    {#if loading}
        <LoadingSpinner label="Loading pipeline..." />
    {:else}
        <PipelineStatusBar {pipeline} {action_busy} {action_error} on_pause={do_pause} on_resume={do_resume} on_stop={() => (show_stop_confirm = true)} />
        <PipelineStats {pipeline} {history} />
        {#if waves.length > 0}
            <div class="wave-bar"><WaveProgress {waves} /></div>
        {/if}
        <div class="pipeline-tabs"><Tabs items={pipeline_sections} bind:value={active_tab} aria_label="Pipeline sections" /></div>
        {#if active_tab === 'dag'}
            <div class="dag-layout">
                <div class="dag-main">
                    <DagView nodes={dag_nodes} edges={dag_edges} selected_id={selected_node_id} on_node_click={toggle_node} />
                </div>
                {#if selected_node}
                    <aside class="dag-aside">
                        <DagNodeDetail node={selected_node} on_close={clear_node_selection} on_verify={handle_verify} />
                    </aside>
                {/if}
            </div>
        {:else}
            <PipelineHistory {history} {history_total} {history_page} {history_total_pages} {filter_status}
                on_filter_change={handle_filter_change} on_page_change={handle_page_change}
                on_retry={(id) => retry_task(id, () => load_dag())} />
        {/if}
    {/if}
</div>
<ConfirmModal
    title="Stop Running Task" message="Stop the currently running task? This cannot be undone."
    confirm_label="Stop" variant="danger"
    open={show_stop_confirm}
    on_confirm={do_stop}
    on_cancel={() => (show_stop_confirm = false)}
/>
<style>
    .page { max-width: 1100px; } .page-header { margin-bottom: 1.5rem; }
    .page-header h2 { font-size: 1.5rem; color: var(--fg); }
    .subtitle { color: var(--fg-muted); font-size: 0.875rem; margin-top: 0.2rem; }
    .pipeline-tabs { margin-bottom: 1rem; } .wave-bar { margin-bottom: 1rem; }
    .dag-layout { display: flex; gap: 1rem; align-items: flex-start; }
    .dag-main { flex: 1; min-width: 0; } .dag-aside { width: 300px; flex-shrink: 0; }
    @media (max-width: 768px) {
        .page { overflow-x: hidden; } .dag-layout { flex-direction: column; } .dag-aside { width: 100%; }
    }
</style>
