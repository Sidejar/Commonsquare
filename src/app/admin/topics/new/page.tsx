"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CS } from "@/lib/cs";
import { CSMark } from "@/components/cs/cs-mark";
import { CSButton } from "@/components/cs/cs-button";
import { CSBadge } from "@/components/cs/cs-badge";
import { useSession } from "@/lib/use-session";
import { useIsAdmin } from "@/lib/use-admin";
import type { TopicSource } from "@/lib/database.types";

type Bias = TopicSource["bias_label"];
const BIAS_OPTIONS: Bias[] = ["Left", "Lean Left", "Center", "Lean Right", "Right"];

const emptySource = (bias: Bias): TopicSource => ({
  outlet: "",
  title: "",
  url: "",
  bias_label: bias,
  excerpt: "",
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="font-mono"
      style={{
        fontSize: 11,
        color: CS.mute,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </label>
  );
}

function fieldStyle() {
  return {
    padding: "12px 14px",
    borderRadius: 10,
    border: `1px solid ${CS.rule2}`,
    background: CS.paper,
    color: CS.ink,
    fontSize: 14,
    lineHeight: 1.5,
    width: "100%",
    outline: "none",
    fontFamily: "inherit",
  } as const;
}

function SourceFields({
  label,
  rows,
  onChange,
  defaultBias,
}: {
  label: string;
  rows: TopicSource[];
  onChange: (rows: TopicSource[]) => void;
  defaultBias: Bias;
}) {
  function update(i: number, patch: Partial<TopicSource>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...rows, emptySource(defaultBias)]);
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          onClick={add}
          className="font-mono"
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: "transparent",
            border: `1px solid ${CS.rule2}`,
            color: CS.ink,
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          + Add source
        </button>
      </div>
      {rows.length === 0 ? (
        <p
          className="font-sans"
          style={{ fontSize: 13, color: CS.mute, margin: 0 }}
        >
          No sources yet. Add at least 2 for each side.
        </p>
      ) : null}
      {rows.map((s, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 px-4 py-4"
          style={{
            borderRadius: 12,
            border: `1px solid ${CS.rule}`,
            background: CS.paper2,
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">
            <input
              type="text"
              placeholder="Outlet (e.g. Reuters)"
              value={s.outlet}
              onChange={(e) => update(i, { outlet: e.target.value })}
              style={fieldStyle()}
            />
            <select
              value={s.bias_label}
              onChange={(e) =>
                update(i, { bias_label: e.target.value as Bias })
              }
              style={fieldStyle()}
            >
              {BIAS_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Article title"
            value={s.title}
            onChange={(e) => update(i, { title: e.target.value })}
            style={fieldStyle()}
          />
          <input
            type="url"
            placeholder="https://..."
            value={s.url}
            onChange={(e) => update(i, { url: e.target.value })}
            style={fieldStyle()}
          />
          <textarea
            placeholder="Optional one-sentence excerpt"
            value={s.excerpt ?? ""}
            onChange={(e) => update(i, { excerpt: e.target.value })}
            rows={2}
            style={{ ...fieldStyle(), resize: "vertical" }}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="font-mono self-start"
            style={{
              padding: "4px 0",
              background: "transparent",
              border: "none",
              color: CS.mute,
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Remove source
          </button>
        </div>
      ))}
    </div>
  );
}

export default function NewTopicPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const isAdmin = useIsAdmin(session);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [debateQuestion, setDebateQuestion] = useState("");
  const [background, setBackground] = useState("");
  const [leftSummary, setLeftSummary] = useState("");
  const [rightSummary, setRightSummary] = useState("");
  const [leftSources, setLeftSources] = useState<TopicSource[]>([
    emptySource("Lean Left"),
    emptySource("Left"),
  ]);
  const [rightSources, setRightSources] = useState<TopicSource[]>([
    emptySource("Lean Right"),
    emptySource("Right"),
  ]);
  const [centerSources, setCenterSources] = useState<TopicSource[]>([
    emptySource("Center"),
  ]);
  const [tags, setTags] = useState("");
  const [primaryAxis, setPrimaryAxis] = useState<"e" | "s" | "g" | "none">(
    "none",
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/signup");
      return;
    }
    if (isAdmin === false) {
      router.replace("/lounge");
    }
  }, [loading, session, isAdmin, router]);

  useEffect(() => {
    if (!slugManuallyEdited) setSlug(slugify(title));
  }, [title, slugManuallyEdited]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!session) return;
    setSubmitting(true);
    try {
      const accessToken = session.access_token;
      const cleanSources = (rows: TopicSource[]) =>
        rows.filter(
          (r) => r.outlet.trim() && r.title.trim() && r.url.trim(),
        );
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          slug,
          title,
          debate_question: debateQuestion,
          background,
          left_summary: leftSummary,
          right_summary: rightSummary,
          left_sources: cleanSources(leftSources),
          right_sources: cleanSources(rightSources),
          center_sources: cleanSources(centerSources),
          tags: tagList,
          primary_axis: primaryAxis,
          status: "published",
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? `HTTP ${res.status}`);
      }
      router.push(`/topics/${slug}`);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't publish the topic. Check the console.",
      );
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (!session) return null;
  if (!isAdmin) return null;

  return (
    <main className="min-h-screen" style={{ background: CS.paper }}>
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
        <Link href="/topics">
          <CSButton size="sm" variant="ghost">
            View all topics →
          </CSButton>
        </Link>
      </div>

      <section className="mx-auto w-full max-w-[760px] px-6 pb-24 pt-6 md:px-10">
        <CSBadge dot>Admin · New topic</CSBadge>
        <h1
          className="font-sans"
          style={{
            margin: "20px 0 30px",
            fontWeight: 500,
            fontSize: "clamp(30px, 4vw, 42px)",
            lineHeight: 1.05,
            letterSpacing: "-0.035em",
            color: CS.ink,
          }}
        >
          Publish a topic.
        </h1>

        <form onSubmit={onSubmit} className="flex flex-col gap-7">
          <div className="flex flex-col gap-2">
            <Label>Title</Label>
            <input
              type="text"
              required
              placeholder="e.g. U.S. Launches Airstrikes on Iran-Backed Militia Targets"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={fieldStyle()}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Slug</Label>
            <input
              type="text"
              required
              placeholder="auto-generated from title"
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setSlugManuallyEdited(true);
              }}
              style={fieldStyle()}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                color: CS.mute,
                letterSpacing: "0.05em",
              }}
            >
              commonsquare.app/topics/{slug || "your-slug-here"}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Debate question</Label>
            <input
              type="text"
              required
              placeholder="e.g. Should the U.S. have launched airstrikes on Iran-backed targets?"
              value={debateQuestion}
              onChange={(e) => setDebateQuestion(e.target.value)}
              style={fieldStyle()}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Background (neutral, 3–4 paragraphs)</Label>
            <textarea
              required
              rows={6}
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              style={{ ...fieldStyle(), resize: "vertical" }}
            />
          </div>

          <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Left-leaning summary</Label>
              <textarea
                required
                rows={6}
                value={leftSummary}
                onChange={(e) => setLeftSummary(e.target.value)}
                style={{ ...fieldStyle(), resize: "vertical" }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Right-leaning summary</Label>
              <textarea
                required
                rows={6}
                value={rightSummary}
                onChange={(e) => setRightSummary(e.target.value)}
                style={{ ...fieldStyle(), resize: "vertical" }}
              />
            </div>
          </div>

          <SourceFields
            label="Left sources"
            rows={leftSources}
            onChange={setLeftSources}
            defaultBias="Lean Left"
          />
          <SourceFields
            label="Right sources"
            rows={rightSources}
            onChange={setRightSources}
            defaultBias="Lean Right"
          />
          <SourceFields
            label="Center sources (optional)"
            rows={centerSources}
            onChange={setCenterSources}
            defaultBias="Center"
          />

          <div className="grid grid-cols-1 gap-7 md:grid-cols-[1fr_220px]">
            <div className="flex flex-col gap-2">
              <Label>Tags (comma-separated)</Label>
              <input
                type="text"
                placeholder="foreign policy, military, Iran"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                style={fieldStyle()}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Primary axis</Label>
              <select
                value={primaryAxis}
                onChange={(e) =>
                  setPrimaryAxis(e.target.value as typeof primaryAxis)
                }
                style={fieldStyle()}
              >
                <option value="none">None</option>
                <option value="e">Economic</option>
                <option value="s">Social</option>
                <option value="g">Governance</option>
              </select>
            </div>
          </div>

          {error ? (
            <p
              className="font-sans"
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.55,
                color: CS.ink,
                background: "rgba(26,24,20,0.06)",
                padding: "12px 14px",
                borderRadius: 10,
              }}
            >
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-4">
            <CSButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={submitting}
            >
              {submitting ? "Publishing…" : "Publish topic →"}
            </CSButton>
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                color: CS.mute,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Publishes immediately to /topics/{slug || "…"}
            </span>
          </div>
        </form>
      </section>
    </main>
  );
}
