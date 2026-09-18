-- Debate engine v1 (build queue #4; docs/product-architecture.md §1-3, §5, §7).
--
-- A debate is a match between two people: three rounds each (opening /
-- rebuttal / closing), A then B inside every round, 12 hours per turn. v1 has
-- no judging and no winner (decision log 2026-05-13), so there is no winner_id
-- column and no 'voting' status yet. Finishing pays both debaters XP; a missed
-- deadline forfeits the debate and pays nothing.
--
-- Clients never write these tables. Every write goes through the SECURITY
-- DEFINER RPCs below, which validate auth.uid(). Reads: RLS on the tables, plus
-- one read RPC that joins debater handles the way topic_comments_with_author
-- does (profiles RLS hides private profiles from direct reads).

create table public.debates (
  id                  uuid primary key default gen_random_uuid(),
  topic_id            uuid references public.topics (id) on delete cascade,
  custom_prompt       text check (char_length(custom_prompt) between 10 and 200),
  debater_a_user_id   uuid not null references auth.users (id) on delete cascade,
  debater_b_user_id   uuid references auth.users (id) on delete cascade,
  -- Set only for opponent_selection = 'specific': the one user who may accept.
  challenged_user_id  uuid references auth.users (id) on delete cascade,
  debater_a_stance    text not null check (debater_a_stance in ('yes', 'no')),
  debater_b_stance    text generated always as
                        (case debater_a_stance when 'yes' then 'no' else 'yes' end) stored,
  visibility          text not null default 'open' check (visibility in ('open', 'closed')),
  opponent_selection  text not null check (opponent_selection in ('specific', 'anyone')),
  status              text not null default 'queued'
                        check (status in ('queued', 'active', 'complete', 'forfeit', 'declined', 'cancelled')),
  current_round       integer not null default 1 check (current_round between 1 and 3),
  -- Whose move it is and when their 12h runs out. Both are cleared on
  -- 'complete'; on 'forfeit' they stay, recording who missed which deadline.
  turn_user_id        uuid,
  turn_deadline_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  completed_at        timestamptz,
  constraint debates_topic_xor_prompt
    check (num_nonnulls(topic_id, custom_prompt) = 1),
  constraint debates_specific_has_target
    check ((opponent_selection = 'specific') = (challenged_user_id is not null)),
  constraint debates_no_self_debate
    check (debater_a_user_id <> debater_b_user_id and debater_a_user_id <> challenged_user_id),
  constraint debates_opponent_once_accepted
    check ((status in ('active', 'complete', 'forfeit')) = (debater_b_user_id is not null)),
  constraint debates_turn_is_a_debater
    check (turn_user_id in (debater_a_user_id, debater_b_user_id))
);

create index debates_topic_idx on public.debates (topic_id);
create index debates_debater_a_idx on public.debates (debater_a_user_id);
create index debates_debater_b_idx on public.debates (debater_b_user_id);
create index debates_challenged_idx on public.debates (challenged_user_id);
create index debates_feed_idx on public.debates (status, updated_at desc);
create index debates_turn_deadline_idx on public.debates (turn_deadline_at) where status = 'active';

create trigger debates_set_updated_at
  before update on public.debates
  for each row execute function public.set_updated_at();

-- One row per submitted turn, so a finished debate has 6 (3 rounds x 2 debaters).
create table public.rounds (
  id            uuid primary key default gen_random_uuid(),
  debate_id     uuid not null references public.debates (id) on delete cascade,
  round_number  integer not null check (round_number between 1 and 3),
  user_id       uuid not null references auth.users (id) on delete cascade,
  content       text not null check (char_length(content) between 1 and 4000),
  submitted_at  timestamptz not null default now(),
  deadline_at   timestamptz not null,
  unique (debate_id, round_number, user_id)
);

create index rounds_user_idx on public.rounds (user_id);

-- ----------------------------------------------------------------------
-- Visibility: RLS + privileges
-- ----------------------------------------------------------------------
-- "Listed" = shows up for people who are not part of the debate:
--   * queued 'anyone' challenges, so somebody can claim them. Open ones are
--     public; closed ones ("private queue", §2) only to signed-in users, who
--     are the only ones able to accept. Once accepted they go party-only.
--   * open debates that actually started (active / complete / forfeit).
-- Never listed: specific challenges while queued (§5: inbox only), declined
-- or cancelled challenges (right of refusal leaves no public mark), and
-- anything closed once it has two debaters.
-- The RLS policy and the read RPC share this one definition.
create or replace function public.debate_is_listed(d public.debates)
returns boolean
language sql
stable
set search_path = ''
as $$
  select ((d).status = 'queued' and (d).opponent_selection = 'anyone'
          and ((d).visibility = 'open' or auth.uid() is not null))
      or ((d).visibility = 'open' and (d).status in ('active', 'complete', 'forfeit'));
$$;

alter table public.debates enable row level security;
alter table public.rounds enable row level security;

create policy "debates_select_party_or_listed"
  on public.debates
  for select
  using (
    (select auth.uid()) in (debater_a_user_id, debater_b_user_id, challenged_user_id)
    or public.debate_is_listed(debates)
  );

-- Rounds follow their debate: the subquery runs under the caller's RLS.
create policy "rounds_select_with_debate"
  on public.rounds
  for select
  using (exists (select 1 from public.debates d where d.id = rounds.debate_id));

-- Server-written only: clients get SELECT (through RLS) and nothing else.
revoke all on public.debates, public.rounds from anon, authenticated;
grant select on public.debates, public.rounds to anon, authenticated;

-- ----------------------------------------------------------------------
-- Write RPCs
-- ----------------------------------------------------------------------

-- Issue a challenge (§2). p_opponent_handle null = "anyone".
create or replace function public.create_challenge(
  p_stance text,
  p_topic_id uuid default null,
  p_custom_prompt text default null,
  p_opponent_handle text default null,
  p_visibility text default 'open'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prompt text := nullif(btrim(p_custom_prompt), '');
  v_handle text := nullif(lower(ltrim(btrim(p_opponent_handle), '@')), '');
  v_challenged uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to issue a challenge.';
  end if;
  if not exists (select 1 from public.profiles where user_id = v_uid) then
    raise exception 'Take the Compass and claim a handle before you debate.';
  end if;
  if num_nonnulls(p_topic_id, v_prompt) <> 1 then
    raise exception 'Pick a topic or write a custom prompt (one, not both).';
  end if;
  if p_topic_id is not null and not exists (
    select 1 from public.topics where id = p_topic_id and status = 'published'
  ) then
    raise exception 'That topic does not exist.';
  end if;
  if char_length(v_prompt) not between 10 and 200 then
    raise exception 'A custom prompt must be 10 to 200 characters.';
  end if;

  -- One challenge at a time per user, so the limits below cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  if v_handle is not null then
    select user_id into v_challenged from public.profiles where lower(handle) = v_handle;
    if v_challenged is null then
      raise exception 'No debater with the handle @%.', v_handle;
    end if;
    if v_challenged = v_uid then
      raise exception 'You cannot challenge yourself.';
    end if;
    -- Safety (§5): 5 specific challenges per rolling 24h. Cancelled and declined
    -- ones still count, or cancel-and-resend would dodge the limit.
    if (select count(*) from public.debates
         where debater_a_user_id = v_uid
           and opponent_selection = 'specific'
           and created_at > now() - interval '24 hours') >= 5 then
      raise exception 'You can send 5 direct challenges per 24 hours. Try again later.';
    end if;
  end if;

  -- Keeps one account from flooding the open-challenges feed.
  if (select count(*) from public.debates
       where debater_a_user_id = v_uid and status = 'queued') >= 10 then
    raise exception 'You already have 10 challenges waiting. Cancel one first.';
  end if;

  insert into public.debates
    (topic_id, custom_prompt, debater_a_user_id, challenged_user_id,
     debater_a_stance, visibility, opponent_selection)
  values
    (p_topic_id, v_prompt, v_uid, v_challenged,
     p_stance, p_visibility, case when v_challenged is null then 'anyone' else 'specific' end)
  returning id into v_id;
  return v_id;
end;
$$;

-- Accept: the challenged user for a specific challenge, anyone but the
-- challenger for an 'anyone' one. A opens, and A's 12 hours start now.
create or replace function public.accept_challenge(p_debate_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in to accept a challenge.';
  end if;
  if not exists (select 1 from public.profiles where user_id = v_uid) then
    raise exception 'Take the Compass and claim a handle before you debate.';
  end if;

  -- A single UPDATE is the claim: of two racing accepters, the second one
  -- re-checks status after the first commits and matches nothing.
  update public.debates
     set debater_b_user_id = v_uid,
         status = 'active',
         turn_user_id = debater_a_user_id,
         turn_deadline_at = now() + interval '12 hours'
   where id = p_debate_id
     and status = 'queued'
     and debater_a_user_id <> v_uid
     and (challenged_user_id is null or challenged_user_id = v_uid);
  if not found then
    raise exception 'This challenge is no longer available.';
  end if;
end;
$$;

-- Right of refusal (§5): no penalty, and a declined challenge is never listed.
create or replace function public.decline_challenge(p_debate_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.debates
     set status = 'declined'
   where id = p_debate_id and status = 'queued' and challenged_user_id = auth.uid();
  if not found then
    raise exception 'There is no challenge here for you to decline.';
  end if;
end;
$$;

create or replace function public.cancel_challenge(p_debate_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.debates
     set status = 'cancelled'
   where id = p_debate_id and status = 'queued' and debater_a_user_id = auth.uid();
  if not found then
    raise exception 'Only your own unanswered challenges can be cancelled.';
  end if;
end;
$$;

-- Submit the current turn. Order: A1 B1 A2 B2 A3 B3; every hand-over starts a
-- fresh 12 hours; the sixth submission completes the debate.
create or replace function public.submit_round(p_debate_id uuid, p_content text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_content text := btrim(p_content);
  d public.debates;
begin
  if v_content is null or char_length(v_content) not between 1 and 4000 then
    raise exception 'A round must be 1 to 4000 characters.';
  end if;

  -- Row lock: a double-click cannot submit the same turn twice.
  select * into d from public.debates where id = p_debate_id for update;
  -- One message for every "no", so this cannot be used to probe private debates.
  if not found or v_uid is null or d.status <> 'active' or d.turn_user_id is distinct from v_uid then
    raise exception 'It is not your turn in this debate.';
  end if;
  -- The sweep below flips the status within 10 minutes; until then, refuse.
  if now() > d.turn_deadline_at then
    raise exception 'The 12-hour deadline for this round has passed.';
  end if;

  insert into public.rounds (debate_id, round_number, user_id, content, deadline_at)
  values (d.id, d.current_round, v_uid, v_content, d.turn_deadline_at);

  if v_uid = d.debater_a_user_id then
    update public.debates
       set turn_user_id = d.debater_b_user_id,
           turn_deadline_at = now() + interval '12 hours'
     where id = d.id;
  elsif d.current_round < 3 then
    update public.debates
       set current_round = d.current_round + 1,
           turn_user_id = d.debater_a_user_id,
           turn_deadline_at = now() + interval '12 hours'
     where id = d.id;
  else
    update public.debates
       set status = 'complete', completed_at = now(),
           turn_user_id = null, turn_deadline_at = null
     where id = d.id;
    -- XP (§4): +10 each for finishing, whatever the outcome. The status check
    -- under the row lock above means this runs once per debate.
    insert into public.xp_events (user_id, action, amount, reference_id, reference_type)
    values (d.debater_a_user_id, 'debate_complete', 10, d.id, 'debate'),
           (d.debater_b_user_id, 'debate_complete', 10, d.id, 'debate');
  end if;
end;
$$;

-- ----------------------------------------------------------------------
-- Read RPC: debates + both debaters' handle / archetype
-- ----------------------------------------------------------------------
-- p_debate_id set: that one debate, if the caller may see it.
-- p_scope 'mine':   debates the caller is part of. Hides challenges they
--                   cancelled, and declined ones from everyone but the sender.
-- p_scope 'public': everything listed (see debate_is_listed), optionally for
--                   one topic. Queued challenges come first, the challengers
--                   furthest from the caller on the topic's primary axis on
--                   top (all three axes when there is no topic / axis) — the
--                   v1 stand-in for cross-spectrum matchmaking (§2). Only the
--                   order is exposed, never anyone's axis scores.
-- Handles follow topic_comments_with_author: private profiles read as
-- 'anonymous', except to the other party of the debate. A private archetype
-- is shown to nobody but its owner.
create or replace function public.debates_with_debaters(
  p_scope text default 'public',
  p_debate_id uuid default null,
  p_topic_id uuid default null,
  p_limit integer default 60
)
returns table (
  id uuid,
  topic_id uuid,
  topic_slug text,
  topic_title text,
  prompt text,
  debater_a_user_id uuid,
  debater_b_user_id uuid,
  challenged_user_id uuid,
  debater_a_stance text,
  debater_b_stance text,
  visibility text,
  opponent_selection text,
  status text,
  current_round integer,
  turn_user_id uuid,
  turn_deadline_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  completed_at timestamptz,
  a_handle text,
  a_archetype_id text,
  b_handle text,
  b_archetype_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.id, d.topic_id, t.slug, t.title,
    coalesce(t.debate_question, d.custom_prompt),
    d.debater_a_user_id, d.debater_b_user_id, d.challenged_user_id,
    d.debater_a_stance, d.debater_b_stance,
    d.visibility, d.opponent_selection, d.status, d.current_round,
    d.turn_user_id, d.turn_deadline_at, d.created_at, d.updated_at, d.completed_at,
    coalesce(case when pa.show_on_profile or v.is_party then pa.handle end, 'anonymous'),
    case when pa.show_on_profile or pa.user_id = auth.uid() then pa.archetype_id end,
    -- "B" is the opponent once accepted, the challenged user before that,
    -- and null while an 'anyone' challenge is still waiting.
    case when coalesce(d.debater_b_user_id, d.challenged_user_id) is not null then
      coalesce(case when pb.show_on_profile or v.is_party then pb.handle end, 'anonymous')
    end,
    case when pb.show_on_profile or pb.user_id = auth.uid() then pb.archetype_id end
  from public.debates d
  left join public.topics t on t.id = d.topic_id
  left join public.profiles pa on pa.user_id = d.debater_a_user_id
  left join public.profiles pb on pb.user_id = coalesce(d.debater_b_user_id, d.challenged_user_id)
  left join public.profiles me on me.user_id = auth.uid()
  cross join lateral (
    select coalesce(
      auth.uid() in (d.debater_a_user_id, d.debater_b_user_id, d.challenged_user_id),
      false) as is_party
  ) v
  where (p_debate_id is null or d.id = p_debate_id)
    and (p_topic_id is null or d.topic_id = p_topic_id)
    and case
          when p_debate_id is not null then v.is_party or public.debate_is_listed(d)
          when p_scope = 'mine' then v.is_party
            and d.status <> 'cancelled'
            and (d.status <> 'declined' or d.debater_a_user_id = auth.uid())
          else public.debate_is_listed(d)
        end
  order by
    (d.status = 'queued') desc,
    case when d.status = 'queued' and me.user_id is not null then
      case t.primary_axis
        when 'e' then abs(pa.axis_e - me.axis_e) / 100.0
        when 's' then abs(pa.axis_s - me.axis_s) / 100.0
        when 'g' then abs(pa.axis_g - me.axis_g) / 100.0
        else sqrt(power(pa.axis_e - me.axis_e, 2) + power(pa.axis_s - me.axis_s, 2)
                  + power(pa.axis_g - me.axis_g, 2)) / (100 * sqrt(3.0))
      end
    end desc nulls last,
    d.updated_at desc
  -- ponytail: one limit across queued + started debates; give 'public' two
  -- scopes when either list regularly outgrows p_limit.
  limit least(greatest(p_limit, 1), 200);
$$;

-- Writes need a signed-in user; the read RPC also serves anon (SSR / SEO).
revoke execute on function
  public.create_challenge(text, uuid, text, text, text),
  public.accept_challenge(uuid),
  public.decline_challenge(uuid),
  public.cancel_challenge(uuid),
  public.submit_round(uuid, text)
from public, anon;
grant execute on function
  public.create_challenge(text, uuid, text, text, text),
  public.accept_challenge(uuid),
  public.decline_challenge(uuid),
  public.cancel_challenge(uuid),
  public.submit_round(uuid, text)
to authenticated;

-- ----------------------------------------------------------------------
-- Forfeit sweep
-- ----------------------------------------------------------------------
-- Every 10 minutes: an active debate whose current turn ran out is forfeit.
-- turn_user_id stays on the row, so it records who missed the deadline.
select cron.schedule(
  'debate-forfeit-sweep',
  '*/10 * * * *',
  $$update public.debates set status = 'forfeit', completed_at = now()
    where status = 'active' and turn_deadline_at < now()$$
);
