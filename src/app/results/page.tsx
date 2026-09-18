"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CS } from "@/lib/cs";
import { CSBadge } from "@/components/cs/cs-badge";
import { CSButton } from "@/components/cs/cs-button";
import { CSCompass } from "@/components/cs/cs-compass";
import { BadgeCard } from "@/components/badges/badge-card";
import { OnboardingTopRow } from "@/components/onboarding/top-row";
import { useOnboardingState } from "@/lib/onboarding-state";
import { useSession } from "@/lib/use-session";
import { scoreAnswers, pickArchetype } from "@/lib/quiz";
import { fetchMyProfile, insertProfile } from "@/lib/profile";

type AxisRow = {
  label: string;
  eyebrow: string;
  low: string;
  high: string;
  value: number; // 0..100
};

function AxisBar({ row, tint }: { row: AxisRow; tint: string }) {
  const pct = Math.max(2, Math.min(98, row.value));
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            color: CS.mute,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {row.eyebrow}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 13,
            color: CS.ink,
            letterSpacing: "0.04em",
          }}
        >
          {row.value}
        </span>
      </div>
      <div
        className="relative h-[6px] w-full"
        style={{ background: CS.rule, borderRadius: 999 }}
      >
        <div
          style={{
            position: "absolute",
            top: -3,
            left: `calc(${pct}% - 6px)`,
            width: 12,
            height: 12,
            borderRadius: 999,
            background: tint,
            boxShadow: `0 0 0 3px ${tint}33`,
          }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span
          className="font-sans"
          style={{ fontSize: 12, color: CS.mute, letterSpacing: "-0.005em" }}
        >
          {row.low}
        </span>
        <span
          className="font-sans"
          style={{ fontSize: 12, color: CS.mute, letterSpacing: "-0.005em" }}
        >
          {row.high}
        </span>
      </div>
    </div>
  );
}

function PrivacyToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-3 transition-opacity hover:opacity-90"
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "relative",
          width: 32,
          height: 20,
          borderRadius: 999,
          background: on ? CS.violet : CS.rule2,
          transition: "background 0.18s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: on ? 14 : 2,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: CS.paper,
            transition: "left 0.18s ease",
          }}
        />
      </span>
      <span
        className="font-sans text-left"
        style={{
          fontSize: 13,
          color: CS.ink,
          letterSpacing: "-0.005em",
          lineHeight: 1.35,
        }}
      >
        Show my archetype on my profile
        <span
          className="block font-mono"
          style={{
            fontSize: 10,
            color: CS.mute,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          Your answers stay private either way.
        </span>
      </span>
    </button>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const { state, setState, hydrated } = useOnboardingState();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quiz-first flow: anyone can land on /results as long as they have a
  // complete answer set in localStorage. If not, send them back to /quiz.
  useEffect(() => {
    if (!hydrated) return;
    if (state.answers.some((a) => a == null)) router.replace("/quiz");
  }, [hydrated, state.answers, router]);

  const axes = useMemo(() => scoreAnswers(state.answers), [state.answers]);
  const archetype = useMemo(() => pickArchetype(axes), [axes]);

  const [showOnProfile, setShowOnProfile] = useState(state.showOnProfile);
  useEffect(() => {
    setShowOnProfile(state.showOnProfile);
  }, [state.showOnProfile]);

  function togglePrivacy(v: boolean) {
    setShowOnProfile(v);
    setState({ ...state, showOnProfile: v });
  }

  async function continueFunnel() {
    // Persist privacy choice into localStorage so the next step picks it up.
    setState({ ...state, showOnProfile });

    // Anonymous: head to signup. Quiz answers stay in localStorage and get
    // converted into a profile row after the user claims a handle.
    if (!session?.user) {
      router.push("/signup");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      // Authenticated path forks on whether a profile already exists:
      //   - exists  → retake. Upsert with the existing handle, head to lounge.
      //   - missing → fresh user who happened to be logged in. Go claim handle.
      const existing = await fetchMyProfile(session.user.id);
      if (existing) {
        await insertProfile({
          userId: session.user.id,
          handle: existing.handle,
          axisE: axes.e,
          axisS: axes.s,
          axisG: axes.g,
          archetypeId: archetype.id,
          showOnProfile,
        });
        setState({ ...state, handle: existing.handle, step: "locked" });
        router.push("/lounge");
      } else {
        router.push("/username");
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't save your profile. Try again in a moment.",
      );
      setSubmitting(false);
    }
  }

  if (loading || !hydrated) return null;

  const ctaLabel = submitting
    ? "Saving…"
    : !session
      ? "Save my archetype →"
      : "Continue →";

  const rows: AxisRow[] = [
    {
      label: "e",
      eyebrow: "Economic",
      low: "Community Investment",
      high: "Free Market",
      value: axes.e,
    },
    {
      label: "s",
      eyebrow: "Social",
      low: "Traditional Values",
      high: "Progressive Values",
      value: axes.s,
    },
    {
      label: "g",
      eyebrow: "Governance",
      low: "Institutional Trust",
      high: "Individual Liberty",
      value: axes.g,
    },
  ];

  return (
    <main className="min-h-screen pb-32 md:pb-0" style={{ background: CS.paper }}>
      <OnboardingTopRow step="Your compass" backHref="/quiz" />

      <section className="mx-auto w-full max-w-[1080px] px-6 pt-10 md:px-10 md:pt-14">
        <CSBadge dot>Your compass · just for you</CSBadge>
        <p
          className="font-mono mt-6"
          style={{
            fontSize: 11,
            color: CS.mute,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {state.handle ? `@${state.handle}, ` : ""}you came out as a
        </p>
        <h1
          className="font-sans"
          style={{
            margin: "8px 0 18px",
            fontWeight: 500,
            fontSize: "clamp(32px, 6vw, 64px)",
            lineHeight: 1.0,
            letterSpacing: "-0.045em",
            color: archetype.tint,
          }}
        >
          {archetype.n}.
        </h1>
        <p
          className="font-sans"
          style={{
            margin: "0 0 8px",
            maxWidth: 640,
            fontSize: 17,
            lineHeight: 1.55,
            color: CS.ink,
            letterSpacing: "-0.005em",
          }}
        >
          {archetype.desc}
        </p>
        <p
          className="font-mono"
          style={{
            margin: "0 0 36px",
            fontSize: 11,
            color: CS.mute,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          ≈ {archetype.pct} of users land here
        </p>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-14">
          <div className="hidden md:block">
            <CSCompass
              size={340}
              x={axes.e / 100}
              y={axes.s / 100}
              accent={archetype.tint}
              showArchetype={false}
            />
          </div>

          <div className="flex items-center justify-center">
            <div className="hidden md:block">
              <BadgeCard arch={archetype} size="lg" />
            </div>
            <div className="block md:hidden">
              <BadgeCard arch={archetype} size="sm" />
            </div>
          </div>

          <div className="flex flex-col gap-7">
            {rows.map((r) => (
              <AxisBar key={r.label} row={r} tint={archetype.tint} />
            ))}
          </div>

          <div className="block md:hidden">
            <CSCompass
              size={300}
              x={axes.e / 100}
              y={axes.s / 100}
              accent={archetype.tint}
              showArchetype={false}
            />
          </div>
        </div>
      </section>

      {/* Footer band — desktop */}
      <section
        className="mt-16 hidden flex-col gap-4 px-10 py-7 md:flex"
        style={{
          borderTop: `1px solid ${CS.rule}`,
          background: CS.paper2,
        }}
      >
        <div className="flex items-center justify-between gap-8">
          <PrivacyToggle on={showOnProfile} onChange={togglePrivacy} />
          <CSButton
            variant="primary"
            size="lg"
            onClick={continueFunnel}
            disabled={submitting}
          >
            {ctaLabel}
          </CSButton>
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
              padding: "10px 12px",
              borderRadius: 10,
            }}
          >
            {error}
          </p>
        ) : null}
      </section>

      {/* Footer band — mobile sticky */}
      <div
        className="fixed bottom-0 left-0 right-0 flex flex-col gap-3 px-6 py-4 md:hidden"
        style={{ background: CS.paper, borderTop: `1px solid ${CS.rule2}` }}
      >
        <PrivacyToggle on={showOnProfile} onChange={togglePrivacy} />
        <CSButton
          variant="primary"
          size="lg"
          onClick={continueFunnel}
          disabled={submitting}
        >
          {ctaLabel}
        </CSButton>
        {error ? (
          <p
            className="font-sans"
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.45,
              color: CS.ink,
              background: "rgba(26,24,20,0.06)",
              padding: "8px 12px",
              borderRadius: 10,
            }}
          >
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
