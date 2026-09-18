"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CS } from "@/lib/cs";
import { CSButton } from "@/components/cs/cs-button";
import { CSBadge } from "@/components/cs/cs-badge";
import {
  DebateCard,
  DebatesNav,
  MONO_LABEL,
} from "@/components/debates/debate-ui";
import {
  acceptChallenge,
  cancelChallenge,
  debateErrorMessage,
  declineChallenge,
  fetchDebates,
} from "@/lib/debates";
import { useSession } from "@/lib/use-session";
import type { DebateWithDebaters } from "@/lib/database.types";

function Section({
  title,
  count,
  hint,
  empty,
  children,
}: {
  title: string;
  count: number;
  hint: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-14">
      <div className="mb-2 flex items-baseline gap-3">
        <h2
          className="font-sans"
          style={{
            margin: 0,
            fontWeight: 500,
            fontSize: "clamp(22px, 3vw, 28px)",
            letterSpacing: "-0.025em",
            color: CS.ink,
          }}
        >
          {title}
        </h2>
        {count > 0 ? (
          <span className="font-mono" style={MONO_LABEL}>
            {count}
          </span>
        ) : null}
      </div>
      <p
        className="font-sans"
        style={{
          margin: "0 0 20px",
          maxWidth: 600,
          fontSize: 14,
          lineHeight: 1.55,
          color: CS.mute,
        }}
      >
        {hint}
      </p>
      {count === 0 ? (
        <div
          className="font-sans px-6 py-8"
          style={{
            border: `1px dashed ${CS.rule2}`,
            borderRadius: 14,
            fontSize: 14,
            color: CS.ink,
          }}
        >
          {empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
      )}
    </section>
  );
}

export default function DebatesPage() {
  const router = useRouter();
  const { session, loading: loadingSession } = useSession();
  const uid = session?.user?.id ?? null;
  const [pub, setPub] = useState<DebateWithDebaters[] | null>(null);
  const [mine, setMine] = useState<DebateWithDebaters[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // The public list is fetched per viewer too: the database orders open
  // challenges by how far the challenger sits from *this* viewer.
  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([
        fetchDebates("public"),
        uid ? fetchDebates("mine") : Promise.resolve([]),
      ]);
      setPub(p);
      setMine(m);
    } catch (err) {
      console.error(err);
      setError(debateErrorMessage(err, "Couldn't load debates."));
    }
  }, [uid]);

  useEffect(() => {
    if (!loadingSession) load();
  }, [loadingSession, load]);

  async function act(
    id: string,
    action: (debateId: string) => Promise<void>,
    thenOpen = false,
  ) {
    if (!uid) {
      router.push("/quiz");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await action(id);
      if (thenOpen) {
        router.push(`/debates/${id}`);
        return;
      }
    } catch (err) {
      console.error(err);
      setError(debateErrorMessage(err, "That didn't work. Try again."));
    } finally {
      setBusyId(null);
    }
    await load();
  }

  const isMyTurn = (d: DebateWithDebaters) =>
    d.status === "active" && d.turn_user_id === uid;

  const incoming = mine.filter(
    (d) => d.status === "queued" && d.challenged_user_id === uid,
  );
  const outgoing = mine.filter(
    (d) =>
      d.debater_a_user_id === uid &&
      (d.status === "queued" || d.status === "declined"),
  );
  // Your turn first; the fetch order (latest activity) breaks ties.
  const yours = mine
    .filter((d) => ["active", "complete", "forfeit"].includes(d.status))
    .sort((a, b) => Number(isMyTurn(b)) - Number(isMyTurn(a)));
  const openChallenges = (pub ?? []).filter(
    (d) => d.status === "queued" && d.debater_a_user_id !== uid,
  );
  const live = (pub ?? []).filter((d) => d.status !== "queued");

  return (
    <main className="min-h-screen" style={{ background: CS.paper }}>
      <DebatesNav />

      <div className="mx-auto w-full max-w-[1080px] px-6 pb-24 pt-6 md:px-10">
        <CSBadge dot>The square · debates</CSBadge>
        <h1
          className="font-sans text-balance"
          style={{
            margin: "20px 0 14px",
            fontWeight: 500,
            fontSize: "clamp(36px, 5.6vw, 64px)",
            lineHeight: 1.02,
            letterSpacing: "-0.045em",
            color: CS.ink,
          }}
        >
          Two people. Three rounds.{" "}
          <span style={{ color: CS.violet }}>One question.</span>
        </h1>
        <p
          className="font-sans"
          style={{
            margin: "0 0 28px",
            maxWidth: 640,
            fontSize: 17,
            lineHeight: 1.55,
            color: CS.mute,
          }}
        >
          Opening, rebuttal, closing — 12 hours per turn. Nobody is declared
          the winner yet: both debaters earn XP for finishing.
        </p>
        <Link href="/debates/new">
          <CSButton variant="primary" size="lg">
            Start a debate →
          </CSButton>
        </Link>

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

        {pub === null && !error ? (
          <p className="font-mono mt-14" style={MONO_LABEL}>
            Loading debates…
          </p>
        ) : null}

        {uid && pub !== null ? (
          <>
            <Section
              title="Incoming challenges"
              count={incoming.length}
              hint="Someone called you out by handle. Accept, or decline — there is no penalty and nobody else ever sees it."
              empty="No one has challenged you directly."
            >
              {incoming.map((d) => (
                <DebateCard key={d.id} debate={d} viewerId={uid}>
                  <CSButton
                    size="sm"
                    variant="primary"
                    disabled={busyId === d.id}
                    onClick={() => act(d.id, acceptChallenge, true)}
                  >
                    Accept
                  </CSButton>
                  <CSButton
                    size="sm"
                    variant="ghost"
                    disabled={busyId === d.id}
                    onClick={() => act(d.id, declineChallenge)}
                  >
                    Decline
                  </CSButton>
                </DebateCard>
              ))}
            </Section>

            <Section
              title="Your debates"
              count={yours.length}
              hint="Open and private. Debates waiting on you come first — miss a 12-hour deadline and the debate is forfeit."
              empty="You haven't debated yet. Start one, or take an open challenge below."
            >
              {yours.map((d) => (
                <DebateCard key={d.id} debate={d} viewerId={uid}>
                  {isMyTurn(d) ? (
                    <Link href={`/debates/${d.id}`}>
                      <CSButton size="sm" variant="primary">
                        Write your round →
                      </CSButton>
                    </Link>
                  ) : null}
                </DebateCard>
              ))}
            </Section>

            <Section
              title="Outgoing challenges"
              count={outgoing.length}
              hint="Challenges you've issued that nobody has picked up yet."
              empty="Nothing waiting on an answer."
            >
              {outgoing.map((d) => (
                <DebateCard key={d.id} debate={d} viewerId={uid}>
                  {d.status === "queued" ? (
                    <CSButton
                      size="sm"
                      variant="ghost"
                      disabled={busyId === d.id}
                      onClick={() => act(d.id, cancelChallenge)}
                    >
                      Cancel challenge
                    </CSButton>
                  ) : null}
                </DebateCard>
              ))}
            </Section>
          </>
        ) : null}

        {pub !== null ? (
          <>
            <Section
              title="Open challenges"
              count={openChallenges.length}
              hint={
                uid
                  ? "Waiting for an opponent. Challengers furthest from you on the topic's axis come first — a debate should be a disagreement."
                  : "Waiting for an opponent. First to accept gets the debate — you argue the other side."
              }
              empty="No open challenges right now. Issue one."
            >
              {openChallenges.map((d) => (
                <DebateCard key={d.id} debate={d} viewerId={uid}>
                  <CSButton
                    size="sm"
                    variant="primary"
                    disabled={busyId === d.id || loadingSession}
                    onClick={() => act(d.id, acceptChallenge, true)}
                  >
                    {uid
                      ? `Accept · argue ${d.debater_b_stance === "yes" ? "Yes" : "No"}`
                      : "Take the Compass to accept →"}
                  </CSButton>
                </DebateCard>
              ))}
            </Section>

            <Section
              title="Live & recent debates"
              count={live.length}
              hint="Open debates, in progress and finished. Anyone can read along."
              empty="No public debates yet. Be the first."
            >
              {live.map((d) => (
                <DebateCard key={d.id} debate={d} viewerId={uid} />
              ))}
            </Section>
          </>
        ) : null}
      </div>
    </main>
  );
}
