"use client";

import { getSupabase } from "./supabase";
import type { ArchetypeId } from "./archetypes";
import type { Database } from "./database.types";

// Clients can't read profiles.email (column grant, migration
// profiles_hide_email), so `select("*")` is denied: select these columns
// instead. The signed-in user's own email is session.user.email.
const PROFILE_COLUMNS =
  "user_id, handle, axis_e, axis_s, axis_g, archetype_id, show_on_profile, elo, wins, losses, created_at, updated_at, xp";

export type ProfileRow = Omit<Database["public"]["Tables"]["profiles"]["Row"], "email">;

// Lookup the current user's profile. Returns null if no row exists yet.
export async function fetchMyProfile(userId: string): Promise<ProfileRow | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// Lookup any public profile by handle (for shareable profile URLs later).
// Uses exact case-insensitive match (not .ilike, which would treat `_` and
// `%` in the input as SQL wildcards — handles can legitimately contain `_`).
export async function fetchProfileByHandle(handle: string): Promise<ProfileRow | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// True if the handle has not yet been claimed (case-insensitive). Calls the
// SECURITY DEFINER RPC `handle_is_available` so the check works for anon
// callers and for handles whose owner has `show_on_profile = false`.
export async function isHandleAvailable(handle: string): Promise<boolean> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("handle_is_available", { p_handle: handle });
  if (error) throw error;
  return Boolean(data);
}

// No email: the DB fills profiles.email from the JWT (migration
// profiles_email_from_jwt) and clients can't write it.
export interface NewProfileInput {
  userId: string;
  handle: string;
  axisE: number;
  axisS: number;
  axisG: number;
  archetypeId: ArchetypeId;
  showOnProfile: boolean;
}

// Upsert the profile row for the current user. Used both for the initial
// lock-in and for retakes (new archetype overwrites the old). Throws on
// handle-uniqueness conflict — callers should funnel back to /username.
export async function insertProfile(input: NewProfileInput): Promise<ProfileRow> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("profiles")
    .upsert(
      {
        user_id: input.userId,
        handle: input.handle,
        axis_e: input.axisE,
        axis_s: input.axisS,
        axis_g: input.axisG,
        archetype_id: input.archetypeId,
        show_on_profile: input.showOnProfile,
      },
      { onConflict: "user_id" },
    )
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

// Toggle just the privacy flag.
export async function updateShowOnProfile(
  userId: string,
  showOnProfile: boolean,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("profiles")
    .update({ show_on_profile: showOnProfile })
    .eq("user_id", userId);
  if (error) throw error;
}
