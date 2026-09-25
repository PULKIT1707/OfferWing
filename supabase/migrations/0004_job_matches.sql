-- Job Match agent: fit analyses per job, plus cached document text shared by all agents.

alter table public.career_documents add column extracted_text text;

create table public.job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'complete', 'failed')),
  credential text not null check (credential in ('starter', 'cloud')),
  provider text not null check (provider in ('openai', 'anthropic', 'gemini')),
  model text not null,
  result jsonb,
  error text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index job_matches_job_created_idx on public.job_matches (job_id, created_at desc);
create index job_matches_user_created_idx on public.job_matches (user_id, created_at desc);

alter table public.job_matches enable row level security;
create policy "own matches: read" on public.job_matches
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own matches: insert" on public.job_matches
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own matches: update" on public.job_matches
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
