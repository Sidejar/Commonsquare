import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Server-side Supabase client using the anon key. Honors RLS — use this
// when you need to read public data on the server (SSR for SEO etc) and
// don't need to bypass row-level security. Persistence + session refresh
// are disabled because there's no browser session here.
//
// Do NOT use the service role key for read-only SSR. Service role bypasses
// RLS and should be reserved for /api routes that need to write.

// supabase-js calls fetch() with no cache hint, so Next's Data Cache kept
// Supabase responses for a year: SSR pages served deleted and stale rows even
// with `dynamic = "force-dynamic"`. Every server-side client uses this.
export const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });

// Pass `revalidate` (seconds) to cache on purpose — the sitemap does, hourly.
export function createAnonServerClient(revalidate?: number) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: revalidate
        ? (input, init) => fetch(input, { ...init, next: { revalidate } })
        : noStoreFetch,
    },
  });
}
