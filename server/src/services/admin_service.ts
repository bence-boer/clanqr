import type { TypedSupabaseClient } from '../db';

export interface UserInfo {
    id: string
    username: string
    display_name: string | null
    role: string
    created_at: string
    session_count: number
}

export async function get_users(supabase: TypedSupabaseClient): Promise<UserInfo[]> {
    const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, role, created_at, sessions(count)')
        .order('created_at', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((u) => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name,
        role: u.role,
        created_at: u.created_at,
        session_count: u.sessions?.[0]?.count ?? 0
    }));
}

export async function check_last_admin(supabase: TypedSupabaseClient): Promise<boolean> {
    const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');
    return (count ?? 0) <= 1;
}
