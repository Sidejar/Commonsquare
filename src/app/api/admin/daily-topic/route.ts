import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-server";
import { getServiceRoleClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin surface for the automated Topic of the Day (Supabase pg_cron →
// `daily-topic` edge function). GET lists recent runs; POST fires a run now.
// Doubles as the "am I an admin?" check for the page, since ADMIN_EMAILS is
// server-only.

export async function GET(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from("topic_ingest_runs")
    .select("id,status,detail,created_at,topics(slug,title,status)")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ runs: data ?? [] });
}

const BodySchema = z.object({
  force: z.boolean().default(true),
  dry_run: z.boolean().default(false),
  status: z.enum(["published", "draft"]).default("published"),
});

export async function POST(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  // The run takes 1–2 minutes, so it always goes in the background; the
  // outcome shows up in topic_ingest_runs (poll GET).
  const admin = getServiceRoleClient();
  const { data, error } = await admin.rpc("trigger_daily_topic", {
    p_body: { ...parsed.data, background: true },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ request_id: data }, { status: 202 });
}
