export interface User {
    id: string;
    display_name: string | null;
    role: 'admin' | 'user';
    created_at: string;
    session_count: number;
}

export interface InviteToken {
    id: string;
    label: string | null;
    role: 'admin' | 'user';
    expires_at: string;
    used_at: string | null;
    created_at: string;
    created_by_display_name: string | null;
    used_by_display_name: string | null;
    token_preview: string | null;
}

export interface InviteStatus {
    valid: boolean;
    reason?: 'missing' | 'not_found' | 'used' | 'expired';
    role?: 'admin' | 'user';
    label?: string | null;
    expires_at?: string;
}
