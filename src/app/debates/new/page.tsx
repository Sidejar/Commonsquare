"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CS } from "@/lib/cs";
import { CSButton } from "@/components/cs/cs-button";
import { CSBadge } from "@/components/cs/cs-badge";
import { DebatesNav, MONO_LABEL } from "@/components/debates/debate-ui";
import {
  PROMPT_MAX,
  PROMPT_MIN,
  createChallenge,
  debateErrorMessage,
} from "@/lib/debates";
import { fetchMyProfile } from "@/lib/profile";
import { fetchRecentTopics, fetchTopicBySlug, type Stance } from "@/lib/topics";
import { useSession } from "@/lib/use-session";
import type { TopicRow } from "@/lib/database.types";

const FIELD_STYLE = {
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${CS.rule2}`,
  background: CS.paper,
  color: CS.ink,
  fontSize: 15,
  lineHeight: 1.5,
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
} as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono" style={MONO_LABEL}>
        {label}
      </span>
      {children}
    </div>
  );
}

// Pill radio group. Every option looks the same until picked, so neither
// stance (nor any other choice) gets a visual nudge.
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className="font-sans"
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: `1px solid ${on ? CS.ink : CS.rule2}`,
              background: on ? CS.ink : "transparent",
              color: on ? CS.paper : CS.ink,
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function NewDebatePage() {
  const router = useRouter();
  const { session, loading: loadingSession } = useSession();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [topics, setTopics] = useState<TopicRow[]>([]);

  const [source, setSource] = useState<"topic" | "custom">("topic");
  const [topicId, setTopicId] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [stance, setStance] = useState<Stance | null>(null);
  const [opponent, setOpponent] = useState<"anyone" | "specific">("anyone");
  const [handle, setHandle] = useState("");
  const [visibility, setVisibility] = useState<"open" | "closed">("open");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Topic picker options; `?topic=<slug>` preselects (and is fetched on its
  // own when it is older than the recent list). The slug is read off the URL
  // here rather than from the `searchParams` prop: this page is prerendered,
  // so that prop is always empty in production.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const recent = await fetchRecentTopics(60);
      const slug = new URLSearchParams(window.location.search).get("topic");
      let picked = slug ? recent.find((t) => t.slug === slug) : undefined;
      if (slug && !picked) picked = (await fetchTopicBySlug(slug)) ?? undefined;
      if (cancelled) return;
      setTopics(
        picked && !recent.includes(picked) ? [picked, ...recent] : recent,
      );
      if (picked) setTopicId(picked.id);
      else if (recent.length === 0) setSource("custom");
    })().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setHasProfile(null);
      return;
    }
    let cancelled = false;
    fetchMyProfile(session.user.id)
      .then((p) => {
        if (!cancelled) setHasProfile(Boolean(p));
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [session]);

  const topic = topics.find((t) => t.id === topicId) ?? null;
  const prompt = customPrompt.trim();
  const ready =
    stance !== null &&
    (source === "topic"
      ? Boolean(topic)
      : prompt.length >= PROMPT_MIN && prompt.length <= PROMPT_MAX) &&
    (opponent === "anyone" || handle.trim().replace(/^@/, "").length >= 3);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || !stance) return;
    setSubmitting(true);
    setError(null);
    try {
      const id = await createChallenge({
        stance,
        topicId: source === "topic" ? topicId : null,
        customPrompt: source === "custom" ? prompt : null,
        opponentHandle: opponent === "specific" ? handle : null,
        visibility,
      });
      router.push(`/debates/${id}`);
    } catch (err) {
      console.error(err);
      setError(debateErrorMessage(err, "Couldn't issue the challenge."));
      setSubmitting(false);
    }
  }

  const needsCompass =
    !loadingSession && (!session?.user || hasProfile === false);

  return (
    <main className="min-h-screen" style={{ background: CS.paper }}>
      <DebatesNav />

      <div className="mx-auto w-full max-w-[720px] px-6 pb-24 pt-6 md:px-10">
        <CSBadge dot>Issue a challenge</CSBadge>
        <h1
          className="font-sans text-balance"
          style={{
            margin: "20px 0 14px",
            fontWeight: 500,
            fontSize: "clamp(32px, 5vw, 52px)",
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            color: CS.ink,
          }}
        >
          Pick a question. <span style={{ color: CS.violet }}>Pick a side.</span>
        </h1>
        <p
          className="font-sans"
          style={{
            margin: "0 0 36px",
            maxWidth: 600,
            fontSize: 16,
            lineHeight: 1.55,
            color: CS.mute,
          }}
        >
          Three rounds each — opening, rebuttal, closing — with 12 hours per
          turn. You open. Your opponent argues the other side.
        </p>

        {needsCompass ? (
          <div
            className="flex flex-col gap-4 px-6 py-7"
            style={{
              background: CS.paper2,
              border: `1px solid ${CS.rule}`,
              borderRadius: 18,
            }}
          >
            <p
              className="font-sans"
              style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: CS.ink }}
            >
              Debaters are identified by handle and archetype, so you need
              both before you can step in. Two minutes.
            </p>
            <div>
              <Link href="/quiz">
                <CSButton variant="primary" size="md">
                  Take the Compass →
                </CSButton>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-9">
            <Field label="What topic?">
              <Choice
                label="Topic source"
                value={source}
                onChange={setSource}
                options={[
                  { value: "topic", label: "An existing topic" },
                  { value: "custom", label: "My own prompt" },
                ]}
              />
              {source === "topic" ? (
                <>
                  <select
                    aria-label="Topic"
                    value={topicId}
                    onChange={(e) => setTopicId(e.target.value)}
                    className="font-sans"
                    style={FIELD_STYLE}
                  >
                    <option value="">Choose a topic…</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                  {topic ? (
                    <p
                      className="font-sans"
                      style={{
                        margin: 0,
                        fontSize: 18,
                        fontWeight: 500,
                        lineHeight: 1.3,
                        letterSpacing: "-0.02em",
                        color: CS.ink,
                      }}
                    >
                      {topic.debate_question}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <textarea
                    aria-label="Custom prompt"
                    value={customPrompt}
                    onChange={(e) =>
                      setCustomPrompt(e.target.value.slice(0, PROMPT_MAX))
                    }
                    rows={2}
                    placeholder="A yes/no question — e.g. Should cities ban cars downtown?"
                    className="font-sans"
                    style={{ ...FIELD_STYLE, resize: "vertical" }}
                  />
                  <span
                    className="font-mono"
                    style={{ ...MONO_LABEL, fontSize: 10, letterSpacing: "0.08em" }}
                  >
                    {customPrompt.length}/{PROMPT_MAX} · at least {PROMPT_MIN}
                  </span>
                </>
              )}
            </Field>

            <Field label="What's your stance?">
              <Choice
                label="Your stance"
                value={stance}
                onChange={setStance}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
              />
            </Field>

            <Field label="Who?">
              <Choice
                label="Opponent"
                value={opponent}
                onChange={setOpponent}
                options={[
                  { value: "anyone", label: "Anyone" },
                  { value: "specific", label: "Challenge @…" },
                ]}
              />
              {opponent === "specific" ? (
                <input
                  aria-label="Opponent handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.slice(0, 19))}
                  placeholder="@handle"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="font-sans"
                  style={{ ...FIELD_STYLE, maxWidth: 320 }}
                />
              ) : null}
              <Hint>
                {opponent === "anyone"
                  ? "Goes into the open challenges list. First to accept gets the debate — people furthest from you on the spectrum see it first."
                  : "Only they see it, in their inbox. They can decline with no penalty. You can send 5 direct challenges a day."}
              </Hint>
            </Field>

            <Field label="Audience?">
              <Choice
                label="Audience"
                value={visibility}
                onChange={setVisibility}
                options={[
                  { value: "open", label: "Yes, open" },
                  { value: "closed", label: "No, private" },
                ]}
              />
              <Hint>
                {visibility === "open"
                  ? "Anyone can read the debate, during and after."
                  : "Only the two of you can ever read it."}
              </Hint>
            </Field>

            {error ? (
              <p
                className="font-sans"
                role="alert"
                style={{
                  margin: 0,
                  fontSize: 14,
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

            <div>
              <CSButton
                type="submit"
                variant="primary"
                size="lg"
                disabled={!ready || submitting || loadingSession}
              >
                {submitting
                  ? "Issuing…"
                  : opponent === "anyone"
                    ? "Find debate →"
                    : "Send challenge →"}
              </CSButton>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <p
      className="font-sans"
      style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: CS.mute }}
    >
      {children}
    </p>
  );
}
