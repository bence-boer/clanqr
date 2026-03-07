import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { env } from './env';

// Singleton — safe because we use the service_role key (not user-specific)
const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_KEY);

export function create_supabase_client(): SupabaseClient<Database> {
    return supabase;
}

export type TypedSupabaseClient = SupabaseClient<Database>;
