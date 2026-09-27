-- Opt-in talent marketplace: candidates publish an anonymous, fact-checked profile; verified
-- recruiting teams (0014) search it and request intros; the candidate decides. Recruiters never
-- see a name, employer or contact detail until the candidate accepts.

create table public.talent_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- What recruiters see instead of the user id.
  public_id text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  visible boolean not null default false,
  status text not null default 'generating' check (status in ('generating', 'draft', 'failed')),
  headline text check (length(headline) <= 200),
  summary text check (length(summary) <= 1500),
  roles text[] not null default '{}',
  seniority text,
  years_experience smallint check (years_experience between 0 and 60),
  industries text[] not null default '{}',
  locations text[] not null default '{}',
  work_modes text[] not null default '{}',
  open_to_relocate boolean not null default false,
  needs_sponsorship boolean not null default false,
  salary_min integer check (salary_min >= 0),
  salary_currency text not null default 'USD',
  -- Only skills found in the user's documents.
  skills text[] not null default '{}',
  -- [{ "text": "anonymized achievement", "evidence": "verbatim quote (never shown to recruiters)" }]
  highlights jsonb not null default '[]',
  availability text not null default 'now' check (availability in ('now', '2_weeks', '1_month', '3_months', 'exploring')),
  -- Recruiting teams whose name matches any of these never see the profile (e.g. the current employer).
  hidden_companies text[] not null default '{}',
  verification jsonb,
  error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index talent_profiles_visible_idx on public.talent_profiles (visible, updated_at desc);

alter table public.talent_profiles enable row level security;
create policy "own talent profile: all" on public.talent_profiles
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke update on public.talent_profiles from authenticated;
grant update (visible, status, headline, summary, roles, seniority, years_experience, industries, locations, work_modes, open_to_relocate,
  needs_sponsorship, salary_min, salary_currency, skills, highlights, availability, hidden_companies, verification, error, published_at, updated_at)
  on public.talent_profiles to authenticated;

