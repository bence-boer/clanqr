<script lang="ts">
    import { api } from '$lib/api/client';
    import type { TaskArtifact } from '$lib/types';

    interface Props {
        task_id: string
    }

    let { task_id }: Props = $props();

    let files = $state<TaskArtifact[]>([]);
    let loading = $state(true);

    function format_size(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function file_icon(mime: string): string {
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('text/')) return 'description';
        if (mime === 'application/pdf') return 'picture_as_pdf';
        if (mime === 'application/json') return 'data_object';
        if (mime === 'application/zip') return 'folder_zip';
        return 'attach_file';
    }

    async function load() {
        loading = true;
        try {
            files = await api.list_task_files(task_id);
        }
        catch {
            files = [];
        }
        finally {
            loading = false;
        }
    }

    load();
</script>

{#if !loading && files.length > 0}
    <div class="task-files">
        <div class="files-header">
            <span class="icon" style="font-size:14px">folder_open</span>
            <span class="files-label">Files ({files.length})</span>
        </div>
        <div class="files-list">
            {#each files as file (file.id)}
                <a
                    class="file-item"
                    href={api.task_file_url(task_id, file.filename)}
                    target="_blank"
                    rel="external noopener"
                    title="Download {file.filename}"
                >
                    <span class="icon file-icon">{file_icon(file.mime_type)}</span>
                    <span class="file-info">
                        <span class="file-name">{file.filename}</span>
                        <span class="file-meta">{format_size(file.size_bytes)}</span>
                    </span>
                    <span class="icon download-icon">download</span>
                </a>
            {/each}
        </div>
    </div>
{/if}

<style>
    .task-files {
        margin-top: 0.6rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
    }
    .files-header {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.5rem 0.65rem;
        background: var(--bg-surface);
        border-bottom: 1px solid var(--border);
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--fg-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .files-list {
        display: flex;
        flex-direction: column;
    }
    .file-item {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.5rem 0.65rem;
        text-decoration: none;
        color: var(--fg);
        transition: background 0.1s;
        border-bottom: 1px solid var(--border);
    }
    .file-item:last-child {
        border-bottom: none;
    }
    .file-item:hover {
        background: var(--bg-surface);
    }
    .file-icon {
        font-size: 16px;
        color: var(--accent);
        flex-shrink: 0;
    }
    .file-info {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        flex: 1;
        min-width: 0;
    }
    .file-name {
        font-size: 0.82rem;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .file-meta {
        font-size: 0.7rem;
        color: var(--fg-muted);
    }
    .download-icon {
        font-size: 16px;
        color: var(--fg-muted);
        flex-shrink: 0;
        opacity: 0;
        transition: opacity 0.1s;
    }
    .file-item:hover .download-icon {
        opacity: 1;
    }
</style>
