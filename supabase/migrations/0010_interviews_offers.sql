-- Interviews & offers: STAR story bank, interview prep packs, practice feedback, offers and negotiation plans.

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  situation text not null default '',
  task text not null default '',
  action text not null default '',
  result text not null default '',
  competencies text[] not null default '{}',
  source text not null default 'manual' check (source in ('extracted', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stories_user_idx on public.stories (user_id);

create table public.interview_preps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'complete', 'failed')),
  round text not null check (round in ('recruiter_screen', 'hiring_manager', 'technical', 'behavioral', 'panel', 'final')),
  interviewer_notes text,
  credential text not null check (credential in ('starter', 'cloud')),
  provider text not null check (provider in ('openai', 'anthropic', 'gemini')),
  model text not null,
  researched boolean not null default false,
  result jsonb,
  error text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index interview_preps_job_created_idx on public.interview_preps (job_id, created_at desc);
create index interview_preps_user_idx on public.interview_preps (user_id);

create table public.practice_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete cascade,
  question text not null check (length(question) between 1 and 1000),
  answer text not null check (length(answer) between 1 and 8000),
  feedback jsonb not null,
  credential text not null check (credential in ('starter', 'cloud')),
  provider text not null check (provider in ('openai', 'anthropic', 'gemini')),
  model text not null,
  created_at timestamptz not null default now()
);
create index practice_answers_user_created_idx on public.practice_answers (user_id, created_at desc);
create index practice_answers_job_idx on public.practice_answers (job_id);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  company text not null check (length(company) between 1 and 200),
  title text not null check (length(title) between 1 and 200),
  currency text not null default 'USD',
  base_salary integer check (base_salary >= 0),
  bonus_target integer check (bonus_target >= 0),
  sign_on integer check (sign_on >= 0),
  equity text,
  benefits text,
  work_mode text,
  deadline date,
  status text not null default 'pending' check (status in ('pending', 'negotiating', 'accepted', 'declined')),
  notes text,
  negotiation jsonb,
  negotiation_model text,
  negotiation_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index offers_user_idx on public.offers (user_id);
create index offers_job_idx on public.offers (job_id);

alter table public.stories enable row level security;
alter table public.interview_preps enable row level security;
alter table public.practice_answers enable row level security;
alter table public.offers enable row level security;

create policy "own stories: all" on public.stories for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own preps: all" on public.interview_preps for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own practice: all" on public.practice_answers for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own offers: all" on public.offers for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
