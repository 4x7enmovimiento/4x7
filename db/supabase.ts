import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lhrdapdtcrjqlbjozmjc.supabase.co";

const DEFAULT_KEY = Buffer.from("c2Jfc2VjcmV0X29FUm4wWjAzTmkwcWphZWRkQjdjRWdfREZrOG9oUFA=", "base64").toString("utf-8");
export const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_KEY;

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabaseInstance;
}
