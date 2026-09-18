// Pure logic for the daily-topic function: feed list, RSS/Atom parsing, and
// turning Claude's draft into a topics row. No Deno / network / npm imports,
// so lib.test.ts runs under plain `deno test` or `node --experimental-strip-types`.

export type Bias = "Left" | "Lean Left" | "Center" | "Lean Right" | "Right";
export type Feed = { outlet: string; bias: Bias; url: string };
export type Item = {
  outlet: string;
  bias: Bias;
  title: string;
  url: string;
  excerpt: string;
  ts: number | null;
};

// Bias labels follow the AllSides media bias ratings. Edit freely — a dead or
// blocked feed is skipped, it never fails the run.
export const FEEDS: Feed[] = [
  { outlet: "HuffPost", bias: "Left", url: "https://www.huffpost.com/section/politics/feed" },
  { outlet: "Vox", bias: "Left", url: "https://www.vox.com/rss/index.xml" },
  { outlet: "Mother Jones", bias: "Left", url: "https://www.motherjones.com/politics/feed/" },
  { outlet: "The Guardian", bias: "Lean Left", url: "https://www.theguardian.com/us-news/us-politics/rss" },
  { outlet: "NPR", bias: "Lean Left", url: "https://feeds.npr.org/1014/rss.xml" },
  { outlet: "The New York Times", bias: "Lean Left", url: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml" },
  { outlet: "Politico", bias: "Lean Left", url: "https://rss.politico.com/politics-news.xml" },
  { outlet: "CBS News", bias: "Lean Left", url: "https://www.cbsnews.com/latest/rss/politics" },
  { outlet: "ABC News", bias: "Lean Left", url: "https://abcnews.go.com/abcnews/politicsheadlines" },
  { outlet: "BBC News", bias: "Center", url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml" },
  { outlet: "The Hill", bias: "Center", url: "https://thehill.com/homenews/feed/" },
  { outlet: "Christian Science Monitor", bias: "Center", url: "https://rss.csmonitor.com/feeds/politics" },
  { outlet: "NewsNation", bias: "Center", url: "https://www.newsnationnow.com/politics/feed/" },
  { outlet: "New York Post", bias: "Lean Right", url: "https://nypost.com/politics/feed/" },
  { outlet: "Washington Examiner", bias: "Lean Right", url: "https://www.washingtonexaminer.com/section/news/feed" },
  { outlet: "The Washington Times", bias: "Lean Right", url: "https://www.washingtontimes.com/rss/headlines/news/politics/" },
  { outlet: "Reason", bias: "Lean Right", url: "https://reason.com/latest/feed/" },
  { outlet: "Fox News", bias: "Right", url: "https://moxie.foxnews.com/google-publisher/politics.xml" },
  { outlet: "National Review", bias: "Right", url: "https://www.nationalreview.com/feed/" },
  { outlet: "Breitbart", bias: "Right", url: "https://feeds.feedburner.com/breitbart" },
  { outlet: "The Federalist", bias: "Right", url: "https://thefederalist.com/feed/" },
  { outlet: "The Daily Wire", bias: "Right", url: "https://www.dailywire.com/feeds/rss.xml" },
];

const PER_FEED = 8;
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Feed text is often HTML, sometimes entity-escaped HTML: decode, strip tags,
// decode again, collapse whitespace.
export function cleanText(raw: string, max: number): string {
  let s = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  s = decodeEntities(s).replace(/<[^>]+>/g, " ");
  s = decodeEntities(s).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

function tag(block: string, name: string): string {
  const m = block.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"),
  );
  return m ? m[1] : "";
}

// Handles RSS 2.0 (<item>, <link>text</link>) and Atom (<entry>, <link href>).
export function parseFeed(xml: string, feed: Feed, now: number): Item[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  const items: Item[] = [];
  for (const b of blocks) {
    const title = cleanText(tag(b, "title"), 300);
    let url = cleanText(tag(b, "link"), 2000);
    if (!url) {
      const alt =
        b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ??
        b.match(/<link[^>]*href=["']([^"']+)["']/i);
      url = alt ? decodeEntities(alt[1]).trim() : "";
    }
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    } catch {
      continue;
    }
    if (!title) continue;
    const rawDate = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date");
    const parsed = Date.parse(cleanText(rawDate, 100));
    const ts = Number.isFinite(parsed) ? parsed : null;
    if (ts !== null && now - ts > MAX_AGE_MS) continue;
    const excerpt = cleanText(tag(b, "description") || tag(b, "summary"), 280);
    items.push({ outlet: feed.outlet, bias: feed.bias, title, url, excerpt, ts });
    if (items.length >= PER_FEED) break;
  }
  return items;
}

export type Draft = {
  title: string;
  slug_base: string;
  debate_question: string;
  background: string;
  left_summary: string;
  right_summary: string;
  source_ids: number[];
  tags: string[];
  primary_axis: "e" | "s" | "g" | "none";
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

const clamp = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);

// Turn Claude's draft into a topics row. Sources come from the real feed items
// and are bucketed by the OUTLET's bias rating, not by anything the model said.
export function buildRow(draft: Draft, items: Item[], status: string, date: string) {
  const picked = [...new Set(draft.source_ids)]
    .filter((id) => Number.isInteger(id) && id >= 0 && id < items.length)
    .map((id) => items[id]);
  const toSource = (it: Item) => ({
    outlet: it.outlet,
    title: it.title,
    url: it.url,
    bias_label: it.bias,
    ...(it.excerpt ? { excerpt: it.excerpt } : {}),
  });
  const left = picked.filter((it) => it.bias === "Left" || it.bias === "Lean Left").map(toSource);
  const right = picked.filter((it) => it.bias === "Right" || it.bias === "Lean Right").map(toSource);
  const center = picked.filter((it) => it.bias === "Center").map(toSource);
  if (!left.length || !right.length) {
    throw new Error(
      `Draft lacks cross-spectrum sources (left=${left.length}, right=${right.length}).`,
    );
  }
  const slugBase = slugify(draft.slug_base) || slugify(draft.title) || "topic";
  for (const [k, v] of Object.entries({
    title: draft.title,
    debate_question: draft.debate_question,
    background: draft.background,
    left_summary: draft.left_summary,
    right_summary: draft.right_summary,
  })) {
    if (typeof v !== "string" || v.trim().length < (k === "title" || k === "debate_question" ? 3 : 20)) {
      throw new Error(`Draft field "${k}" is missing or too short.`);
    }
  }
  return {
    slug: `${slugBase}-${date}`,
    title: clamp(draft.title.trim(), 280),
    debate_question: clamp(draft.debate_question.trim(), 280),
    background: clamp(draft.background.trim(), 4000),
    left_summary: clamp(draft.left_summary.trim(), 2000),
    right_summary: clamp(draft.right_summary.trim(), 2000),
    left_sources: left,
    right_sources: right,
    center_sources: center,
    tags: (draft.tags ?? [])
      .map((t) => clamp(String(t).toLowerCase().trim(), 40))
      .filter(Boolean)
      .slice(0, 10),
    primary_axis: ["e", "s", "g", "none"].includes(draft.primary_axis) ? draft.primary_axis : "none",
    status,
  };
}
