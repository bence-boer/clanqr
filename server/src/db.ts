import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

export function create_supabase_client(): SupabaseClient {
    return createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
}

export type { SupabaseClient };
