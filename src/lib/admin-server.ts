import { createClient } from "@supabase/supabase-js";
import { isAdminEmail, isValidIngestToken } from "./admin";
import type { Database } from "./database.types";
import { noStoreFetch } from "./supabase-anon-server";

// Server-only. Shared by the admin/ingest API routes: accepts either the
// shared ingest token or a Supabase JWT belonging to an allowlisted admin.
export async function authorize(req: Request): Promise<
  | { ok: true; via: "ingest-token" | "admin"; userId?: string }
  | { ok: false; status: number; message: string }
> {
  const auth = req.headers.get("authorization");
  if (!auth) {
    return { ok: false, status: 401, message: "Missing Authorization header." };
  }
  const [scheme, token] = auth.split(" ");
  if ((scheme ?? "").toLowerCase() !== "bearer" || !token) {
    return { ok: false, status: 401, message: "Expected Bearer token." };
  }

  // Path 1: shared ingest token (used by n8n).
  if (isValidIngestToken(token)) {
    return { ok: true, via: "ingest-token" };
  }

  // Path 2: Supabase JWT from an admin user.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return {
      ok: false,
      status: 500,
      message: "Supabase env vars missing on the server.",
    };
  }
  const sb = createClient<Database>(url, anon, {
    global: { fetch: noStoreFetch },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, message: "Invalid session token." };
  }
  if (!isAdminEmail(data.user.email)) {
    return {
      ok: false,
      status: 403,
      message: "This account is not on the admin allowlist.",
    };
  }
  return { ok: true, via: "admin", userId: data.user.id };
}
