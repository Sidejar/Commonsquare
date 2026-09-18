"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CS } from "@/lib/cs";
import { CSMark } from "@/components/cs/cs-mark";
import { CSCompass } from "@/components/cs/cs-compass";
import { CSProcAvatar } from "@/components/cs/cs-proc-avatar";
import { CSButton } from "@/components/cs/cs-button";
import { BadgePill } from "@/components/badges/badge-pill";
import { TodayTopicTile } from "@/components/lounge/today-topic-tile";
import { XpTile } from "@/components/lounge/xp-tile";
import { useOnboardingState } from "@/lib/onboarding-state";
import { useSession } from "@/lib/use-session";
import { getSupabase } from "@/lib/supabase";
import {
  fetchMyProfile,
  updateShowOnProfile,
  type ProfileRow,
} from "@/lib/profile";
import { CSArchetypes, type ArchetypeId } from "@/lib/archetypes";

const NAV_ITEMS: Array<{ label: string; active?: boolean; soon?: boolean }> = [
  { label: "The Lounge", active: true },
  { label: "Square", soon: true },
  { label: "Browse", soon: true },
  { label: "Leaderboard", soon: true },
  { label: "Today's Topic", soon: true },
  { label: "My Compass" },
];

function AxisRow({
  eyebrow,
  low,
  high,
  value,
  tint,
}: {
  eyebrow: string;
  low: string;
  high: string;
  value: number;
  tint: string;
}) {
  const pct = Math.max(2, Math.min(98, value));
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            color: CS.mute,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </span>
        <span className="font-mono" style={{ fontSize: 12, color: CS.ink }}>
          {value}
        </span>
      </div>
      <div
        className="relative h-[5px] w-full"
        style={{ background: CS.rule, borderRadius: 999 }}
      >
        <div
          style={{
            position: "absolute",
            top: -2.5,
            left: `calc(${pct}% - 5px)`,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: tint,
            boxShadow: `0 0 0 3px ${tint}33`,
          }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-sans" style={{ fontSize: 11, color: CS.mute }}>
          {low}
        </span>
        <span className="font-sans" style={{ fontSize: 11, color: CS.mute }}>
          {high}
        </span>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="font-mono"
        style={{
          fontSize: 28,
          fontWeight: 500,
          color: CS.ink,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        className="font-mono"
        style={{
          fontSize: 10,
          color: CS.mute,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        className="font-sans"
        style={{ fontSize: 12, color: CS.mute, letterSpacing: "-0.005em" }}
      >
        {caption}
      </span>
    </div>
  );
}

function EmptyDebates({ handle }: { handle: string }) {
  return (
    <div
      className="flex flex-col items-start gap-4 px-6 py-10 md:px-8 md:py-12"
      style={{
        borderRadius: 14,
        background: CS.paper,
        border: `1px dashed ${CS.rule2}`,
      }}
    >
      <span
        className="font-mono"
        style={{
          fontSize: 10,
          color: CS.mute,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Recent debates
      </span>
      <h3
        className="font-sans"
        style={{
          margin: 0,
          fontWeight: 500,
          fontSize: 22,
          letterSpacing: "-0.025em",
          color: CS.ink,
        }}
      >
        The square hasn&rsquo;t opened yet.
      </h3>
      <p
        className="font-sans"
        style={{
          margin: 0,
          maxWidth: 520,
          fontSize: 14,
          lineHeight: 1.55,
          color: CS.mute,
        }}
      >
        When matchmaking goes live, @{handle}&rsquo;s debates will land here
        with the round-by-round transcripts, audience verdicts, and ELO
        deltas. Until then your compass holds your spot.
      </p>
      <div className="flex flex-wrap gap-3">
        {["Watch", "Vote", "Debate"].map((label) => (
          <span
            key={label}
            className="font-mono"
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(26,24,20,0.05)",
              color: CS.mute,
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {label} · coming soon
          </span>
        ))}
      </div>
    </div>
  );
}

export default function LoungePage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const { state, setState, reset } = useOnboardingState();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [tab, setTab] = useState<"Debates" | "Compass" | "Stats">("Debates");
  const [togglingPrivacy, setTogglingPrivacy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/signup");
      return;
    }
    let cancelled = false;
    setProfileError(null);
    setLoadingProfile(true);
    fetchMyProfile(session.user.id)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          router.replace("/results");
          return;
        }
        setProfile(p);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled)
          setProfileError(
            err instanceof Error
              ? err.message
              : "Couldn't load your profile.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, session, router, retryNonce]);

  const archetype = useMemo(() => {
    if (!profile) return null;
    return (
      CSArchetypes.find((a) => a.id === (profile.archetype_id as ArchetypeId)) ??
      CSArchetypes[0]
    );
  }, [profile]);

  async function togglePrivacy() {
    if (!profile || togglingPrivacy) return;
    const next = !profile.show_on_profile;
    setTogglingPrivacy(true);
    setProfile({ ...profile, show_on_profile: next });
    try {
      await updateShowOnProfile(profile.user_id, next);
    } catch (err) {
      console.error(err);
      // Revert on failure.
      setProfile({ ...profile, show_on_profile: !next });
    } finally {
      setTogglingPrivacy(false);
    }
  }

  async function signOut() {
    const sb = getSupabase();
    await sb.auth.signOut();
    reset();
    router.replace("/signup");
  }

  if (loading || (loadingProfile && !profileError)) return null;

  if (profileError) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center px-6"
        style={{ background: CS.paper }}
      >
        <div className="flex flex-col items-center gap-5 text-center">
          <CSMark size={36} />
          <h1
            className="font-sans"
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: "-0.025em",
              color: CS.ink,
            }}
          >
            Lounge is having trouble loading.
          </h1>
          <p
            className="font-sans"
            style={{
              margin: 0,
              maxWidth: 380,
              fontSize: 14,
              lineHeight: 1.55,
              color: CS.mute,
            }}
          >
            {profileError}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <CSButton
              variant="primary"
              size="md"
              onClick={() => setRetryNonce((n) => n + 1)}
            >
              Try again →
            </CSButton>
            <CSButton variant="ghost" size="md" onClick={signOut}>
              Sign out
            </CSButton>
          </div>
        </div>
      </main>
    );
  }

  if (!session || !profile || !archetype) return null;

  return (
    <main className="min-h-screen" style={{ background: CS.paper }}>
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[220px_1fr]">
        {/* SIDEBAR — desktop */}
        <aside
          className="hidden flex-col justify-between px-5 py-7 md:flex"
          style={{
            background: CS.paper,
            borderRight: `1px solid ${CS.rule}`,
          }}
        >
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <CSMark size={22} />
              <span
                className="font-sans"
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  letterSpacing: "-0.025em",
                  color: CS.ink,
                }}
              >
                commonsquare
              </span>
            </Link>
            <nav className="mt-10 flex flex-col gap-1">
              {NAV_ITEMS.map((it) => (
                <div
                  key={it.label}
                  className="font-sans"
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontSize: 14,
                    color: it.active ? CS.ink : it.soon ? CS.mute : CS.ink,
                    background: it.active ? CS.violetT : "transparent",
                    fontWeight: it.active ? 500 : 400,
                    letterSpacing: "-0.01em",
                    cursor: it.soon ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{it.label}</span>
                  {it.soon ? (
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 9,
                        color: CS.mute,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                      }}
                    >
                      Soon
                    </span>
                  ) : null}
                </div>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <div
              className="flex items-center gap-3"
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: CS.paper2,
              }}
            >
              <CSProcAvatar
                seed={profile.handle}
                size={36}
                accent={archetype.tint}
              />
              <div className="min-w-0 flex-1">
                <div
                  className="font-sans truncate"
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: CS.ink,
                    letterSpacing: "-0.01em",
                  }}
                >
                  @{profile.handle}
                </div>
                <div
                  className="font-mono truncate"
                  style={{
                    fontSize: 10,
                    color: CS.mute,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  {profile.show_on_profile ? archetype.short : "Private"}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="font-mono"
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: "transparent",
                border: `1px solid ${CS.rule2}`,
                color: CS.mute,
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <div className="flex flex-col">
          {/* Mobile top bar */}
          <div
            className="flex items-center justify-between border-b px-5 py-4 md:hidden"
            style={{ borderColor: CS.rule }}
          >
            <Link href="/" className="inline-flex items-center gap-2.5">
              <CSMark size={20} />
              <span
                className="font-sans"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: "-0.025em",
                  color: CS.ink,
                }}
              >
                commonsquare
              </span>
            </Link>
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                color: CS.mute,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              The Lounge
            </span>
          </div>

          {/* Desktop top bar */}
          <div
            className="hidden items-center justify-between border-b px-10 py-5 md:flex"
            style={{ borderColor: CS.rule }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                color: CS.mute,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              The Lounge · @{profile.handle}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePrivacy}
                disabled={togglingPrivacy}
                className="font-sans transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: `1px solid ${CS.rule2}`,
                  background: "transparent",
                  color: CS.ink,
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: "-0.005em",
                  cursor: togglingPrivacy ? "not-allowed" : "pointer",
                }}
              >
                {profile.show_on_profile
                  ? "Profile is public · hide"
                  : "Profile is private · show"}
              </button>
              <CSButton variant="ink" size="sm">
                Challenge @{profile.handle} →
              </CSButton>
            </div>
          </div>

          <section className="mx-auto w-full max-w-[960px] px-6 pb-32 pt-10 md:px-10 md:pt-12">
            {/* Profile header */}
            <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_auto] md:gap-12">
              <div className="flex items-start gap-5 md:items-center">
                <CSProcAvatar
                  seed={profile.handle}
                  size={96}
                  accent={archetype.tint}
                />
                <div className="flex flex-col gap-2">
                  <span
                    className="font-sans"
                    style={{
                      fontSize: 28,
                      fontWeight: 500,
                      letterSpacing: "-0.025em",
                      color: CS.ink,
                    }}
                  >
                    @{profile.handle}
                  </span>
                  {profile.show_on_profile ? (
                    <BadgePill arch={archetype} />
                  ) : (
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        color: CS.mute,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                      }}
                    >
                      Archetype hidden · only you can see it
                    </span>
                  )}
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      color: CS.mute,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    Joined {new Date(profile.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="hidden grid-cols-3 gap-10 md:grid">
                <StatBlock
                  label="ELO"
                  value={profile.elo.toLocaleString()}
                  caption="Starting"
                />
                <StatBlock
                  label="W–L"
                  value={`${profile.wins}–${profile.losses}`}
                  caption="No debates"
                />
                <StatBlock label="Streak" value="—" caption="Open the square" />
              </div>
            </div>

            {/* Mobile stats strip */}
            <div
              className="mt-7 grid grid-cols-3 gap-4 px-5 py-5 md:hidden"
              style={{
                borderRadius: 14,
                background: CS.paper2,
                border: `1px solid ${CS.rule}`,
              }}
            >
              <StatBlock
                label="ELO"
                value={profile.elo.toLocaleString()}
                caption="Starting"
              />
              <StatBlock
                label="W–L"
                value={`${profile.wins}–${profile.losses}`}
                caption="No debates"
              />
              <StatBlock label="Streak" value="—" caption="—" />
            </div>

            {/* Today's Topic tile */}
            <div className="mt-7 md:mt-10">
              <TodayTopicTile userId={profile.user_id} />
            </div>

            {/* Total XP tile */}
            <div className="mt-4">
              <XpTile userId={profile.user_id} xp={profile.xp} />
            </div>

            {/* Mobile tab strip */}
            <div className="mt-7 flex items-center gap-6 md:hidden">
              {(["Debates", "Compass", "Stats"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="font-sans"
                  style={{
                    padding: "6px 0",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: tab === t ? 500 : 400,
                    color: tab === t ? CS.ink : CS.mute,
                    borderBottom:
                      tab === t
                        ? `2px solid ${CS.violet}`
                        : "2px solid transparent",
                    letterSpacing: "-0.005em",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Compass card (desktop always; mobile via tab) */}
            <div
              className={`${tab === "Compass" ? "block" : "hidden"} mt-7 md:mt-12 md:block`}
              style={{
                borderRadius: 14,
                background: CS.paper2,
                border: `1px solid ${CS.rule}`,
                padding: "28px",
              }}
            >
              <div className="grid grid-cols-1 gap-8 md:grid-cols-[auto_1fr] md:gap-12">
                <div className="flex justify-center">
                  <CSCompass
                    size={260}
                    x={profile.axis_e / 100}
                    y={profile.axis_s / 100}
                    accent={archetype.tint}
                    showArchetype={false}
                  />
                </div>
                <div className="flex flex-col gap-6">
                  <AxisRow
                    eyebrow="Economic"
                    low="Community Investment"
                    high="Free Market"
                    value={profile.axis_e}
                    tint={archetype.tint}
                  />
                  <AxisRow
                    eyebrow="Social"
                    low="Traditional Values"
                    high="Progressive Values"
                    value={profile.axis_s}
                    tint={archetype.tint}
                  />
                  <AxisRow
                    eyebrow="Governance"
                    low="Institutional Trust"
                    high="Individual Liberty"
                    value={profile.axis_g}
                    tint={archetype.tint}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      // Clear local quiz state; the existing profile row is
                      // upserted when the user re-locks on /results.
                      setState({
                        ...state,
                        answers: Array(state.answers.length).fill(null),
                        quizIndex: 0,
                        step: "quiz",
                      });
                      router.push("/quiz");
                    }}
                    className="font-mono self-start"
                    style={{
                      marginTop: 4,
                      padding: "8px 14px",
                      borderRadius: 999,
                      background: "transparent",
                      border: `1px solid ${CS.rule2}`,
                      color: CS.ink,
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    Retake the compass
                  </button>
                </div>
              </div>
            </div>

            {/* Debates list (desktop always; mobile via tab) */}
            <div
              className={`${tab === "Debates" ? "block" : "hidden"} mt-7 md:mt-12 md:block`}
            >
              <EmptyDebates handle={profile.handle} />
            </div>

            {/* Stats tab (mobile only) */}
            <div className={`${tab === "Stats" ? "block" : "hidden"} mt-7 md:hidden`}>
              <div
                className="flex flex-col gap-3 px-5 py-5"
                style={{
                  borderRadius: 14,
                  background: CS.paper2,
                  border: `1px solid ${CS.rule}`,
                }}
              >
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    color: CS.mute,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  Signed in as
                </span>
                <span
                  className="font-sans"
                  style={{ fontSize: 16, color: CS.ink, fontWeight: 500 }}
                >
                  {session.user.email ?? profile.email}
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  className="font-mono self-start"
                  style={{
                    marginTop: 8,
                    padding: "8px 14px",
                    borderRadius: 999,
                    background: "transparent",
                    border: `1px solid ${CS.rule2}`,
                    color: CS.ink,
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          </section>

          {/* Mobile sticky CTA */}
          <div
            className="fixed bottom-0 left-0 right-0 flex items-center justify-between gap-4 px-5 py-4 md:hidden"
            style={{ background: CS.paper, borderTop: `1px solid ${CS.rule2}` }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                color: CS.mute,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Square opens soon
            </span>
            <CSButton variant="primary" size="md">
              Invite a friend →
            </CSButton>
          </div>
        </div>
      </div>
    </main>
  );
}
