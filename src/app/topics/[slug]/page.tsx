import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { CS } from "@/lib/cs";
import { CSMark } from "@/components/cs/cs-mark";
import { CSButton } from "@/components/cs/cs-button";
import { CSBadge } from "@/components/cs/cs-badge";
import { TopicVotePanel } from "@/components/topics/topic-vote-panel";
import { TopicComments } from "@/components/topics/topic-comments";
import { DebateCard } from "@/components/debates/debate-ui";
import { getTopicDebatesServer } from "@/lib/debates-server";
import {
  getTopicBySlugServer,
  getTopicCommentsServer,
  getTopicVoteTallyServer,
} from "@/lib/topics-server";
import type { TopicSource } from "@/lib/database.types";

// Server-render to give the page real SEO + proper share previews.
export const dynamic = "force-dynamic";

interface PageProps {
  params: { slug: string };
}

// Bias label → grayscale dot color. Five-point scale, no red/blue. The
// dot only signals "leans more" or "leans less"; which side is shown by
// position in the layout, not color.
const BIAS_DOT: Record<string, string> = {
  Left: CS.ink,
  "Lean Left": "rgba(26,24,20,0.7)",
  Center: CS.mute,
  "Lean Right": "rgba(26,24,20,0.7)",
  Right: CS.ink,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const topic = await getTopicBySlugServer(params.slug);
  if (!topic) {
    return { title: "Topic not found · CommonSquare" };
  }
  const description = truncate(topic.background.replace(/\s+/g, " "), 200);
  const url = `https://commonsquare.app/topics/${topic.slug}`;
  // Note: the OG image is auto-attached by the file-based
  // `opengraph-image.tsx` next to this page. If `topic.og_image_url` is
  // set we override with a custom URL; otherwise the dynamic image is
  // used. The card type is always summary_large_image since both paths
  // produce a 1200×630 image.
  const customImage = topic.og_image_url ?? undefined;
  return {
    title: `${topic.debate_question} · CommonSquare`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: topic.title,
      description,
      type: "article",
      url,
      siteName: "CommonSquare",
      publishedTime: topic.published_at,
      tags: topic.tags,
      ...(customImage ? { images: [{ url: customImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: topic.title,
      description,
      ...(customImage ? { images: [customImage] } : {}),
    },
    keywords: topic.tags,
  };
}

function SourceCard({ source }: { source: TopicSource }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block transition-opacity hover:opacity-90"
      style={{
        padding: "16px 18px",
        borderRadius: 12,
        background: CS.paper,
        border: `1px solid ${CS.rule}`,
        textDecoration: "none",
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: BIAS_DOT[source.bias_label] ?? CS.mute,
          }}
        />
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            color: CS.mute,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {source.outlet} · {source.bias_label}
        </span>
      </div>
      <div
        className="font-sans"
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: CS.ink,
          letterSpacing: "-0.015em",
          lineHeight: 1.35,
          marginBottom: source.excerpt ? 8 : 0,
        }}
      >
        {source.title}
      </div>
      {source.excerpt ? (
        <div
          className="font-sans"
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: CS.mute,
            letterSpacing: "-0.005em",
          }}
        >
          “{source.excerpt}”
        </div>
      ) : null}
    </a>
  );
}

function SideColumn({
  side,
  summary,
  sources,
}: {
  side: "left" | "right";
  summary: string;
  sources: TopicSource[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: side === "left" ? "flex-start" : "flex-end",
            width: 28,
            height: 14,
            border: `1px solid ${CS.rule2}`,
            borderRadius: 999,
            background: CS.paper,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: CS.ink,
              margin: "0 2px",
            }}
          />
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            color: CS.ink,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {side === "left" ? "Left-leaning coverage" : "Right-leaning coverage"}
        </span>
      </div>
      <p
        className="font-sans"
        style={{
          margin: 0,
          fontSize: 16,
          lineHeight: 1.6,
          color: CS.ink,
          letterSpacing: "-0.005em",
          whiteSpace: "pre-line",
        }}
      >
        {summary}
      </p>
      <div className="flex flex-col gap-3">
        {sources.map((s, i) => (
          <SourceCard key={`${s.url}-${i}`} source={s} />
        ))}
      </div>
    </div>
  );
}

