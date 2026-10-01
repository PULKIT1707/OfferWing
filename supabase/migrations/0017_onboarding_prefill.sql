-- Onboarding feedback: several seniority levels per person, resume-first onboarding, and an
-- agent-run type for prefilling the profile from the resume / LinkedIn PDF.

-- Seniority becomes a list ("senior" + "lead"). Existing single values carry over.
alter table public.search_profiles drop constraint if exists search_profiles_seniority_check;
alter table public.search_profiles
  alter column seniority type text[] using (case when seniority is null then '{}'::text[] else array[seniority] end),
  alter column seniority set default '{}',
  alter column seniority set not null;
alter table public.search_profiles add constraint search_profiles_seniority_check
  check (seniority <@ array['intern', 'entry', 'mid', 'senior', 'lead', 'manager', 'director', 'executive']::text[] and cardinality(seniority) <= 4);

alter table public.talent_profiles
  alter column seniority type text[] using (case when seniority is null then '{}'::text[] else array[seniority] end),
  alter column seniority set default '{}',
  alter column seniority set not null;

-- New accounts start by uploading a resume, which prefills the rest.
alter table public.profiles alter column onboarding_step set default 'documents';

alter table public.agent_runs drop constraint agent_runs_agent_check;
alter table public.agent_runs add constraint agent_runs_agent_check
  check (agent in ('content_plan', 'post_draft', 'comment_ideas', 'story_bank', 'weekly_plan', 'form_answers', 'referral_packet', 'talent_profile', 'profile_prefill'));

-- search_talent returns seniority as a list now.
drop function public.search_talent(uuid, text, text, boolean, integer);
create function public.search_talent(p_org uuid, p_query text, p_location text, p_remote_only boolean, p_limit integer)
returns table (
  public_id text, headline text, summary text, roles text[], seniority text[], years_experience smallint, industries text[],
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

revoke execute on function public.search_talent(uuid, text, text, boolean, integer) from public, anon;
grant execute on function public.search_talent(uuid, text, text, boolean, integer) to authenticated;
