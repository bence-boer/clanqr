import type { MiddlewareHandler } from "hono";
import { create_supabase_client, type SupabaseClient } from "../db";

export type AppBindings = {
  Variables: {
    supabase: SupabaseClient;
    passkey_id: string;
    role: string;
  };
};

export const supabase_middleware = (): MiddlewareHandler<AppBindings> => {
  return async (context, next) => {
    const supabase = create_supabase_client();
    context.set("supabase", supabase);
    await next();
  };
};
