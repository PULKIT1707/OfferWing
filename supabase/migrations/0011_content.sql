-- Content & brand: post ideas and drafts, plus a generic run log for Starter-credit limits.

create table public.content_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'idea' check (status in ('idea', 'draft', 'posted', 'archived')),
  pillar text,
  format text not null default 'text' check (format in ('text', 'carousel', 'poll', 'story')),
  hook text not null check (length(hook) between 1 and 500),
  angle text,
  body text,
  hook_options text[] not null default '{}',
  hashtags text[] not null default '{}',
  planned_for date,
  posted_url text check (posted_url is null or posted_url ~* '^https?://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_posts_user_idx on public.content_posts (user_id, planned_for);

-- One row per AI run for agents without their own table (content plans, post drafts, comment ideas,
-- story extraction), so Starter daily limits can be enforced.
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  agent text not null check (agent in ('content_plan', 'post_draft', 'comment_ideas', 'story_bank', 'weekly_plan')),
  credential text not null check (credential in ('starter', 'cloud')),
  provider text not null,
  model text not null,
  created_at timestamptz not null default now()
);
create index agent_runs_user_agent_created_idx on public.agent_runs (user_id, agent, created_at desc);

alter table public.content_posts enable row level security;
alter table public.agent_runs enable row level security;
create policy "own posts: all" on public.content_posts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own runs: read" on public.agent_runs for select to authenticated using ((select auth.uid()) = user_id);
create policy "own runs: insert" on public.agent_runs for insert to authenticated with check ((select auth.uid()) = user_id);
