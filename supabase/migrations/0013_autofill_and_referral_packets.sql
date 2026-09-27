-- Application autofill (the facts ATS forms ask for) and shareable referral packets.

-- Application profile ------------------------------------------------------------------
-- Standard application-form facts, typed once by the user. The extension fills them into
-- Greenhouse / Lever / Ashby / Workday forms; the user always reviews and submits.
-- Demographic (EEO) questions are deliberately not stored: the user answers those.
create table public.application_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  first_name text check (length(first_name) <= 100),
  last_name text check (length(last_name) <= 100),
  preferred_name text check (length(preferred_name) <= 100),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (length(phone) <= 40),
  city text check (length(city) <= 100),
  region text check (length(region) <= 100),
  country text check (length(country) <= 100),
  postal_code text check (length(postal_code) <= 20),
  linkedin_url text check (linkedin_url is null or linkedin_url ~* '^https?://'),
  website_url text check (website_url is null or website_url ~* '^https?://'),
  github_url text check (github_url is null or github_url ~* '^https?://'),
  portfolio_url text check (portfolio_url is null or portfolio_url ~* '^https?://'),
  current_company text check (length(current_company) <= 200),
  current_title text check (length(current_title) <= 200),
  years_experience smallint check (years_experience between 0 and 60),
  -- Countries the user may already work in without sponsorship ("United States", "India").
  authorized_countries text[] not null default '{}',
  how_heard text check (length(how_heard) <= 100),
  updated_at timestamptz not null default now()
);

alter table public.application_profiles enable row level security;
create policy "own application profile: all" on public.application_profiles
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- New agents that log to agent_runs for Starter limits.
alter table public.agent_runs drop constraint agent_runs_agent_check;
alter table public.agent_runs add constraint agent_runs_agent_check
  check (agent in ('content_plan', 'post_draft', 'comment_ideas', 'story_bank', 'weekly_plan', 'form_answers', 'referral_packet', 'talent_profile'));

-- Referral packets -----------------------------------------------------------------------
-- A one-page, unlisted link the user sends to someone who might refer them: why they fit
-- (every point traced to their documents), a blurb for the internal referral tool, and the
-- tailored resume. Only live, unexpired packets are readable, and only through the token.
create table public.referral_packets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  connection_id uuid references public.connections (id) on delete set null,
  kit_id uuid references public.application_kits (id) on delete set null,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'generating' check (status in ('generating', 'draft', 'live', 'revoked', 'failed')),
  referrer_name text check (length(referrer_name) <= 200),
  candidate_name text check (length(candidate_name) <= 200),
  candidate_headline text check (length(candidate_headline) <= 300),
  linkedin_url text check (linkedin_url is null or linkedin_url ~* '^https?://'),
  headline text check (length(headline) <= 300),
  -- [{ "point": "...", "evidence": "verbatim quote from the user's documents" }]
  fit_points jsonb not null default '[]',
  blurb text check (length(blurb) <= 1500),
  note_to_referrer text check (length(note_to_referrer) <= 1500),
  include_resume boolean not null default true,
  verification jsonb,
  error text,
  views integer not null default 0,
  last_viewed_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index referral_packets_user_idx on public.referral_packets (user_id, created_at desc);
create index referral_packets_job_idx on public.referral_packets (job_id);

alter table public.referral_packets enable row level security;
create policy "own packets: all" on public.referral_packets
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- The token and view counts can't be changed by users (views are counted by record_referral_packet_view).
revoke update on public.referral_packets from authenticated;
grant update (kit_id, status, referrer_name, candidate_name, candidate_headline, linkedin_url, headline, fit_points, blurb, note_to_referrer, include_resume, verification, error, expires_at, updated_at)
  on public.referral_packets to authenticated;

-- Public read of a live packet by its token (for /r/<token>). Never exposes the job description or user id.
create function public.get_referral_packet(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'candidate_name', p.candidate_name,
    'candidate_headline', p.candidate_headline,
    'linkedin_url', p.linkedin_url,
    'referrer_name', p.referrer_name,
    'headline', p.headline,
    'fit_points', (select coalesce(jsonb_agg(fp -> 'point'), '[]'::jsonb) from jsonb_array_elements(p.fit_points) fp),
    'blurb', p.blurb,
    'note_to_referrer', p.note_to_referrer,
    'has_resume', p.include_resume and exists (select 1 from public.application_kits k where k.id = p.kit_id and k.status = 'complete'),
    'job_title', j.title,
    'job_company', j.company,
    'job_url', j.url,
    'expires_at', p.expires_at
  )
  from public.referral_packets p
  join public.jobs j on j.id = p.job_id
  where p.token = p_token and p.status = 'live' and p.expires_at > now();
$$;

-- The tailored resume behind a live packet (rendered to .docx by the app).
create function public.get_referral_packet_resume(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('result', k.result, 'company', j.company)
  from public.referral_packets p
  join public.jobs j on j.id = p.job_id
  join public.application_kits k on k.id = p.kit_id and k.status = 'complete'
  where p.token = p_token and p.status = 'live' and p.expires_at > now() and p.include_resume;
$$;

create function public.record_referral_packet_view(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.referral_packets
     set views = views + 1, last_viewed_at = now()
   where token = p_token and status = 'live' and expires_at > now();
$$;

revoke execute on function public.get_referral_packet(text) from public;
revoke execute on function public.get_referral_packet_resume(text) from public;
revoke execute on function public.record_referral_packet_view(text) from public;
grant execute on function public.get_referral_packet(text) to anon, authenticated;
grant execute on function public.get_referral_packet_resume(text) to anon, authenticated;
grant execute on function public.record_referral_packet_view(text) to anon, authenticated;
