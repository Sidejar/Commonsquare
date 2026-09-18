import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CS } from "@/lib/cs";
import { CSMark } from "@/components/cs/cs-mark";
import { CSButton } from "@/components/cs/cs-button";
import { CSProcAvatar } from "@/components/cs/cs-proc-avatar";
import { CSArchetypes } from "@/lib/archetypes";
import type { DebateWithDebaters } from "@/lib/database.types";

// Shared, hook-free debate UI: used by the client pages under /debates and by
// the server-rendered "Debates on this topic" list on the topic page.

export const ROUND_NAMES = ["Opening", "Rebuttal", "Closing"] as const;

export const MONO_LABEL: CSSProperties = {
  fontSize: 11,
  color: CS.mute,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

export function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "deadline passed";
  const min = Math.ceil(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m left`;
  return m === 0 ? `${h}h left` : `${h}h ${m}m left`;
}

export function statusLabel(d: DebateWithDebaters): string {
  switch (d.status) {
    case "queued":
      return d.opponent_selection === "anyone"
        ? "Open challenge"
        : "Direct challenge";
    case "active":
      return `Live · Round ${d.current_round} of 3 · ${ROUND_NAMES[d.current_round - 1]}`;
    case "complete":
      return "Complete";
    case "forfeit":
      return "Forfeit";
    case "declined":
      return "Declined";
    default:
      return "Cancelled";
  }
}

// Handle of whoever has to move, for "@x's turn" labels.
export function turnHandle(d: DebateWithDebaters): string | null {
  if (!d.turn_user_id) return null;
  return d.turn_user_id === d.debater_a_user_id ? d.a_handle : d.b_handle;
}

export function DebatesNav() {
  return (
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
        <Link href="/topics" className="hidden sm:block">
          <CSButton size="sm" variant="ghost">
            Topics
          </CSButton>
        </Link>
        <Link href="/debates">
          <CSButton size="sm" variant="ghost">
            Debates
          </CSButton>
        </Link>
        <Link href="/debates/new">
          <CSButton size="sm" variant="ink">
            Start a debate
          </CSButton>
        </Link>
      </div>
    </div>
  );
}

export function StatusTag({ debate: d }: { debate: DebateWithDebaters }) {
  const live = d.status === "active";
  return (
    <span
      className="font-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px 5px 8px",
        borderRadius: 999,
        background: live ? CS.violetT : CS.paper2,
        color: live ? CS.violetD : CS.ink,
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: live ? CS.violet : CS.mute,
        }}
      />
      {statusLabel(d)}
    </span>
  );
}

interface DebaterProps {
  // null = the seat is still open (an 'anyone' challenge nobody claimed yet).
  handle: string | null;
  archetypeId: string | null;
  stance: string;
  // Keeps 'anonymous' avatars from all looking alike.
  seed: string;
  size?: "sm" | "lg";
}

// One debater: avatar, @handle, archetype (when public) and the side they argue.
export function Debater({
  handle,
  archetypeId,
  stance,
  seed,
  size = "sm",
}: DebaterProps) {
  const archetype = CSArchetypes.find((a) => a.id === archetypeId);
  const lg = size === "lg";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <CSProcAvatar
        seed={!handle || handle === "anonymous" ? seed : handle}
        size={lg ? 44 : 24}
        accent={archetype?.tint}
        mono={!handle}
      />
      <div className="min-w-0">
        <div
          className="font-sans truncate"
          style={{
            fontSize: lg ? 17 : 13,
            fontWeight: 500,
            letterSpacing: "-0.015em",
            color: handle ? CS.ink : CS.mute,
          }}
        >
          {handle ? `@${handle}` : "Open seat"}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            color: CS.mute,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginTop: lg ? 2 : 0,
          }}
        >
          {archetype ? (
            <span style={{ color: archetype.tint }}>
              {lg ? archetype.n : archetype.short} ·{" "}
            </span>
          ) : null}
          Argues {stance === "yes" ? "Yes" : "No"}
        </div>
      </div>
    </div>
  );
}

interface DebateCardProps {
  debate: DebateWithDebaters;
  viewerId?: string | null;
  // Action buttons (accept / decline / cancel). Rendered outside the link.
  children?: ReactNode;
}

export function DebateCard({ debate: d, viewerId, children }: DebateCardProps) {
  const myTurn =
    d.status === "active" && !!viewerId && d.turn_user_id === viewerId;
  return (
    <div
      className="flex flex-col gap-4"
      style={{
        padding: "22px 20px",
        background: CS.paper,
        border: `1px solid ${myTurn ? CS.violet : CS.rule}`,
        borderRadius: 14,
      }}
    >
      <Link
        href={`/debates/${d.id}`}
        className="flex flex-col gap-3 transition-opacity hover:opacity-90"
        style={{ textDecoration: "none" }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusTag debate={d} />
          {d.visibility === "closed" ? (
            <span className="font-mono" style={{ ...MONO_LABEL, fontSize: 10 }}>
              Private
            </span>
          ) : null}
          {d.status === "active" && d.turn_deadline_at ? (
            <span
              className="font-mono"
              style={{
                ...MONO_LABEL,
                fontSize: 10,
                color: myTurn ? CS.violetD : CS.mute,
                fontWeight: myTurn ? 600 : 400,
              }}
            >
              {myTurn ? "Your turn" : `@${turnHandle(d)}’s turn`} ·{" "}
              {timeLeft(d.turn_deadline_at)}
            </span>
          ) : null}
        </div>
        <h3
          className="font-sans text-balance"
          style={{
            margin: 0,
            fontWeight: 500,
            fontSize: "clamp(18px, 2.4vw, 22px)",
            lineHeight: 1.2,
            letterSpacing: "-0.025em",
            color: CS.ink,
          }}
        >
          {d.prompt}
        </h3>
        {d.topic_title ? (
          <span className="font-mono" style={{ ...MONO_LABEL, fontSize: 10 }}>
            Topic · {d.topic_title}
          </span>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Debater
            handle={d.a_handle}
            archetypeId={d.a_archetype_id}
            stance={d.debater_a_stance}
            seed={`${d.id}a`}
          />
          <span className="font-mono" style={{ ...MONO_LABEL, fontSize: 10 }}>
            vs
          </span>
          <Debater
            handle={d.b_handle}
            archetypeId={d.b_archetype_id}
            stance={d.debater_b_stance}
            seed={`${d.id}b`}
          />
        </div>
      </Link>
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
