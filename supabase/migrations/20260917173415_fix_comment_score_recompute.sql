-- Comment upvotes never moved the score: recompute_comment_score() ran as the
-- voter (SECURITY INVOKER), and topic_comments' update policy only lets the
-- AUTHOR update a row, so the UPDATE silently matched nothing. Meanwhile authors
-- could set their own `score` directly. Fix both.
-- (Already applied to the CommonSquare project; kept here as the record.)

create or replace function public.recompute_comment_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
  s   integer;
begin
  cid := coalesce(new.comment_id, old.comment_id);
  select coalesce(sum(value), 0) into s
    from public.comment_votes where comment_id = cid;
  update public.topic_comments set score = s, updated_at = now() where id = cid;
  return null;
end;
$$;
revoke all on function public.recompute_comment_score() from public, anon, authenticated;

-- Clients may only write the columns the app actually writes; `score`,
-- timestamps and ids are server-owned.
revoke insert, update on public.topic_comments from anon, authenticated;
grant insert (topic_id, user_id, parent_id, body, archetype_id) on public.topic_comments to authenticated;
grant update (body, is_deleted) on public.topic_comments to authenticated;
