import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabase_url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabase_key =
  process.env.SUPABASE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

export function create_supabase_client(): SupabaseClient {
  return createClient(supabase_url, supabase_key);
}

export type { SupabaseClient };
