import { existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import type { TypedSupabaseClient } from '../db';
import { logger } from '../utils/logger';

const MIME_TYPES: Record<string, string> = {
    '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json',
    '.csv': 'text/csv', '.html': 'text/html', '.css': 'text/css',
    '.js': 'text/javascript', '.ts': 'text/typescript', '.py': 'text/x-python',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.pdf': 'application/pdf', '.zip': 'application/zip',
    '.xml': 'application/xml', '.yaml': 'text/yaml', '.yml': 'text/yaml',
    '.sh': 'text/x-shellscript', '.log': 'text/plain'
};

export function lookup_mime(filename: string): string {
    return MIME_TYPES[extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

/** Scan the artifacts/ directory and catalog files in the database */
export async function catalog_artifacts(
    task_id: string,
    work_dir: string,
    supabase: TypedSupabaseClient
): Promise<void> {
    const artifacts_dir = join(work_dir, 'artifacts');
    if (!existsSync(artifacts_dir)) return;

    try {
        const entries = readdirSync(artifacts_dir, { withFileTypes: true });
        const files = entries.filter((entry) => entry.isFile());
        if (files.length === 0) return;

        const rows = files.map((entry) => {
            const file_path = join(artifacts_dir, entry.name);
            const stat = statSync(file_path);
            return {
                task_id,
                filename: entry.name,
                size_bytes: stat.size,
                mime_type: lookup_mime(entry.name)
            };
        });

        const { error } = await supabase
            .from('task_artifacts')
            .upsert(rows, { onConflict: 'task_id,filename' });

        if (error) {
            logger.error('Failed to catalog artifacts', { service: 'spawn_agent', task_id, error: error.message });
        }
        else {
            logger.info('Cataloged task artifacts', { service: 'spawn_agent', task_id, count: rows.length });
        }
    }
    catch (error) {
        logger.warn('Error scanning artifacts directory', { service: 'spawn_agent', task_id, error: String(error) });
    }
}
