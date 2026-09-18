-- profiles.email is private. The SELECT policy on profiles is row-level only,
-- so with table-wide SELECT anyone holding the anon key could read the email
-- of every public profile (GET /rest/v1/profiles?select=handle,email).
-- Clients keep SELECT on every column except email; the app takes the owner's
-- email from the auth session. Insert/update grants on email are unchanged
-- (see xp_ledger). A new profiles column is not client-readable until it is
-- added to this grant.
revoke select on public.profiles from anon, authenticated;
grant select (user_id, handle, axis_e, axis_s, axis_g, archetype_id, show_on_profile,
              elo, wins, losses, created_at, updated_at, xp)
  on public.profiles to anon, authenticated;
