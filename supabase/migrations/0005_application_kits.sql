-- Application Tailoring agent: tailored resume, cover note and screening answers per job.

create table public.application_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'complete', 'failed')),
  credential text not null check (credential in ('starter', 'cloud')),
  provider text not null check (provider in ('openai', 'anthropic', 'gemini')),
  model text not null,
  result jsonb,
  -- Output of the truthfulness check: which bullets and numbers trace back to the user's documents.
  verification jsonb,
  error text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index application_kits_job_created_idx on public.application_kits (job_id, created_at desc);
create index application_kits_user_created_idx on public.application_kits (user_id, created_at desc);

alter table public.application_kits enable row level security;
create policy "own kits: read" on public.application_kits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own kits: insert" on public.application_kits
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own kits: update" on public.application_kits
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
