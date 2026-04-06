import { z } from 'zod';

export const agent_type_info_schema = z.object({
    name: z.string().min(1).max(50),
    description: z.string().max(5000),
    tools: z.array(z.string().max(50)),
    prompt_content: z.string().max(100_000)
});

export const agent_type_name_schema = z.string()
    .min(1).max(50)
    .regex(/^[a-z][a-z0-9-]*$/, 'Agent type name must be lowercase alphanumeric with hyphens');
