import { api } from '$lib/api/client';
import { toast_store } from '$lib/stores/toast.svelte';
import type { Feature, Project } from '$lib/types';

export interface ProjectsData {
    projects: Project[]
    features_by_project: Record<string, Feature[]>
}

export async function load_projects_data(): Promise<ProjectsData | null> {
    try {
        const [proj, feats] = await Promise.all([api.list_projects(), api.list_features()]);
        const grouped: Record<string, Feature[]> = {};
        for (const feat of feats) {
            const pid = feat.project_id;
            if (!grouped[pid]) grouped[pid] = [];
            grouped[pid].push(feat);
        }
        return { projects: proj, features_by_project: grouped };
    }
    catch (error) {
        console.error('Failed to load projects:', error);
        toast_store.error('Failed to load projects');
        return null;
    }
}

export async function create_project_action(name: string, description: string): Promise<boolean> {
    try {
        await api.create_project({ name: name.trim(), description: description.trim() || undefined });
        return true;
    }
    catch (error) {
        console.error('Failed to create project:', error);
        toast_store.error('Failed to create project');
        return false;
    }
}

export async function delete_project_action(id: string): Promise<boolean> {
    try {
        await api.delete_project(id);
        return true;
    }
    catch (error) {
        console.error('Failed to delete project:', error);
        toast_store.error('Failed to delete project');
        return false;
    }
}

export async function delete_projects_action(ids: string[]): Promise<boolean> {
    try {
        await Promise.all(ids.map((id) => api.delete_project(id)));
        return true;
    }
    catch (error) {
        console.error('Failed to delete projects:', error);
        toast_store.error('Failed to delete projects');
        return false;
    }
}

export async function archive_project_action(id: string): Promise<boolean> {
    try {
        await api.update_project(
            id,
            { status: 'archived' } as Record<string, unknown> as { name?: string, description?: string | null }
        );
        toast_store.success('Project archived');
        return true;
    }
    catch (error) {
        console.error('Failed to archive project:', error);
        toast_store.error('Failed to archive project');
        return false;
    }
}

export async function unarchive_project_action(id: string): Promise<boolean> {
    try {
        await api.update_project(
            id,
            { status: 'active' } as Record<string, unknown> as { name?: string, description?: string | null }
        );
        toast_store.success('Project restored');
        return true;
    }
    catch (error) {
        console.error('Failed to restore project:', error);
        toast_store.error('Failed to restore project');
        return false;
    }
}

export async function save_project_edit_action(
    id: string,
    name: string,
    description: string
): Promise<boolean> {
    try {
        await api.update_project(id, {
            name: name.trim(),
            description: description.trim() || null
        } as Partial<Project>);
        return true;
    }
    catch (error) {
        console.error('Failed to update project:', error);
        toast_store.error('Failed to update project');
        return false;
    }
}
