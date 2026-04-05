<script lang="ts">
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import type { Pathname } from '$app/types';
    import { notification_store, type Notification } from '$lib/stores/notifications.svelte';
    import { format_relative_short } from '$lib/utils/format';

    let open = $state(false);

    function toggle() {
        open = !open;
    }

    function close() {
        open = false;
    }

    function handle_click(n: Notification) {
        notification_store.mark_read(n.id);
        if (n.link) {
            goto(resolve(n.link as Pathname));
        }
        close();
    }

    function mark_all() {
        notification_store.mark_all_read();
    }

    const type_icon: Record<Notification['type'], string> = {
        success: 'check_circle',
        danger: 'error',
        warning: 'warning',
        info: 'info'
    };
</script>

<svelte:window onclick={() => {
    if (open) close();
}} />

<div data-slot="notification-bell" class="bell-wrapper">
    <button class="bell-btn" onclick={(e: MouseEvent) => {
        e.stopPropagation();
        toggle();
    }} aria-label="Notifications">
        <span class="icon" style="font-size:20px">notifications</span>
        {#if notification_store.unread_count > 0}
            <span class="badge">{notification_store.unread_count > 9 ? '9+' : notification_store.unread_count}</span>
        {/if}
    </button>

    {#if open}
        <div class="dropdown" role="presentation" onclick={(e: MouseEvent) => e.stopPropagation()}>
            <div class="dropdown-header">
                <span class="dropdown-title">Notifications</span>
                {#if notification_store.unread_count > 0}
                    <button class="mark-all-btn" onclick={mark_all}>Mark all read</button>
                {/if}
            </div>
            {#if notification_store.items.length === 0}
                <div class="empty">No notifications</div>
            {:else}
                <div class="notification-list">
                    {#each notification_store.items.slice(0, 20) as n (n.id)}
                        <button class="notification-item" class:unread={!n.read} onclick={() => handle_click(n)}>
                            <span class={['icon', 'n-icon', n.type].join(' ')} style="font-size:16px">{type_icon[n.type]}</span>
                            <div class="n-content">
                                <span class="n-message">{n.message}</span>
                                <span class="n-time">{format_relative_short(n.timestamp)}</span>
                            </div>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .bell-wrapper { position: relative; }
    .bell-btn {
        position: relative; display: flex; align-items: center; justify-content: center;
        background: none; border: none; color: var(--fg-muted); cursor: pointer;
        padding: 0.35rem; border-radius: var(--radius); transition: color 0.15s, background 0.15s;
    }
    .bell-btn:hover { color: var(--fg); background: var(--bg-elevated, var(--bg)); }
    .badge {
        position: absolute; top: 0; right: 0; min-width: 16px; height: 16px;
        padding: 0 4px; border-radius: 999px; font-size: 0.6rem; font-weight: 700;
        background: var(--danger); color: var(--fg);
        display: flex; align-items: center; justify-content: center; line-height: 1;
    }
    .dropdown {
        position: absolute; top: calc(100% + 0.5rem); right: 0;
        width: 300px; max-height: 400px;
        background: var(--bg-surface); border: 1px solid var(--border);
        border-radius: var(--radius); box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        z-index: 100; display: flex; flex-direction: column; overflow: hidden;
    }
    .dropdown-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--border);
    }
    .dropdown-title { font-size: 0.8rem; font-weight: 600; color: var(--fg); }
    .mark-all-btn {
        background: none; border: none; color: var(--accent);
        font-size: 0.7rem; cursor: pointer; padding: 0;
    }
    .mark-all-btn:hover { text-decoration: underline; }
    .empty { padding: 2rem 1rem; text-align: center; color: var(--fg-muted); font-size: 0.8rem; }
    .notification-list { overflow-y: auto; flex: 1; }
    .notification-item {
        display: flex; align-items: flex-start; gap: 0.5rem; width: 100%;
        padding: 0.6rem 0.75rem; background: none; border: none;
        border-bottom: 1px solid var(--border); cursor: pointer; text-align: left;
        color: inherit; font-family: inherit; font-size: inherit; transition: background 0.1s;
    }
    .notification-item:hover { background: var(--bg-elevated, var(--bg)); }
    .notification-item.unread { background: rgba(var(--accent-rgb), 0.06); }
    .n-icon.success { color: var(--success); }
    .n-icon.danger { color: var(--danger); }
    .n-icon.warning { color: var(--warning); }
    .n-icon.info { color: var(--info); }
    .n-content { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1; }
    .n-message { font-size: 0.78rem; color: var(--fg); line-height: 1.35; }
    .n-time { font-size: 0.65rem; color: var(--fg-muted); }
    @media (max-width: 768px) {
        .dropdown { width: 260px; right: -0.5rem; }
    }
</style>