create table public.intro_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  talent_user_id uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  role_title text not null check (length(role_title) between 2 and 200),
  role_url text check (role_url is null or role_url ~* '^https?://'),
  location text check (length(location) <= 200),
  salary_range text check (length(salary_range) <= 100),
  message text not null check (length(message) between 20 and 1500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  job_id uuid references public.jobs (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (org_id, talent_user_id, role_title)
);
create index intro_requests_talent_idx on public.intro_requests (talent_user_id, created_at desc);
create index intro_requests_org_idx on public.intro_requests (org_id, created_at desc);

alter table public.intro_requests enable row level security;
create policy "intros: candidate reads own" on public.intro_requests
  for select to authenticated using (talent_user_id = (select auth.uid()));
create policy "intros: org members read" on public.intro_requests
  for select to authenticated using (public.is_org_member(org_id));
-- All writes go through request_intro / respond_intro / withdraw_intro.
revoke insert, update, delete on public.intro_requests from authenticated;

-- Jobs can now come from an accepted intro.
alter table public.jobs drop constraint jobs_source_check;
alter table public.jobs add constraint jobs_source_check check (source in ('manual', 'extension', 'alert', 'ats', 'marketplace'));

-- Is this verified recruiting team hidden by the candidate? Word match on normalized names,
-- so hiding "Stripe" also hides "Stripe Talent Team".
create function public.talent_hidden_from(p_hidden text[], p_org_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1 from unnest(p_hidden) h
    where public.company_key(h) is not null
      and (' ' || public.company_key(p_org_name) || ' ') like ('% ' || public.company_key(h) || ' %')
  );
$$;

create function public.require_verified_recruiter(p_org uuid)
returns public.organizations
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
begin
  select o.* into v_org from public.organizations o
  join public.org_members m on m.org_id = o.id and m.user_id = (select auth.uid())
  where o.id = p_org;
  if v_org.id is null then raise exception 'not allowed'; end if;
  if v_org.kind <> 'recruiting' or not v_org.verified then raise exception 'not verified'; end if;
  return v_org;
end;
$$;

-- Anonymous search. Never returns user ids, names, employers or evidence quotes.
create function public.search_talent(p_org uuid, p_query text, p_location text, p_remote_only boolean, p_limit integer)
returns table (
  public_id text, headline text, summary text, roles text[], seniority text, years_experience smallint, industries text[],
  locations text[], work_modes text[], open_to_relocate boolean, needs_sponsorship boolean, salary_min integer, salary_currency text,
  skills text[], highlights text[], availability text, updated_at timestamptz, intro_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org public.organizations := public.require_verified_recruiter(p_org);
  v_terms text[] := array(select t from unnest(regexp_split_to_array(lower(coalesce(p_query, '')), '[^a-z0-9+#.]+')) t where length(t) > 1);
begin
  return query
    select t.public_id, t.headline, t.summary, t.roles, t.seniority, t.years_experience, t.industries,
           t.locations, t.work_modes, t.open_to_relocate, t.needs_sponsorship, t.salary_min, t.salary_currency,
           t.skills, array(select h ->> 'text' from jsonb_array_elements(t.highlights) h), t.availability, t.updated_at,
           (select i.status from public.intro_requests i where i.org_id = p_org and i.talent_user_id = t.user_id order by i.created_at desc limit 1)
    from public.talent_profiles t
    where t.visible
      and t.status = 'draft'
      and not public.talent_hidden_from(t.hidden_companies, v_org.name)
      and not exists (select 1 from public.org_members m where m.org_id = p_org and m.user_id = t.user_id)
      and (coalesce(trim(p_location), '') = '' or exists (select 1 from unnest(t.locations) l where l ilike '%' || trim(p_location) || '%') or t.open_to_relocate)
      and (not coalesce(p_remote_only, false) or 'remote' = any (t.work_modes))
      and (
        cardinality(v_terms) = 0
        or (
          select bool_and(
            lower(concat_ws(' ', t.headline, t.summary, array_to_string(t.roles, ' '), array_to_string(t.skills, ' '), array_to_string(t.industries, ' '))) like '%' || term || '%'
          ) from unnest(v_terms) term
        )
      )
    order by t.updated_at desc
    limit least(greatest(coalesce(p_limit, 25), 1), 50);
end;
$$;

create function public.request_intro(p_org uuid, p_public_id text, p_role_title text, p_role_url text, p_location text, p_salary_range text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations := public.require_verified_recruiter(p_org);
  v_talent public.talent_profiles;
  v_id uuid;
begin
  select * into v_talent from public.talent_profiles where public_id = p_public_id and visible and status = 'draft';
  if v_talent.user_id is null or public.talent_hidden_from(v_talent.hidden_companies, v_org.name) then
    raise exception 'profile unavailable';
  end if;
  if (select count(*) from public.intro_requests where org_id = p_org and created_at > now() - interval '1 day') >= 25 then
    raise exception 'daily intro limit reached';
  end if;
  insert into public.intro_requests (org_id, talent_user_id, requested_by, role_title, role_url, location, salary_range, message)
  values (p_org, v_talent.user_id, (select auth.uid()), trim(p_role_title), nullif(trim(p_role_url), ''), nullif(trim(p_location), ''), nullif(trim(p_salary_range), ''), trim(p_message))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.withdraw_intro(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.intro_requests set status = 'withdrawn', responded_at = now()
   where id = p_id and status = 'pending' and public.is_org_member(org_id);
end;
$$;

-- The candidate accepts (the role lands in their pipeline and the team sees their contact details) or declines.
create function public.respond_intro(p_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_intro public.intro_requests;
  v_org_name text;
  v_job uuid;
begin
  select * into v_intro from public.intro_requests where id = p_id and talent_user_id = v_uid and status = 'pending' for update;
  if v_intro.id is null then raise exception 'not found'; end if;
  if not p_accept then
    update public.intro_requests set status = 'declined', responded_at = now() where id = p_id;
    return null;
  end if;
  select name into v_org_name from public.organizations where id = v_intro.org_id;
  insert into public.jobs (user_id, title, company, url, location, source, stage, channel, notes)
  values (v_uid, v_intro.role_title, left(v_org_name, 200), v_intro.role_url, v_intro.location, 'marketplace', 'saved', 'recruiter',
          'Intro request via Offerwing talent marketplace.' || coalesce(E'\nSalary range: ' || v_intro.salary_range, '') || E'\n\n' || v_intro.message)
  returning id into v_job;
  update public.intro_requests set status = 'accepted', responded_at = now(), job_id = v_job where id = p_id;
  return v_job;
end;
$$;

-- A team's intro requests; contact details appear only once the candidate accepted.
create function public.org_intros(p_org uuid)
returns table (
  id uuid, public_id text, role_title text, status text, created_at timestamptz, responded_at timestamptz,
  candidate_name text, candidate_email text, candidate_linkedin text, candidate_phone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_org_member(p_org) then raise exception 'not allowed'; end if;
  return query
    select i.id, t.public_id, i.role_title, i.status, i.created_at, i.responded_at,
           case when i.status = 'accepted' then p.full_name end,
           case when i.status = 'accepted' then coalesce(a.email, u.email::text) end,
           case when i.status = 'accepted' then a.linkedin_url end,
           case when i.status = 'accepted' then a.phone end
    from public.intro_requests i
    left join public.talent_profiles t on t.user_id = i.talent_user_id
    join public.profiles p on p.id = i.talent_user_id
    join auth.users u on u.id = i.talent_user_id
    left join public.application_profiles a on a.user_id = i.talent_user_id
    where i.org_id = p_org
    order by i.created_at desc
    limit 200;
end;
$$;

-- What the candidate sees about the team asking.
create function public.my_intro_requests()
returns table (id uuid, org_name text, org_website text, role_title text, role_url text, location text, salary_range text, message text, status text, job_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, o.name, o.website, i.role_title, i.role_url, i.location, i.salary_range, i.message, i.status, i.job_id, i.created_at
  from public.intro_requests i
  join public.organizations o on o.id = i.org_id
  where i.talent_user_id = (select auth.uid())
  order by i.created_at desc
  limit 100;
$$;

revoke execute on function public.talent_hidden_from(text[], text) from public, anon;
revoke execute on function public.require_verified_recruiter(uuid) from public, anon;
revoke execute on function public.search_talent(uuid, text, text, boolean, integer) from public, anon;
revoke execute on function public.request_intro(uuid, text, text, text, text, text, text) from public, anon;
revoke execute on function public.withdraw_intro(uuid) from public, anon;
revoke execute on function public.respond_intro(uuid, boolean) from public, anon;
revoke execute on function public.org_intros(uuid) from public, anon;
revoke execute on function public.my_intro_requests() from public, anon;

grant execute on function public.talent_hidden_from(text[], text) to authenticated;
grant execute on function public.require_verified_recruiter(uuid) to authenticated;
grant execute on function public.search_talent(uuid, text, text, boolean, integer) to authenticated;
grant execute on function public.request_intro(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.withdraw_intro(uuid) to authenticated;
grant execute on function public.respond_intro(uuid, boolean) to authenticated;
grant execute on function public.org_intros(uuid) to authenticated;
grant execute on function public.my_intro_requests() to authenticated;
