import type { MiddlewareHandler } from "hono";
import { create_supabase_client, type SupabaseClient } from "../db";

export type AppBindings = {
  Variables: {
    supabase: SupabaseClient;
    passkey_id: string;
    role: string;
    request_id: string;
  };
};

export const supabase_middleware = (): MiddlewareHandler<AppBindings> => {
  const supabase = create_supabase_client();
  return async (context, next) => {
    context.set("supabase", supabase);
    await next();
  };
};
