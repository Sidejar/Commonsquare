import type { MetadataRoute } from "next";
import { createAnonServerClient } from "@/lib/supabase-anon-server";

// Re-generate at most once an hour. A new topic appears in sitemap.xml
// within ~60 minutes of being published, which is plenty fast for
// Googlebot's typical re-crawl cadence (daily for sitemap, faster for
// known fresh sites).
export const revalidate = 3600;

const SITE_BASE = "https://commonsquare.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: SITE_BASE,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_BASE}/topics`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_BASE}/debates`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_BASE}/quiz`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_BASE}/signup`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  let topicEntries: MetadataRoute.Sitemap = [];
  try {
    const sb = createAnonServerClient(revalidate);
    const { data, error } = await sb
      .from("topics")
      .select("slug, published_at, updated_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    topicEntries = (data ?? []).map((t) => ({
      url: `${SITE_BASE}/topics/${t.slug}`,
      lastModified: new Date(t.updated_at || t.published_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch (err) {
    // If Supabase is briefly unreachable we'd rather ship a sitemap with
    // the static entries than 500. Log + continue.
    console.error("sitemap: failed to fetch topics", err);
  }

  return [...staticEntries, ...topicEntries];
}
