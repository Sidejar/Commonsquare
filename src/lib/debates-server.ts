import { createAnonServerClient } from "./supabase-anon-server";
import { cleanDebate, cleanRound } from "./debate-text";
import type { DebateWithDebaters, RoundRow } from "./database.types";

// Server-only debate fetchers, for SSR + meta tags. They run as anon, so they
// only ever see what is public: open debates and open 'anyone' challenges.
// Closed debates and specific challenges come back empty here and are loaded
// by the client once it has the viewer's session.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDebateId(id: string): boolean {
  return UUID_RE.test(id);
}

export async function getDebateServer(
  id: string,
): Promise<DebateWithDebaters | null> {
  if (!isDebateId(id)) return null;
  const sb = createAnonServerClient();
  const { data, error } = await sb.rpc("debates_with_debaters", {
    p_debate_id: id,
  });
  if (error) {
    console.error("getDebateServer error", error);
    return null;
  }
  const row = (data ?? [])[0];
  return row ? cleanDebate(row) : null;
}

export async function getDebateRoundsServer(
  debateId: string,
): Promise<RoundRow[]> {
  const sb = createAnonServerClient();
  const { data, error } = await sb
    .from("rounds")
    .select("*")
    .eq("debate_id", debateId)
    .order("round_number")
    .order("submitted_at");
  if (error) {
    console.error("getDebateRoundsServer error", error);
    return [];
  }
  return (data ?? []).map(cleanRound);
}

// "Debates on this topic": everything public that is tied to the topic —
// joinable challenges first, then live and finished debates.
export async function getTopicDebatesServer(
  topicId: string,
  limit = 20,
): Promise<DebateWithDebaters[]> {
  const sb = createAnonServerClient();
  const { data, error } = await sb.rpc("debates_with_debaters", {
    p_scope: "public",
    p_topic_id: topicId,
    p_limit: limit,
  });
  if (error) {
    console.error("getTopicDebatesServer error", error);
    return [];
  }
  return (data ?? []).map(cleanDebate);
}
