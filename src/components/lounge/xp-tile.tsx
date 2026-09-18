"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { CS } from "@/lib/cs";
import { getSupabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type XpEvent = Pick<
  Database["public"]["Tables"]["xp_events"]["Row"],
  "id" | "action" | "amount" | "created_at"
>;

// Friendly names for xp_events.action (granted by the xp_ledger triggers).
const ACTION_LABELS: Record<string, string> = {
  vote_cast: "Voted on a topic",
  comment_post: "Commented on a topic",
  daily_activity: "Daily activity bonus",
  debate_complete: "Completed a debate",
};

const eyebrow: CSSProperties = {
  fontSize: 10,
  color: CS.mute,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

interface Props {
  userId: string;
  xp: number;
}

// "Total XP" tile for the lounge: the running total (profiles.xp) plus the
// five most recent ledger rows. XP is granted by DB triggers — read-only here.
export function XpTile({ userId, xp }: Props) {
  // null = still loading, so the empty-state hint doesn't flash.
  const [events, setEvents] = useState<XpEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSupabase()
      .from("xp_events")
      .select("id, action, amount, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (error) console.error(error);
        if (!cancelled) setEvents(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div
      className="grid grid-cols-1 items-center gap-5 md:grid-cols-[auto_1fr] md:gap-12"
      style={{
        padding: "22px 24px",
        borderRadius: 14,
        background: CS.paper2,
        border: `1px solid ${CS.rule}`,
      }}
    >
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
          {xp.toLocaleString()}
        </span>
        <span className="font-mono" style={eyebrow}>
          Total XP
        </span>
      </div>

      {events === null ? null : events.length === 0 ? (
        <span className="font-sans" style={{ fontSize: 13, color: CS.mute }}>
          Vote or comment on today&rsquo;s topic to earn your first XP.
        </span>
      ) : (
        <ul
          className="flex flex-col gap-2"
          style={{ margin: 0, padding: 0, listStyle: "none" }}
        >
          {events.map((e) => (
            <li key={e.id} className="flex items-baseline justify-between gap-4">
              <span
                className="font-sans"
                style={{ fontSize: 13, color: CS.ink, letterSpacing: "-0.005em" }}
              >
                {ACTION_LABELS[e.action] ?? e.action}
              </span>
              <span className="flex items-baseline gap-3">
                <span className="font-mono" style={eyebrow}>
                  {new Date(e.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span
                  className="font-mono"
                  style={{ fontSize: 12, color: CS.violet }}
                >
                  +{e.amount}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
