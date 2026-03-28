import type { UserRole } from './status';

export interface User {
    id: string
    github_id: number
    username: string
    display_name: string | null
    avatar_url: string | null
    email: string | null
    role: UserRole
    created_at: string
    updated_at: string
}
