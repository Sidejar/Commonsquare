import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { noStoreFetch } from "./supabase-anon-server";

// Server-only Supabase client using the SERVICE ROLE key. Bypasses RLS.
// NEVER import this from a "use client" file. NEVER expose the env var via
// NEXT_PUBLIC_*. Used by:
//   - /api/topics ingest route (n8n + admin form publish)
//   - public topic page reads when we want fresh data without caching

let _admin: SupabaseClient<Database> | null = null;

export function getServiceRoleClient(): SupabaseClient<Database> {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase server env vars. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY in .env.local (dev) and Vercel (prod).",
    );
  }
  _admin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  });
  return _admin;
}
