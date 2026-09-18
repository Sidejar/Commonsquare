// Run: node --experimental-strip-types supabase/functions/daily-topic/lib.test.ts
//  or: deno run supabase/functions/daily-topic/lib.test.ts
import { buildRow, cleanText, type Draft, type Item, parseFeed, slugify } from "./lib.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const now = Date.parse("2026-09-17T12:00:00Z");

const rss = `<rss><channel><title>Feed</title>
<item><title><![CDATA[Senate &amp; House clash over <i>budget</i>]]></title>
<link>https://example.com/a?x=1&amp;y=2</link>
<description>&lt;p&gt;Lawmakers&#8217; fight &amp;amp; more&lt;/p&gt;</description>
<pubDate>Thu, 17 Sep 2026 08:00:00 -0400</pubDate></item>
<item><title>Old story</title><link>https://example.com/old</link>
<pubDate>Mon, 01 Sep 2025 08:00:00 GMT</pubDate></item>
<item><title>Bad link</title><link>javascript:alert(1)</link></item>
</channel></rss>`;
const rssItems = parseFeed(rss, { outlet: "Ex", bias: "Left", url: "https://example.com/feed" }, now);
assert(rssItems.length === 1, `rss keeps only the fresh, valid item (got ${rssItems.length})`);
assert(rssItems[0].title === "Senate & House clash over budget", `rss title cleaned: ${rssItems[0].title}`);
assert(rssItems[0].url === "https://example.com/a?x=1&y=2", `rss link decoded: ${rssItems[0].url}`);
assert(rssItems[0].excerpt === "Lawmakers’ fight & more", `rss excerpt cleaned: ${rssItems[0].excerpt}`);

const atom = `<feed><title type="text">Vox</title><link rel="alternate" href="https://vox.example" />
<entry><title type="html"><![CDATA[Atom story]]></title>
<link rel="alternate" type="text/html" href="https://vox.example/story" />
<published>2026-09-17T08:00:00-04:00</published>
<summary type="html"><![CDATA[<p>Summary here</p>]]></summary></entry></feed>`;
const atomItems = parseFeed(atom, { outlet: "Vox", bias: "Left", url: "https://vox.example/feed" }, now);
assert(atomItems.length === 1 && atomItems[0].url === "https://vox.example/story", "atom link href parsed");
assert(atomItems[0].excerpt === "Summary here", "atom summary parsed");

assert(cleanText("x".repeat(500), 100).length === 100, "cleanText truncates");
assert(slugify("Senate War-Powers: Résolution!") === "senate-war-powers-resolution", slugify("Senate War-Powers: Résolution!"));

const items: Item[] = [
  { outlet: "NPR", bias: "Lean Left", title: "L", url: "https://l.example/1", excerpt: "", ts: now },
  { outlet: "Fox News", bias: "Right", title: "R", url: "https://r.example/1", excerpt: "r", ts: now },
  { outlet: "BBC News", bias: "Center", title: "C", url: "https://c.example/1", excerpt: "", ts: now },
];
const draft: Draft = {
  title: "A neutral title",
  slug_base: "Neutral Title",
  debate_question: "Should X happen?",
  background: "b".repeat(50),
  left_summary: "l".repeat(50),
  right_summary: "r".repeat(50),
  source_ids: [0, 1, 2, 2, 99, -1],
  tags: ["Budget", " congress "],
  primary_axis: "e",
};
const row = buildRow(draft, items, "published", "2026-09-17");
assert(row.slug === "neutral-title-2026-09-17", row.slug);
assert(row.left_sources.length === 1 && row.right_sources.length === 1 && row.center_sources.length === 1, "sources bucketed by outlet bias, dupes + out-of-range ids dropped");
assert(row.right_sources[0].bias_label === "Right" && row.right_sources[0].url === "https://r.example/1", "source uses real feed url");
assert(row.tags.join() === "budget,congress", row.tags.join());

let threw = false;
try {
  buildRow({ ...draft, source_ids: [0, 2] }, items, "published", "2026-09-17");
} catch {
  threw = true;
}
assert(threw, "rejects a draft with no right-leaning source");

console.log("daily-topic lib: all checks passed");
