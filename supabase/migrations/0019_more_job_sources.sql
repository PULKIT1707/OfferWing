-- More public career boards (SmartRecruiters, Workable, Recruitee), and words that keep a title
-- out of the inbox ("intern", "contract", "interior").

alter table public.job_sources drop constraint if exists job_sources_kind_check;
alter table public.job_sources add constraint job_sources_kind_check
  check (kind in ('greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'recruitee'));

alter table public.search_profiles
  add column if not exists title_exclude text[] not null default '{}';
alter table public.search_profiles drop constraint if exists search_profiles_title_exclude_check;
alter table public.search_profiles add constraint search_profiles_title_exclude_check
  check (cardinality(title_exclude) <= 30);
