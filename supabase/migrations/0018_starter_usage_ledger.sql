-- Starter metering that users can't rewrite.
--
-- Until now Starter limits counted the user's own run rows (profile_audits, job_matches,
-- application_kits, outreach_drafts, agent_runs, ...) where credential = 'starter' and
-- created_at is today. Those tables carry "own rows: update" (and for agent_runs "insert")
-- policies, and the publishable key plus the user's JWT reach PostgREST directly, so a signed-in
-- user could PATCH their rows to credential = 'cloud' or backdate created_at and reset their own
-- count: unlimited runs on Offerwing's Starter key. Counting first and inserting later was also a
-- check-then-act race, so parallel requests could all pass the check.
--
-- Now every Starter run is claimed through claim_starter_runs(), which counts and inserts in one
-- transaction under a per-user, per-agent advisory lock. The ledger has no write policies and no
-- write grants for signed-in users, and the limits live in the database, so the client can't pass
-- its own. The run tables keep their credential column for display only; nothing counts them.

create table public.starter_limits (
  agent text primary key,
  daily_limit integer not null check (daily_limit >= 0)
);

-- Keep in sync with STARTER_LIMITS in apps/web/src/lib/llm/quota.ts (quota.test.ts checks it).
insert into public.starter_limits (agent, daily_limit) values
  ('profile_audit', 2),
  ('job_match', 20),
  ('application_kit', 5),
  ('outreach_draft', 20),
  ('interview_prep', 5),
  ('practice_answer', 20),
  ('negotiation', 5),
  ('content_plan', 3),
  ('post_draft', 10),
  ('comment_ideas', 20),
  ('story_bank', 3),
  ('weekly_plan', 3),
  ('form_answers', 10),
  ('referral_packet', 10),
  ('talent_profile', 3),
  ('profile_prefill', 5);

alter table public.starter_limits enable row level security;
create policy "starter limits: read" on public.starter_limits for select to authenticated using (true);
revoke insert, update, delete, truncate on public.starter_limits from anon, authenticated;

create table public.starter_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent text not null references public.starter_limits (agent),
  -- The UTC day the run counts against. Limits reset at 00:00 UTC.
  used_on date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now()
);

create index starter_usage_user_agent_day_idx on public.starter_usage (user_id, agent, used_on);

alter table public.starter_usage enable row level security;
-- Read-only for the owner. There are deliberately no insert, update or delete policies:
-- rows are written only by the security-definer functions below.
create policy "own starter usage: read" on public.starter_usage for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete, truncate on public.starter_usage from anon, authenticated;

-- Claims up to p_count Starter runs of one agent for the signed-in user and returns the ids it
-- granted (fewer than asked, or none, when the daily limit is near or reached). Counting and
-- inserting happen under one advisory lock, so concurrent requests can't both take the last run.
create function public.claim_starter_runs(p_agent text, p_count integer default 1)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer;
  v_used integer;
  v_grant integer;
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select l.daily_limit into v_limit from public.starter_limits l where l.agent = p_agent;
  if v_limit is null then raise exception 'unknown Starter agent: %', p_agent; end if;
  if p_count is null or p_count < 1 then return; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_agent, 0));

  select count(*) into v_used
  from public.starter_usage u
  where u.user_id = v_uid and u.agent = p_agent and u.used_on = v_today;

  v_grant := least(p_count, greatest(0, v_limit - v_used));
  if v_grant = 0 then return; end if;

  return query
    insert into public.starter_usage (user_id, agent, used_on)
    select v_uid, p_agent, v_today from generate_series(1, v_grant)
    returning id;
end;
$$;

revoke execute on function public.claim_starter_runs(text, integer) from public, anon;
grant execute on function public.claim_starter_runs(text, integer) to authenticated;

-- How many Starter runs of one agent the signed-in user has left today (for display).
create function public.starter_runs_left(p_agent text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, l.daily_limit - (
    select count(*)::integer from public.starter_usage u
    where u.user_id = auth.uid() and u.agent = l.agent and u.used_on = (now() at time zone 'utc')::date
  ))
  from public.starter_limits l
  where l.agent = p_agent and auth.uid() is not null;
$$;

revoke execute on function public.starter_runs_left(text) from public, anon;
grant execute on function public.starter_runs_left(text) to authenticated;

-- Gives back claimed runs whose model call failed before producing anything. Service role only:
-- a user who could call this could refund their successful runs too.
create function public.release_starter_runs(p_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.starter_usage where id = any (p_ids);
$$;

revoke execute on function public.release_starter_runs(uuid[]) from public, anon, authenticated;
grant execute on function public.release_starter_runs(uuid[]) to service_role;
