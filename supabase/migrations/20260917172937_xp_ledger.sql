-- XP ledger + event tracking (build queue #3; docs/product-architecture.md §4, §7).
--
-- xp_events is an append-only ledger of XP grants. Total XP = sum(amount) per
-- user, materialized on profiles.xp by trigger. Clients never write XP: every
-- grant happens inside a SECURITY DEFINER trigger on the table where the
-- action happens, and clients can only read their own events.
--
-- v1 actions: 'vote_cast' (+1, once per topic), 'comment_post' (+1, once per
-- topic), 'daily_activity' (+5, once per UTC day). Not built yet: streak
-- scaling, debates, first-time bonuses.

create table public.xp_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  action          text not null,
  amount          integer not null,
  reference_id    uuid,
  reference_type  text,
  day             date not null default ((now() at time zone 'utc')::date),
  created_at      timestamptz not null default now()
);

create index xp_events_user_idx on public.xp_events (user_id, created_at desc);

-- Anti-farming. Grants insert with ON CONFLICT DO NOTHING against these.
create unique index xp_events_once_per_topic
  on public.xp_events (user_id, action, reference_id)
  where action in ('vote_cast', 'comment_post');
create unique index xp_events_once_per_day
  on public.xp_events (user_id, day)
  where action = 'daily_activity';

-- ----------------------------------------------------------------------
-- profiles.xp: running total, kept in sync with the ledger
-- ----------------------------------------------------------------------

alter table public.profiles add column xp integer not null default 0;

create or replace function public.xp_events_apply_to_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set xp = xp + new.amount where user_id = new.user_id;
  return null;
end;
$$;

create trigger xp_events_after_insert
  after insert on public.xp_events
  for each row execute function public.xp_events_apply_to_profile();

-- ----------------------------------------------------------------------
-- Grants: first vote / first comment on a topic
-- ----------------------------------------------------------------------
-- One function for both tables (each has user_id + topic_id); the action
-- name arrives as the trigger argument. +1 for the action, plus +5
-- 'daily_activity' the first time the user earns anything that UTC day.

create or replace function public.xp_award_topic_action()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.xp_events (user_id, action, amount, reference_id, reference_type)
  values (new.user_id, tg_argv[0], 1, new.topic_id, 'topic')
  on conflict do nothing;

  if found then
    insert into public.xp_events (user_id, action, amount)
    values (new.user_id, 'daily_activity', 5)
    on conflict do nothing;
  end if;

  return null;
end;
$$;

create trigger topic_votes_award_xp
  after insert on public.topic_votes
  for each row execute function public.xp_award_topic_action('vote_cast');

create trigger topic_comments_award_xp
  after insert on public.topic_comments
  for each row execute function public.xp_award_topic_action('comment_post');

-- Trigger-only functions: nobody calls them directly.
revoke execute on function public.xp_events_apply_to_profile() from public, anon, authenticated;
revoke execute on function public.xp_award_topic_action() from public, anon, authenticated;

-- ----------------------------------------------------------------------
-- RLS + privileges
-- ----------------------------------------------------------------------

alter table public.xp_events enable row level security;

create policy "xp_events_select_own"
  on public.xp_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Append-only and server-written: clients get SELECT (own rows) and nothing else.
revoke all on public.xp_events from anon, authenticated;
grant select on public.xp_events to authenticated;

-- profiles.xp is server-owned. The self insert/update policies on profiles are
-- row-level only, so without this a client could write its own xp. Clients
-- keep insert/update on exactly the columns the app writes; xp (and elo, wins,
-- losses) are writable only by triggers and service_role. A new client-writable
-- profiles column needs to be added to this grant.
revoke insert, update on public.profiles from anon, authenticated;
grant
  insert (user_id, handle, email, axis_e, axis_s, axis_g, archetype_id, show_on_profile),
  update (user_id, handle, email, axis_e, axis_s, axis_g, archetype_id, show_on_profile)
  on public.profiles to authenticated;
