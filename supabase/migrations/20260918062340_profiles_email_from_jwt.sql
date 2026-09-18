-- Follow-up to profiles_hide_email. PostgREST upserts write
-- `set email = excluded.email`, and reading excluded.email needs SELECT on
-- email, so insertProfile's upsert failed once clients lost it. Clients now
-- never send email: it defaults to the signed-in user's JWT email, and clients
-- can no longer write the column (no more spoofed addresses either).
-- ponytail: assumes email sign-in; a JWT without an email claim fails the
-- NOT NULL, so phone/anonymous auth would need another source.
alter table public.profiles alter column email set default (auth.jwt() ->> 'email');
revoke insert (email), update (email) on public.profiles from authenticated;