export default async function TopicPage({ params }: PageProps) {
  const topic = await getTopicBySlugServer(params.slug);
  if (!topic) {
    notFound();
  }

  // Parallel fetch tally + initial comments + open debates on this topic.
  const [tally, initialComments, topicDebates] = await Promise.all([
    getTopicVoteTallyServer(topic.id),
    getTopicCommentsServer(topic.id, "top"),
    getTopicDebatesServer(topic.id),
  ]);

  const leftSources = (topic.left_sources as unknown as TopicSource[]) ?? [];
  const rightSources = (topic.right_sources as unknown as TopicSource[]) ?? [];

  return (
    <main className="min-h-screen" style={{ background: CS.paper }}>
      {/* Nav */}
      <div className="flex items-center justify-between px-6 py-5 md:px-16 md:py-6">
        <Link href="/" className="inline-flex items-center gap-3">
          <CSMark size={26} />
          <span
            className="font-sans"
            style={{
              fontSize: 17,
              fontWeight: 500,
              letterSpacing: "-0.025em",
              color: CS.ink,
            }}
          >
            commonsquare
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/topics">
            <CSButton size="sm" variant="ghost">
              All topics
            </CSButton>
          </Link>
          <Link href="/quiz">
            <CSButton size="sm" variant="ink">
              Take the Compass
            </CSButton>
          </Link>
        </div>
      </div>

      <article className="mx-auto w-full max-w-[920px] px-6 pb-24 pt-8 md:px-10">
        {/* Eyebrow */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {isToday(topic.published_at) ? (
            <CSBadge dot>Today&rsquo;s Topic</CSBadge>
          ) : null}
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              color: CS.mute,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {formatDate(topic.published_at)}
          </span>
          {topic.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="font-mono"
              style={{
                fontSize: 10,
                color: CS.mute,
                padding: "4px 10px",
                borderRadius: 999,
                background: CS.paper2,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1
          className="font-sans text-balance"
          style={{
            margin: 0,
            fontWeight: 500,
            fontSize: "clamp(32px, 5vw, 56px)",
            lineHeight: 1.05,
            letterSpacing: "-0.035em",
            color: CS.ink,
          }}
        >
          {topic.title}
        </h1>

        {/* Vote panel (client island — interactivity + signup gate) */}
        <TopicVotePanel
          topicId={topic.id}
          question={topic.debate_question}
          initialTally={tally}
        />

        {/* Background */}
        <section className="mt-14">
          <div
            className="font-mono mb-3"
            style={{
              fontSize: 11,
              color: CS.mute,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Background
          </div>
          <p
            className="font-sans"
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.65,
              color: CS.ink,
              letterSpacing: "-0.005em",
              whiteSpace: "pre-line",
            }}
          >
            {topic.background}
          </p>
        </section>

        {/* How each side sees it */}
        <section className="mt-14">
          <div
            className="font-mono mb-3"
            style={{
              fontSize: 11,
              color: CS.mute,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            How each side covers this
          </div>
          <p
            className="font-sans mb-10"
            style={{
              margin: "0 0 36px",
              fontSize: 14,
              lineHeight: 1.55,
              color: CS.mute,
              maxWidth: 600,
            }}
          >
            Both columns use the same layout. The framing, language, and
            emphasis are the substance.
          </p>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-10">
            <SideColumn
              side="left"
              summary={topic.left_summary}
              sources={leftSources}
            />
            <SideColumn
              side="right"
              summary={topic.right_summary}
              sources={rightSources}
            />
          </div>
        </section>

        {/* Debates on this topic — open debates only; closed ones never
            leave their two debaters' lists. */}
        <section className="mt-16">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h3
              className="font-sans"
              style={{
                margin: 0,
                fontWeight: 500,
                fontSize: "clamp(22px, 3vw, 28px)",
                letterSpacing: "-0.025em",
                color: CS.ink,
              }}
            >
              Debates on this topic
            </h3>
            <Link href={`/debates/new?topic=${topic.slug}`}>
              <CSButton variant="primary" size="sm">
                Debate this topic →
              </CSButton>
            </Link>
          </div>
          {topicDebates.length === 0 ? (
            <p
              className="font-sans px-6 py-8"
              style={{
                margin: 0,
                border: `1px dashed ${CS.rule2}`,
                borderRadius: 14,
                fontSize: 14,
                color: CS.ink,
              }}
            >
              Nobody has debated this one yet. Pick a side and issue the
              first challenge.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {topicDebates.map((d) => (
                <DebateCard key={d.id} debate={d} />
              ))}
            </div>
          )}
        </section>

        {/* Comments (client island — interactivity + signup gate) */}
        <TopicComments
          topicId={topic.id}
          initialComments={initialComments}
          initialSort="top"
        />

        {/* Final CTA */}
        <section
          className="mt-16 flex flex-col gap-4 px-6 py-7 md:px-8"
          style={{
            background: CS.ink,
            color: CS.paper,
            borderRadius: 18,
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: 11,
              color: "rgba(244,241,234,0.6)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Have a take?
          </div>
          <h3
            className="font-sans"
            style={{
              margin: 0,
              fontWeight: 500,
              fontSize: "clamp(22px, 3vw, 28px)",
              letterSpacing: "-0.025em",
              color: CS.paper,
              lineHeight: 1.2,
            }}
          >
            Take the compass. See where you actually stand.
          </h3>
          <p
            className="font-sans"
            style={{
              margin: 0,
              maxWidth: 520,
              fontSize: 14,
              lineHeight: 1.55,
              color: "rgba(244,241,234,0.72)",
            }}
          >
            22 questions, two minutes. Your archetype is yours alone — only
            the label is shareable.
          </p>
          <div>
            <Link href="/quiz">
              <CSButton variant="primary" size="md">
                Take the Compass →
              </CSButton>
            </Link>
          </div>
        </section>

        <div className="mt-10 flex justify-center">
          <Link href="/topics">
            <CSButton variant="ghost" size="md">
              ← All topics
            </CSButton>
          </Link>
        </div>
      </article>
    </main>
  );
}
