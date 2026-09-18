"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CS } from "@/lib/cs";
import { CSMark } from "@/components/cs/cs-mark";
import { CSButton } from "@/components/cs/cs-button";
import { CSBadge } from "@/components/cs/cs-badge";
import { useSession } from "@/lib/use-session";

// Admin console for the automated Topic of the Day. The schedule itself lives
// in Supabase (pg_cron → `daily-topic` edge function); this page shows the run
// log and lets an admin fire a run by hand. Admin status is decided by the
// API (ADMIN_EMAILS is server-only), not in the browser.

type Run = {
  id: string;
  status: "published" | "skipped" | "failed" | "dry_run";
  detail: Record<string, unknown> | null;
  created_at: string;
  topics: { slug: string; title: string; status: string } | null;
};

const STATUS_COLOR: Record<Run["status"], string> = {
  published: CS.ink,
  skipped: CS.mute,
  failed: "#b3261e",
  dry_run: CS.mute,
};

function summarize(run: Run): string {
  const d = run.detail ?? {};
  if (run.status === "failed") return String(d.error ?? "Unknown error");
  if (run.status === "skipped") return String(d.reason ?? "");
  const feeds = `${d.items ?? "?"} headlines`;
  const failed = Array.isArray(d.failed_feeds) && d.failed_feeds.length
    ? ` · ${d.failed_feeds.length} feed(s) down`
    : "";
  if (run.status === "dry_run") return `${feeds}${failed}`;
  return `${String(d.debate_question ?? "")} (${feeds}${failed})`;
}

export default function AutoTopicsAdminPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingUntil, setPendingUntil] = useState(0);

  const token = session?.access_token;

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetch("/api/admin/daily-topic", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      setDenied(true);
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? `Request failed (${res.status}).`);
      return;
    }
    setRuns(body.runs as Run[]);
  }, [token]);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/signup");
      return;
    }
    load();
  }, [loading, session, router, load]);

  // After firing a run, poll the log for ~3 minutes.
  useEffect(() => {
    if (!pendingUntil) return;
    const t = setInterval(() => {
      if (Date.now() > pendingUntil) setPendingUntil(0);
      else load();
    }, 5000);
    return () => clearInterval(t);
  }, [pendingUntil, load]);

  async function trigger(body: { dry_run?: boolean; status?: "published" | "draft" }) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/daily-topic", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: true, ...body }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error ?? `Request failed (${res.status}).`);
      setPendingUntil(Date.now() + 3 * 60 * 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) return null;

  return (
    <main style={{ background: CS.paper, minHeight: "100vh", color: CS.ink }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <Link href="/lounge" aria-label="CommonSquare home">
            <CSMark size={28} />
          </Link>
          <CSBadge>Admin</CSBadge>
        </div>

        <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: "0 0 10px" }}>
          Automated Topic of the Day
        </h1>
        <p style={{ color: CS.mute, fontSize: 15, lineHeight: 1.6, margin: "0 0 24px" }}>
          Runs every day at 10:00 UTC (retry at 12:00). It reads today&apos;s headlines from
          left, center, and right outlets, picks one story covered across the spectrum, and
          publishes the briefing and the Yes/No question. Manual topics still work:{" "}
          <Link href="/admin/topics/new" style={{ textDecoration: "underline" }}>
            write one by hand
          </Link>
          .
        </p>

        {denied ? (
          <p role="alert" style={{ fontSize: 15 }}>
            This account is not on the admin allowlist.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
              <CSButton onClick={() => trigger({ status: "published" })} disabled={busy}>
                Generate &amp; publish now
              </CSButton>
              <CSButton variant="ghost" onClick={() => trigger({ status: "draft" })} disabled={busy}>
                Generate as draft
              </CSButton>
              <CSButton variant="ghost" onClick={() => trigger({ dry_run: true })} disabled={busy}>
                Test feeds only
              </CSButton>
            </div>
            <p aria-live="polite" style={{ color: CS.mute, fontSize: 13, minHeight: 20, margin: "0 0 20px" }}>
              {pendingUntil ? "Run started — this takes a minute or two. The log refreshes on its own." : ""}
            </p>
            {error && (
              <p role="alert" style={{ color: "#b3261e", fontSize: 14, margin: "0 0 20px" }}>
                {error}
              </p>
            )}

            <h2
              className="font-mono"
              style={{
                fontSize: 11,
                color: CS.mute,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                margin: "0 0 10px",
              }}
            >
              Recent runs
            </h2>
            {runs === null ? (
              <p style={{ color: CS.mute, fontSize: 14 }}>Loading…</p>
            ) : runs.length === 0 ? (
              <p style={{ color: CS.mute, fontSize: 14 }}>No runs yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {runs.map((run) => (
                  <li
                    key={run.id}
                    style={{
                      borderTop: `1px solid ${CS.rule2}`,
                      padding: "14px 0",
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: STATUS_COLOR[run.status],
                          fontWeight: 600,
                        }}
                      >
                        {run.status.replace("_", " ")}
                      </span>
                      <time dateTime={run.created_at} style={{ color: CS.mute, fontSize: 13 }}>
                        {new Date(run.created_at).toLocaleString()}
                      </time>
                    </div>
                    {run.topics && (
                      <Link
                        href={`/topics/${run.topics.slug}`}
                        style={{ fontSize: 15, fontWeight: 600, textDecoration: "underline" }}
                      >
                        {run.topics.title}
                        {run.topics.status !== "published" ? ` (${run.topics.status})` : ""}
                      </Link>
                    )}
                    <span style={{ fontSize: 14, color: CS.ink, lineHeight: 1.5 }}>{summarize(run)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
