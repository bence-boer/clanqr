import type { SupabaseClient } from '../db';

export interface UserInfo {
    id: string
    display_name: string
    role: string
    created_at: string
    session_count: number
}

export interface InviteInfo {
    id: string
    label: string | null
    role: string
    expires_at: string
    used_at: string | null
    created_at: string
    created_by_display_name: string | null
    used_by_display_name: string | null
    token_preview: string | null
}

export async function get_users(supabase: SupabaseClient): Promise<UserInfo[]> {
    const { data, error } = await supabase
        .from('passkeys')
        .select('id, display_name, role, created_at, sessions(count)')
        .order('created_at', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((p: { id: string, display_name: string, role: string, created_at: string, sessions?: { count: number }[] }) => ({
        id: p.id,
        display_name: p.display_name,
        role: p.role,
        created_at: p.created_at,
        session_count: p.sessions?.[0]?.count ?? 0
    }));
}

export async function check_last_admin(supabase: SupabaseClient): Promise<boolean> {
    const { count } = await supabase
        .from('passkeys')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');
    return (count ?? 0) <= 1;
}

export async function get_invites(supabase: SupabaseClient): Promise<InviteInfo[]> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('invite_tokens')
        .select(
            'id, label, role, expires_at, used_at, created_at, token, created_by_passkey_id, used_by_passkey_id, passkeys!invite_tokens_created_by_passkey_id_fkey(display_name), used_by:passkeys!invite_tokens_used_by_passkey_id_fkey(display_name)'
        )
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((inv) => {
        const is_active = !inv.used_at && inv.expires_at > now;
        const created_by_name = Array.isArray(inv.passkeys) ? inv.passkeys[0]?.display_name : (inv.passkeys as { display_name: string } | null)?.display_name;
        const used_by_name = Array.isArray(inv.used_by) ? inv.used_by[0]?.display_name : (inv.used_by as { display_name: string } | null)?.display_name;
        return {
            id: inv.id,
            label: inv.label,
            role: inv.role,
            expires_at: inv.expires_at,
            used_at: inv.used_at,
            created_at: inv.created_at,
            created_by_display_name: created_by_name ?? null,
            used_by_display_name: used_by_name ?? null,
            token_preview: is_active ? inv.token.slice(0, 8) + '...' : null
        };
    });
}

export async function generate_invite(
    supabase: SupabaseClient,
    options: { role: string, expires_at: string, label?: string, created_by_passkey_id: string }
): Promise<{ id: string, label: string | null, role: string, expires_at: string, created_at: string, token: string }> {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Buffer.from(bytes).toString('base64url');

    const { data, error } = await supabase
        .from('invite_tokens')
        .insert({
            role: options.role,
            expires_at: options.expires_at,
            label: options.label ?? null,
            token,
            created_by_passkey_id: options.created_by_passkey_id
        })
        .select('id, label, role, expires_at, created_at')
        .single();

    if (error) throw error;
    return { ...data, token };
}
