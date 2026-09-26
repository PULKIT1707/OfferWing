-- Career Coach: one AI weekly plan per user per week (latest wins).

create table public.weekly_plans (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  plan jsonb not null,
  model text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.weekly_plans enable row level security;
create policy "own weekly plans: all" on public.weekly_plans for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
