import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

// Singleton — safe because we use the service_role key (not user-specific)
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

export function create_supabase_client(): SupabaseClient {
    return supabase;
}

export type { SupabaseClient };
