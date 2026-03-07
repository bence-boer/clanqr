<script lang="ts">
    import { LoadingSpinner } from '$lib/components';
    import type { SkillInfoListItem } from '$lib/types';

    let {
        skill,
        expanded,
        content,
        files,
        content_loading,
        on_toggle
    }: {
        skill: SkillInfoListItem
        expanded: boolean
        content: string | null
        files: { name: string, content: string }[]
        content_loading: boolean
        on_toggle: () => void
    } = $props();
</script>

<div class="skill-card" class:expanded>
    <button class="skill-header" aria-expanded={expanded} onclick={on_toggle}>
        <div class="skill-title-row">
            <span class="icon skill-icon">extension</span>
            <span class="skill-name">{skill.name}</span>
            <span class="icon chevron">{expanded ? 'expand_less' : 'expand_more'}</span>
        </div>
        <p class="skill-description">{skill.description || 'No description available.'}</p>
        <p class="skill-path">{skill.path}</p>
    </button>

    {#if expanded}
        <div class="skill-detail" id="skill-detail-{skill.name}">
            <div class="detail-divider"></div>
            {#if content_loading}
                <div class="content-loading">
                    <LoadingSpinner size="sm" label="Loading content…" />
                </div>
            {:else}
                <pre class="skill-content">{content}</pre>
                {#if files.length > 0}
                    <div class="skill-extra-files">
                        {#each files as file (file.name)}
                            <details class="extra-file">
                                <summary class="extra-file-name">
                                    <span class="icon" style="font-size:14px">description</span>
                                    {file.name}
                                </summary>
                                <pre class="skill-content">{file.content}</pre>
                            </details>
                        {/each}
                    </div>
                {/if}
            {/if}
        </div>
    {/if}
</div>

<style>
    .skill-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
        transition: border-color 0.15s;
    }

    .skill-card:hover {
        border-color: rgba(212, 175, 55, 0.4);
    }

    .skill-card.expanded {
        border-color: var(--accent);
        grid-column: 1 / -1;
    }

    .skill-header {
        width: 100%;
        background: none;
        border: none;
        text-align: left;
        padding: 1rem 1.1rem;
        cursor: pointer;
        color: inherit;
        font-family: inherit;
    }

    .skill-title-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .skill-icon {
        font-size: 20px;
        color: var(--accent);
        flex-shrink: 0;
    }

    .skill-name {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--fg);
        flex: 1;
    }

    .chevron {
        font-size: 20px;
        color: var(--fg-muted);
        flex-shrink: 0;
    }

    .skill-description {
        font-size: 0.83rem;
        color: var(--fg-muted);
        margin: 0 0 0.4rem;
        line-height: 1.45;
    }

    .skill-path {
        font-size: 0.75rem;
        color: var(--fg-muted);
        opacity: 0.6;
        margin: 0;
        font-family: monospace;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .skill-detail {
        padding: 0 1.1rem 1rem;
    }

    .detail-divider {
        height: 1px;
        background: var(--border);
        margin-bottom: 1rem;
    }

    .content-loading {
        padding: 1rem 0;
    }

    .skill-content {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: calc(var(--radius) - 2px);
        padding: 1rem;
        font-size: 0.8rem;
        line-height: 1.6;
        color: var(--fg);
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0;
        max-height: 480px;
        overflow-y: auto;
    }

    .skill-extra-files {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.75rem;
    }

    .extra-file-name {
        cursor: pointer;
        font-size: 0.82rem;
        color: var(--accent);
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.3rem 0;
    }

    .extra-file .skill-content {
        margin-top: 0.5rem;
        max-height: 320px;
    }
</style>
