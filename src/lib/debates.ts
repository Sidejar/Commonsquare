"use client";

import { getSupabase } from "./supabase";
import { cleanDebate, cleanRound, hasProfanity } from "./debate-text";
import type { DebateWithDebaters, RoundRow } from "./database.types";
import type { Stance } from "./topics";

// Client-side debate reads + the write RPCs. Every write is a SECURITY DEFINER
// function that checks auth.uid() — there are no insert/update policies on
// debates or rounds, so nothing here touches the tables directly except the
// (RLS-guarded) rounds read.

export const ROUND_MAX = 4000;
export const PROMPT_MIN = 10;
export const PROMPT_MAX = 200;

// 'public' = open challenges + live/recent open debates (what anyone can see).
// 'mine'   = everything the signed-in user is part of, open or closed.
export type DebateScope = "public" | "mine";

const PROFANITY_MESSAGE =
  "Keep it civil — take the profanity out and try again.";

// RPC errors arrive as PostgrestError objects; their message is written for
// the user (see the raise exception lines in the migration).
export function debateErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

export async function fetchDebates(
  scope: DebateScope,
  limit = 60,
): Promise<DebateWithDebaters[]> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("debates_with_debaters", {
    p_scope: scope,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []).map(cleanDebate);
}

export async function fetchDebate(
  id: string,
): Promise<DebateWithDebaters | null> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("debates_with_debaters", {
    p_debate_id: id,
  });
  if (error) throw error;
  const row = (data ?? [])[0];
  return row ? cleanDebate(row) : null;
}

export async function fetchRounds(debateId: string): Promise<RoundRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("rounds")
    .select("*")
    .eq("debate_id", debateId)
    .order("round_number")
    .order("submitted_at");
  if (error) throw error;
  return (data ?? []).map(cleanRound);
}

export interface NewChallengeInput {
  stance: Stance;
  // Exactly one of these two.
  topicId?: string | null;
  customPrompt?: string | null;
  // null / empty = open to anyone.
  opponentHandle?: string | null;
  visibility: "open" | "closed";
}

// Returns the new debate's id.
export async function createChallenge(
  input: NewChallengeInput,
): Promise<string> {
  const prompt = input.customPrompt?.trim() || null;
  if (prompt && hasProfanity(prompt)) throw new Error(PROFANITY_MESSAGE);
  const sb = getSupabase();
  const { data, error } = await sb.rpc("create_challenge", {
    p_stance: input.stance,
    p_topic_id: input.topicId ?? null,
    p_custom_prompt: prompt,
    p_opponent_handle: input.opponentHandle?.trim() || null,
    p_visibility: input.visibility,
  });
  if (error) throw error;
  return data;
}

export async function acceptChallenge(debateId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.rpc("accept_challenge", { p_debate_id: debateId });
  if (error) throw error;
}

export async function declineChallenge(debateId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.rpc("decline_challenge", {
    p_debate_id: debateId,
  });
  if (error) throw error;
}

export async function cancelChallenge(debateId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.rpc("cancel_challenge", { p_debate_id: debateId });
  if (error) throw error;
}

export async function submitRound(
  debateId: string,
  content: string,
): Promise<void> {
  if (hasProfanity(content)) throw new Error(PROFANITY_MESSAGE);
  const sb = getSupabase();
  const { error } = await sb.rpc("submit_round", {
    p_debate_id: debateId,
    p_content: content,
  });
  if (error) throw error;
}
