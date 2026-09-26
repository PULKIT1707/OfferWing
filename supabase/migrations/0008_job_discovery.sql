-- Job Discovery: an inbox of jobs found from forwarded LinkedIn alerts and company career boards.

-- New stages: "discovered" (inbox, not yet triaged) and "dismissed" (triaged away).
alter table public.jobs drop constraint jobs_stage_check;
alter table public.jobs add constraint jobs_stage_check
  check (stage in ('discovered', 'saved', 'applied', 'screen', 'interview', 'offer', 'rejected', 'withdrawn', 'dismissed'));

-- Stable ID from the source ("linkedin:4012345678", "greenhouse:stripe:12345") so re-discovery doesn't duplicate.
alter table public.jobs add column external_id text;
create unique index jobs_user_external_idx on public.jobs (user_id, external_id) where external_id is not null;

-- Company career boards the user follows (public ATS job feeds).
create table public.job_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('greenhouse', 'lever', 'ashby')),
  board_token text not null check (board_token ~ '^[A-Za-z0-9._-]{1,100}$'),
  company_name text not null,
  only_matching boolean not null default true,
  last_checked_at timestamptz,
  last_found integer,
  last_error text,
  created_at timestamptz not null default now(),
  unique (user_id, kind, board_token)
);

-- Emails received at the user's alert address (metadata only; bodies aren't stored).
create table public.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  from_address text,
  subject text,
  kind text not null check (kind in ('linkedin_alert', 'forwarding_confirmation', 'other')),
  jobs_found integer not null default 0,
  detail jsonb,
  received_at timestamptz not null default now()
);
create index inbound_emails_user_received_idx on public.inbound_emails (user_id, received_at desc);

-- The user's time zone (IANA name), for "due today" and scheduled work.
alter table public.profiles add column time_zone text;
grant update (time_zone) on public.profiles to authenticated;

alter table public.job_sources enable row level security;
alter table public.inbound_emails enable row level security;

create policy "own job sources: all" on public.job_sources
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Inbound emails are written by the server (service role); users can read and delete theirs.
create policy "own inbound emails: read" on public.inbound_emails
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own inbound emails: delete" on public.inbound_emails
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Data retention, run daily by /api/cron/cleanup (service role only):
-- imported connections not re-imported in 90 days (unless on a referral list), and inbound email records after 30 days.
create function public.purge_stale_data()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with c as (
    delete from public.connections con
    where con.imported_at < now() - interval '90 days'
      and not exists (select 1 from public.contacts ct where ct.connection_id = con.id)
    returning 1
  ), e as (
    delete from public.inbound_emails where received_at < now() - interval '30 days' returning 1
  )
  select jsonb_build_object('connectionsDeleted', (select count(*) from c), 'inboundEmailsDeleted', (select count(*) from e));
$$;

revoke execute on function public.purge_stale_data() from public, anon, authenticated;
grant execute on function public.purge_stale_data() to service_role;
