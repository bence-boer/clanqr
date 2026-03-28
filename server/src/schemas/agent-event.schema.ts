import { z } from 'zod';

export const create_agent_event_schema = z.object({
    agent_session_id: z.string().uuid(),
    event_type: z.string().min(1).max(100),
    event_data: z.record(z.unknown()).default({})
});
