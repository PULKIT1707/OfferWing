-- Offerwing dashboard: job pipeline, network contacts, account deletion.

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  company text not null check (length(company) between 1 and 200),
  url text check (url is null or url ~* '^https?://'),
  location text,
  source text not null default 'manual' check (source in ('manual', 'extension', 'alert', 'ats')),
  stage text not null default 'saved'
    check (stage in ('saved', 'applied', 'screen', 'interview', 'offer', 'rejected', 'withdrawn')),
  channel text check (channel in ('referral', 'easy_apply', 'company_site', 'recruiter', 'other')),
  fit_score smallint check (fit_score between 0 and 100),
  description text,
  notes text,
  applied_at timestamptz,
  next_action text,
  next_action_at date,
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_user_stage_idx on public.jobs (user_id, stage);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null check (length(full_name) between 1 and 200),
  company text,
  title text,
  relationship text not null default 'connection'
    check (relationship in ('connection', 'mutual', 'alumni', 'ex_colleague', 'recruiter', 'hiring_manager', 'other')),
  strength smallint not null default 2 check (strength between 1 and 3),
  linkedin_url text check (linkedin_url is null or linkedin_url ~* '^https?://'),
  referral_status text not null default 'none'
    check (referral_status in ('none', 'to_ask', 'asked', 'agreed', 'referred', 'declined')),
  job_id uuid references public.jobs (id) on delete set null,
  notes text,
  last_contacted_at date,
  next_follow_up_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_user_idx on public.contacts (user_id);
create index contacts_job_idx on public.contacts (job_id);

alter table public.jobs enable row level security;
alter table public.contacts enable row level security;

create policy "own jobs: all" on public.jobs
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own contacts: all" on public.contacts
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Permanently deletes the caller's account; profile rows cascade from auth.users.
-- Storage files are removed by the app (Storage API) before this is called.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  delete from vault.secrets where id in (select key_secret_id from public.ai_settings where user_id = v_uid and key_secret_id is not null);
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
