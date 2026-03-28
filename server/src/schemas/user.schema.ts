import { z } from 'zod';

export const create_user_schema = z.object({
    github_id: z.number().int().positive(),
    username: z.string().min(1).max(100),
    display_name: z.string().max(200).nullable().optional(),
    avatar_url: z.string().url().nullable().optional(),
    email: z.string().email().nullable().optional(),
    role: z.enum(['admin', 'member']).default('member')
});

export const update_user_schema = z.object({
    display_name: z.string().max(200).nullable().optional(),
    avatar_url: z.string().url().nullable().optional(),
    email: z.string().email().nullable().optional(),
    role: z.enum(['admin', 'member']).optional()
});
