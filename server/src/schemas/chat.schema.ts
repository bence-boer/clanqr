import { z } from 'zod';

export const send_message_schema = z.object({
    agent_session_id: z.string().uuid(),
    content: z.string().min(1).max(50_000),
    role: z.enum(['user', 'assistant', 'system']).default('user')
});
