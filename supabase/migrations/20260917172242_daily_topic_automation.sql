-- Daily Topic of the Day automation: run log, cron secret, and the pg_cron job
-- that calls the `daily-topic` edge function every morning.
-- (Already applied to the CommonSquare project; kept here as the record.)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Run log. Service-role only (RLS on, no policies): the edge function writes it,
-- admins read it from the dashboard.
create table if not exists public.topic_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('published', 'skipped', 'failed', 'dry_run')),
  topic_id uuid references public.topics (id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.topic_ingest_runs enable row level security;
create index if not exists topic_ingest_runs_created_at_idx
  on public.topic_ingest_runs (created_at desc);

-- Shared secret between pg_cron and the edge function. Generated inside the
-- database and stored in Vault; nobody ever needs to see or paste it.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'cron_secret',
      'Shared secret pg_cron sends to the daily-topic edge function'
    );
  end if;
end $$;

-- The edge function (service role) reads the secret through this.
create or replace function public.get_cron_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
$$;
revoke all on function public.get_cron_secret() from public, anon, authenticated;
grant execute on function public.get_cron_secret() to service_role;

-- Fire the edge function. Also handy for manual runs from the SQL editor:
--   select public.trigger_daily_topic('{"force": true, "background": true}');
create or replace function public.trigger_daily_topic(p_body jsonb default '{"background": true}'::jsonb)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://fyhjusydcmbcsisflmao.supabase.co/functions/v1/daily-topic',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body := p_body,
    timeout_milliseconds := 30000
  );
$$;
revoke all on function public.trigger_daily_topic(jsonb) from public, anon, authenticated;

-- 10:00 UTC = 6am ET (5am EST). A second attempt at 12:00 UTC is a no-op when
-- the first one published (the function skips if a topic went out in the last 20h).
select cron.schedule('daily-topic', '0 10 * * *', $$select public.trigger_daily_topic()$$);
select cron.schedule('daily-topic-retry', '0 12 * * *', $$select public.trigger_daily_topic()$$);
