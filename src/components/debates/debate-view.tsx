"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CS } from "@/lib/cs";
import { CSButton } from "@/components/cs/cs-button";
import {
  Debater,
  MONO_LABEL,
  ROUND_NAMES,
  StatusTag,
  timeLeft,
  turnHandle,
} from "@/components/debates/debate-ui";
import {
  ROUND_MAX,
  acceptChallenge,
  cancelChallenge,
  debateErrorMessage,
  declineChallenge,
  fetchDebate,
  fetchRounds,
  submitRound,
} from "@/lib/debates";
import { useSession } from "@/lib/use-session";
import type { DebateWithDebaters, RoundRow } from "@/lib/database.types";

interface Props {
  debateId: string;
  // What the server could see as anon. Null for closed debates and direct
  // challenges — those load here, once the viewer's session is known.
  initialDebate: DebateWithDebaters | null;
  initialRounds: RoundRow[];
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div
      className="font-sans mt-10 px-6 py-5"
      style={{
        background: CS.paper2,
        border: `1px solid ${CS.rule}`,
        borderRadius: 14,
        fontSize: 15,
        lineHeight: 1.55,
        color: CS.ink,
      }}
    >
      {children}
    </div>
  );
}

export function DebateView({ debateId, initialDebate, initialRounds }: Props) {
  const router = useRouter();
  const { session, loading: loadingSession } = useSession();
  const uid = session?.user?.id ?? null;
  const [debate, setDebate] = useState(initialDebate);
  const [rounds, setRounds] = useState(initialRounds);
  const [loaded, setLoaded] = useState(initialDebate !== null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await fetchDebate(debateId);
      setDebate(d);
      setRounds(d ? await fetchRounds(debateId) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoaded(true);
    }
  }, [debateId]);

  // Re-read as the viewer: a party sees things anon cannot (a closed debate,
  // a direct challenge, a private opponent's handle).
  useEffect(() => {
    if (loadingSession) return;
    if (uid || !initialDebate) refresh();
  }, [loadingSession, uid, initialDebate, refresh]);

  async function act(action: () => Promise<void>) {
    if (!uid) {
      router.push("/quiz");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      console.error(err);
      setError(debateErrorMessage(err, "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
    await refresh();
  }

  async function onSubmitRound() {
    const content = draft.trim();
    if (!content) return;
    await act(async () => {
      await submitRound(debateId, content);
      setDraft("");
    });
  }

  if (!debate) {
    return (
      <div className="mx-auto w-full max-w-[920px] px-6 pb-24 pt-16 md:px-10">
        <p className="font-mono" style={MONO_LABEL}>
          {loaded ? "Nothing to see here" : "Loading debate…"}
        </p>
        {loaded ? (
          <>
            <p
              className="font-sans"
              style={{
                margin: "14px 0 24px",
                maxWidth: 520,
                fontSize: 16,
                lineHeight: 1.55,
                color: CS.ink,
              }}
            >
              This debate doesn&rsquo;t exist, or it&rsquo;s private. Private
              debates and direct challenges are only visible to the two people
              in them{uid ? "." : " — sign in if that's you."}
            </p>
            <Link href="/debates">
              <CSButton variant="ghost" size="md">
                ← All debates
              </CSButton>
            </Link>
          </>
        ) : null}
      </div>
    );
  }

  const d = debate;
  // `!!uid &&`: signed out, uid is null — and so is challenged_user_id on every
  // 'anyone' challenge, so a bare === would make each visitor "the challenged".
  const isA = !!uid && uid === d.debater_a_user_id;
  const isChallenged =
    !!uid && d.status === "queued" && uid === d.challenged_user_id;
  const canClaim =
    d.status === "queued" && d.opponent_selection === "anyone" && !isA;
  const myTurn = d.status === "active" && !!uid && d.turn_user_id === uid;
  const sides = [
    {
      userId: d.debater_a_user_id,
      handle: d.a_handle,
      archetypeId: d.a_archetype_id,
      stance: d.debater_a_stance,
      seed: `${d.id}a`,
    },
    {
      userId: d.debater_b_user_id,
      handle: d.b_handle,
      archetypeId: d.b_archetype_id,
      stance: d.debater_b_stance,
      seed: `${d.id}b`,
    },
  ];

  return (
    <article className="mx-auto w-full max-w-[920px] px-6 pb-24 pt-8 md:px-10">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusTag debate={d} />
        <span className="font-mono" style={MONO_LABEL}>
          {d.visibility === "closed" ? "Private" : "Open to read"}
        </span>
        {d.topic_slug ? (
          <Link
            href={`/topics/${d.topic_slug}`}
            className="font-mono"
            style={{ ...MONO_LABEL, color: CS.violetD }}
          >
            Topic · {d.topic_title} →
          </Link>
        ) : null}
      </div>

      <h1
        className="font-sans text-balance"
        style={{
          margin: 0,
          fontWeight: 500,
          fontSize: "clamp(28px, 4.4vw, 48px)",
          lineHeight: 1.08,
          letterSpacing: "-0.035em",
          color: CS.ink,
        }}
      >
        {d.prompt}
      </h1>

      {/* The two debaters */}
      <div
        className="mt-10 grid grid-cols-1 md:grid-cols-2"
        style={{
          border: `1px solid ${CS.rule2}`,
          borderRadius: 18,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {sides.map((s, i) => (
          <div
            key={s.seed}
            className={
              i === 1 ? "border-t p-6 md:border-l md:border-t-0 md:px-8" : "p-6 md:px-8"
            }
            style={{ borderColor: CS.rule }}
          >
            <Debater
              handle={s.handle}
              archetypeId={s.archetypeId}
              stance={s.stance}
              seed={s.seed}
              size="lg"
            />
          </div>
        ))}
      </div>

      {error ? (
        <p
          className="font-sans mt-8"
          role="alert"
          style={{
            fontSize: 14,
            color: CS.ink,
            background: "rgba(26,24,20,0.06)",
            padding: "12px 14px",
            borderRadius: 10,
          }}
        >
          {error}
        </p>
      ) : null}

      {/* Challenge not answered yet */}
      {d.status === "queued" ? (
        <Note>
          <p style={{ margin: "0 0 16px" }}>
            {isA
              ? d.opponent_selection === "anyone"
                ? "Your challenge is in the open list. The debate starts the moment someone accepts — you open, and you'll have 12 hours."
                : `Waiting for @${d.b_handle} to answer. They can decline with no penalty.`
              : isChallenged
                ? `@${d.a_handle} challenged you to argue ${d.debater_b_stance === "yes" ? "Yes" : "No"}. Decline freely — there's no penalty and nobody else sees it.`
                : `@${d.a_handle} is looking for someone to argue ${d.debater_b_stance === "yes" ? "Yes" : "No"}. First to accept gets the debate.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {isChallenged || canClaim ? (
              <CSButton
                variant="primary"
                size="md"
                disabled={busy || loadingSession}
                onClick={() => act(() => acceptChallenge(d.id))}
              >
                {uid
                  ? `Accept · argue ${d.debater_b_stance === "yes" ? "Yes" : "No"}`
                  : "Take the Compass to accept →"}
              </CSButton>
            ) : null}
            {isChallenged ? (
              <CSButton
                variant="ghost"
                size="md"
                disabled={busy}
                onClick={() => act(() => declineChallenge(d.id))}
              >
                Decline
              </CSButton>
            ) : null}
            {isA ? (
              <CSButton
                variant="ghost"
                size="md"
                disabled={busy}
                onClick={() => act(() => cancelChallenge(d.id))}
              >
                Cancel challenge
              </CSButton>
            ) : null}
          </div>
        </Note>
      ) : null}

      {d.status === "declined" || d.status === "cancelled" ? (
        <Note>
          {d.status === "declined"
            ? "This challenge was declined. No penalty, no hard feelings — that's the rule here."
            : "This challenge was cancelled before anyone accepted it."}
        </Note>
      ) : null}

      {/* Transcript */}
      {d.debater_b_user_id ? (
        <section className="mt-14 flex flex-col gap-12">
          {ROUND_NAMES.map((name, i) => {
            const n = i + 1;
            // A turn shows once it is written, or while its author is on the clock.
            const turns = sides
              .map((s) => ({
                s,
                round: rounds.find(
                  (r) => r.round_number === n && r.user_id === s.userId,
                ),
                pending:
                  d.status === "active" &&
                  n === d.current_round &&
                  d.turn_user_id === s.userId,
              }))
              .filter((t) => t.round || t.pending);
            if (turns.length === 0) return null;
            return (
              <div key={name}>
                <div className="font-mono mb-5" style={MONO_LABEL}>
                  <span style={{ color: CS.violet }}>0{n}</span> — {name}
                </div>
                <div className="flex flex-col gap-4">
                  {turns.map(({ s, round, pending }) => (
                    <div
                      key={s.seed}
                      className="px-5 py-5 md:px-6"
                      style={{
                        background: CS.paper,
                        border: `1px ${round ? "solid" : "dashed"} ${round ? CS.rule : CS.rule2}`,
                        borderRadius: 14,
                      }}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <Debater
                          handle={s.handle}
                          archetypeId={s.archetypeId}
                          stance={s.stance}
                          seed={s.seed}
                        />
                        {pending && d.turn_deadline_at ? (
                          <span
                            className="font-mono"
                            suppressHydrationWarning
                            style={{ ...MONO_LABEL, fontSize: 10 }}
                          >
                            Writing · {timeLeft(d.turn_deadline_at)}
                          </span>
                        ) : null}
                      </div>
                      {round ? (
                        <p
                          className="font-sans"
                          style={{
                            margin: 0,
                            fontSize: 16,
                            lineHeight: 1.65,
                            color: CS.ink,
                            letterSpacing: "-0.005em",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {round.content}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {/* Submit box — only for the debater whose turn it is */}
      {myTurn && d.turn_deadline_at ? (
        <section
          className="mt-10 flex flex-col gap-3 px-5 py-5"
          style={{
            background: CS.paper2,
            border: `1px solid ${CS.violet}`,
            borderRadius: 14,
          }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span
              className="font-mono"
              style={{ ...MONO_LABEL, color: CS.violetD, fontWeight: 600 }}
            >
              Your turn · {ROUND_NAMES[d.current_round - 1]}
            </span>
            <span className="font-mono" style={{ ...MONO_LABEL, fontSize: 10 }}>
              Due {formatDeadline(d.turn_deadline_at)} ·{" "}
              {timeLeft(d.turn_deadline_at)}
            </span>
          </div>
          <textarea
            aria-label={`Your ${ROUND_NAMES[d.current_round - 1].toLowerCase()}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, ROUND_MAX))}
            rows={9}
            placeholder={`Make your ${ROUND_NAMES[d.current_round - 1].toLowerCase()} case…`}
            className="font-sans"
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: `1px solid ${CS.rule2}`,
              background: CS.paper,
              color: CS.ink,
              fontSize: 15,
              lineHeight: 1.6,
              resize: "vertical",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <div className="flex items-center justify-between">
            <span
              className="font-mono"
              style={{ fontSize: 10, color: CS.mute, letterSpacing: "0.08em" }}
            >
              {draft.length}/{ROUND_MAX} · can&rsquo;t be edited once submitted
            </span>
            <CSButton
              variant="primary"
              size="md"
              disabled={busy || !draft.trim()}
              onClick={onSubmitRound}
            >
              {busy ? "Submitting…" : "Submit round"}
            </CSButton>
          </div>
        </section>
      ) : null}

      {d.status === "complete" ? (
        <Note>
          <strong style={{ fontWeight: 500 }}>Debate complete.</strong> No
          winner is declared in v1 — both debaters earn XP for finishing.
        </Note>
      ) : null}

      {d.status === "forfeit" ? (
        <Note>
          <strong style={{ fontWeight: 500 }}>Forfeit.</strong> @{turnHandle(d)}{" "}
          missed the 12-hour deadline for round {d.current_round}. A forfeited
          debate earns no XP.
        </Note>
      ) : null}

      <div className="mt-12 flex justify-center">
        <Link href="/debates">
          <CSButton variant="ghost" size="md">
            ← All debates
          </CSButton>
        </Link>
      </div>
    </article>
  );
}
