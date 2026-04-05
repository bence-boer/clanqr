<script lang="ts">
    import { Button } from '$lib/components/primitives';
    import type { SystemAlert, SystemStats } from '$lib/types';

    let {
        system_stats,
        system_alerts = [],
        stats_auto_refresh,
        onrefresh,
        ontoggle_auto_refresh
    }: {
        system_stats: SystemStats | null
        system_alerts?: SystemAlert[]
        stats_auto_refresh: boolean
        onrefresh: () => void
        ontoggle_auto_refresh: () => void
    } = $props();
</script>

<section class="section">
    <div class="section-header">
        <h3>System Stats</h3>
        <div class="section-actions">
            <Button variant="ghost" size="icon" onclick={onrefresh} title="Refresh stats" icon="refresh" aria-label="Refresh stats" />
            <Button variant={stats_auto_refresh ? 'primary' : 'secondary'} onclick={ontoggle_auto_refresh} title="Auto-refresh every 15s" icon="update">
                Auto-refresh
            </Button>
        </div>
    </div>

    {#if system_alerts.length > 0}
        <div class="alerts" role="alert">
            {#each system_alerts as alert, i (i)}
                <div class="alert" class:alert-warning={alert.severity === 'warning'} class:alert-critical={alert.severity === 'critical'}>
                    <span class="icon" style="font-size:14px">{alert.severity === 'critical' ? 'error' : 'warning'}</span>
                    {alert.message}
                </div>
            {/each}
        </div>
    {/if}

    {#if system_stats}
        <div class="system-stats-grid">
            <div class="sys-stat">
                <span class="sys-label">CPU</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {system_stats.cpu_percent}%"></div>
                </div>
                <span class="sys-value">{system_stats.cpu_percent}%</span>
            </div>
            <div class="sys-stat">
                <span class="sys-label">Memory</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {system_stats.memory_percent}%"></div>
                </div>
                <span class="sys-value">{system_stats.memory_percent}% of {Math.round(system_stats.memory_total_mb / 1024)}GB</span>
            </div>
            <div class="sys-stat">
                <span class="sys-label">Storage</span>
                <div class="progress-bar">
                    <div class="progress-fill" class:high={system_stats.storage_percent > 80} style="width: {system_stats.storage_percent}%"></div>
                </div>
                <span class="sys-value">{system_stats.storage_percent}% of {system_stats.storage_total_gb.toFixed(0)}GB</span>
            </div>
            {#if system_stats.cpu_temp_celsius !== null}
                <div class="sys-stat">
                    <span class="sys-label">Temperature</span>
                    <div class="progress-bar">
                        <div
                            class="progress-fill"
                            class:warm={system_stats.cpu_temp_celsius > 60}
                            style="width: {Math.min(system_stats.cpu_temp_celsius, 100)}%"
                        ></div>
                    </div>
                    <span class="sys-value">{system_stats.cpu_temp_celsius}°C</span>
                </div>
            {/if}
        </div>
    {:else}
        <p class="muted-text">Stats unavailable</p>
    {/if}
</section>

<style>
    .section {
        margin-bottom: 2rem;
    }

    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
    }

    .section-header h3 {
        font-size: 1.05rem;
        color: var(--fg);
        margin: 0;
    }

    .section-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .system-stats-grid {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1.25rem;
    }

    .sys-stat {
        display: grid;
        grid-template-columns: 90px 1fr 80px;
        align-items: center;
        gap: 0.75rem;
    }

    .sys-label {
        font-size: 0.8rem;
        color: var(--fg-muted);
    }

    .sys-value {
        font-size: 0.8rem;
        color: var(--fg);
        text-align: right;
    }

    .progress-bar {
        height: 6px;
        background: var(--bg-elevated);
        border-radius: 3px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: var(--accent);
        border-radius: 3px;
        transition: width 0.3s ease;
    }

    .progress-fill.high {
        background: var(--danger);
    }
    .progress-fill.warm {
        background: var(--warning);
    }

    .muted-text {
        color: var(--fg-muted);
        font-size: 0.875rem;
    }

    .alerts {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .alert {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 0.85rem;
        border-radius: var(--radius);
        font-size: 0.8rem;
        font-weight: 500;
    }

    .alert-warning {
        background: rgba(var(--warning-rgb), 0.12);
        color: var(--warning);
        border: 1px solid rgba(var(--warning-rgb), 0.3);
    }

    .alert-critical {
        background: rgba(var(--danger-rgb), 0.12);
        color: var(--danger);
        border: 1px solid rgba(var(--danger-rgb), 0.3);
    }

    @media (max-width: 768px) {
        .sys-stat {
            grid-template-columns: 80px 1fr 70px;
        }
    }
</style>
