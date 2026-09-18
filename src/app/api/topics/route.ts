import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceRoleClient } from "@/lib/supabase-server";
import { createAnonServerClient } from "@/lib/supabase-anon-server";
import { authorize } from "@/lib/admin-server";

export const runtime = "nodejs";

// Public GET — returns recent published topics. Used by the n8n daily flow
// to feed the AI a "don't re-pick these" list. No auth required since
// published topics are already public via the page surface.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawRecent = url.searchParams.get("recent");
  const requested = rawRecent ? parseInt(rawRecent, 10) : 30;
  const limit = Number.isFinite(requested)
    ? Math.max(1, Math.min(100, requested))
    : 30;

  const sb = createAnonServerClient();
  const { data, error } = await sb
    .from("topics")
    .select("slug,title,debate_question,published_at,tags,primary_axis")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    { topics: data ?? [] },
    {
      // Allow Vercel + CDN to cache for 60s. Daily n8n flow doesn't care
      // about a 1-min lag and we avoid hitting Supabase on every page load
      // that uses this endpoint.
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    },
  );
}

const SourceSchema = z.object({
  outlet: z.string().min(1).max(120),
  title: z.string().min(1).max(400),
  url: z.string().url(),
  bias_label: z.enum(["Left", "Lean Left", "Center", "Lean Right", "Right"]),
  excerpt: z.string().max(800).optional(),
});

const TopicBodySchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, hyphens."),
  title: z.string().min(3).max(280),
  debate_question: z.string().min(3).max(280),
  background: z.string().min(20).max(4000),
  left_summary: z.string().min(20).max(2000),
  right_summary: z.string().min(20).max(2000),
  left_sources: z.array(SourceSchema).max(20).default([]),
  right_sources: z.array(SourceSchema).max(20).default([]),
  center_sources: z.array(SourceSchema).max(20).default([]),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
  primary_axis: z.enum(["e", "s", "g", "none"]).default("none"),
  og_image_url: z.string().url().optional(),
  status: z.enum(["draft", "published", "archived"]).default("published"),
  published_at: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      { status: auth.status },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = TopicBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from("topics")
    .insert({
      slug: parsed.data.slug,
      title: parsed.data.title,
      debate_question: parsed.data.debate_question,
      background: parsed.data.background,
      left_summary: parsed.data.left_summary,
      right_summary: parsed.data.right_summary,
      left_sources: parsed.data.left_sources,
      right_sources: parsed.data.right_sources,
      center_sources: parsed.data.center_sources,
      tags: parsed.data.tags,
      primary_axis: parsed.data.primary_axis,
      og_image_url: parsed.data.og_image_url ?? null,
      status: parsed.data.status,
      ...(parsed.data.published_at
        ? { published_at: parsed.data.published_at }
        : {}),
    })
    .select()
    .single();

  if (error) {
    // Slug conflict surfaces as a unique-constraint error (code 23505).
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json(
      {
        error:
          error.code === "23505"
            ? `A topic with slug "${parsed.data.slug}" already exists.`
            : error.message,
      },
      { status },
    );
  }

  return NextResponse.json({ topic: data }, { status: 201 });
}
