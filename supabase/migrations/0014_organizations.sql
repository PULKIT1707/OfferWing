-- Organizations: B2B outplacement sponsors (an employer gives laid-off staff Offerwing with
-- sponsored AI) and recruiting teams (verified by Offerwing before they can search the
-- opt-in talent marketplace, see 0015).

-- "Stripe, Inc." → "stripe". Must match companyKey() in apps/web/src/lib/dashboard.ts.
create function public.company_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(coalesce(
    nullif(trim(regexp_replace(
      regexp_replace(
        regexp_replace(regexp_replace(lower(p_name), '&', ' and ', 'g'), '^the\s+', ''),
        '\y(inc|incorporated|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|plc|gmbh|ag|sa|s\.a|bv|pvt|private|pty|group|holdings|technologies|technology|labs)\y\.?', ' ', 'g'),
      '[^a-z0-9]+', ' ', 'g')), ''),
    trim(lower(p_name))), '');
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('outplacement', 'recruiting')),
  name text not null check (length(name) between 2 and 120),
  website text check (website is null or website ~* '^https?://'),
  brand_color text check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'),
  -- Set by Offerwing staff (service role) from the contract; admins can't raise it.
  seat_limit integer not null default 10 check (seat_limit between 0 and 100000),
  -- Outplacement: members' AI runs on the organization's key until this date (inclusive).
  sponsorship_ends_at date,
  -- Recruiting: Offerwing verifies the team is who it says before it can search talent.
  verified boolean not null default false,
  ai_provider text check (ai_provider in ('openai', 'anthropic', 'gemini')),
  ai_key_last4 text,
  ai_key_secret_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.org_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  -- Outplacement members choose whether admins see their individual progress (off by default).
  share_progress boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on public.org_members (user_id);

create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  role text not null default 'member' check (role in ('admin', 'member')),
  label text check (length(label) <= 120),
  max_uses integer not null default 1 check (max_uses between 1 and 10000),
  uses integer not null default 0,
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index org_invites_org_idx on public.org_invites (org_id, created_at desc);

-- Membership helpers (security definer so policies don't recurse through org_members' own RLS).
create function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.org_members where org_id = p_org and user_id = (select auth.uid()));
$$;

create function public.is_org_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.org_members where org_id = p_org and user_id = (select auth.uid()) and role in ('owner', 'admin'));
$$;

alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.org_invites enable row level security;

create policy "orgs: members read" on public.organizations
  for select to authenticated using (public.is_org_member(id));
create policy "orgs: admins update" on public.organizations
  for update to authenticated using (public.is_org_admin(id)) with check (public.is_org_admin(id));
-- Organizations are created with create_organization(); only branding is editable directly.
revoke insert, update, delete on public.organizations from authenticated;
grant update (name, website, brand_color, updated_at) on public.organizations to authenticated;
-- The Vault secret id stays server-side.
revoke select on public.organizations from authenticated;
grant select (id, kind, name, website, brand_color, seat_limit, sponsorship_ends_at, verified, ai_provider, ai_key_last4, created_at) on public.organizations to authenticated;

create policy "org members: read own or as admin" on public.org_members
  for select to authenticated using (user_id = (select auth.uid()) or public.is_org_admin(org_id));
create policy "org members: change own sharing" on public.org_members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "org members: leave, or admins remove members" on public.org_members
  for delete to authenticated using (
    (user_id = (select auth.uid()) and role <> 'owner')
    or (public.is_org_admin(org_id) and role = 'member')
  );
revoke insert, update on public.org_members from authenticated;
grant update (share_progress) on public.org_members to authenticated;

create policy "org invites: admins read" on public.org_invites
  for select to authenticated using (public.is_org_admin(org_id));
create policy "org invites: admins create" on public.org_invites
  for insert to authenticated with check (public.is_org_admin(org_id) and created_by = (select auth.uid()));
create policy "org invites: admins revoke" on public.org_invites
  for update to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy "org invites: admins delete" on public.org_invites
  for delete to authenticated using (public.is_org_admin(org_id));
revoke update on public.org_invites from authenticated;
grant update (revoked_at, label) on public.org_invites to authenticated;

-- A verified recruiting team that renames itself must be re-verified (the name drives who candidates hide from).
create function public.org_name_change_unverifies()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name and current_user <> 'service_role' then
    new.verified := false;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger organizations_name_change before update on public.organizations
  for each row execute function public.org_name_change_unverifies();

-- Functions ------------------------------------------------------------------------------
create function public.create_organization(p_kind text, p_name text, p_website text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_kind not in ('outplacement', 'recruiting') then raise exception 'invalid kind'; end if;
  if (select count(*) from public.org_members where user_id = v_uid and role = 'owner') >= 5 then
    raise exception 'too many organizations';
  end if;
  insert into public.organizations (kind, name, website, created_by)
  values (p_kind, trim(p_name), nullif(trim(p_website), ''), v_uid)
  returning id into v_org;
  insert into public.org_members (org_id, user_id, role) values (v_org, v_uid, 'owner');
  return v_org;
end;
$$;

-- What the /join/<code> page shows before someone accepts. Safe for anonymous visitors.
create function public.get_invite_preview(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'org_name', o.name,
    'kind', o.kind,
    'brand_color', o.brand_color,
    'role', i.role,
    'sponsored', o.kind = 'outplacement' and o.ai_key_secret_id is not null and (o.sponsorship_ends_at is null or o.sponsorship_ends_at >= current_date),
    'valid', i.revoked_at is null and i.expires_at > now() and i.uses < i.max_uses
  )
  from public.org_invites i
  join public.organizations o on o.id = i.org_id
  where i.code = p_code;
$$;

create function public.redeem_org_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.org_invites;
  v_org public.organizations;
  v_seats integer;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_inv from public.org_invites where code = p_code for update;
  if v_inv.id is null or v_inv.revoked_at is not null or v_inv.expires_at <= now() or v_inv.uses >= v_inv.max_uses then
    raise exception 'invite invalid';
  end if;
  select * into v_org from public.organizations where id = v_inv.org_id;
  if exists (select 1 from public.org_members where org_id = v_org.id and user_id = v_uid) then
    return v_org.id;
  end if;
  if v_inv.role = 'member' then
    select count(*) into v_seats from public.org_members where org_id = v_org.id and role = 'member';
    if v_seats >= v_org.seat_limit then raise exception 'no seats left'; end if;
    -- One outplacement sponsor per person, so it's always clear whose credits a run uses.
    if v_org.kind = 'outplacement' and exists (
      select 1 from public.org_members m join public.organizations o on o.id = m.org_id
      where m.user_id = v_uid and m.role = 'member' and o.kind = 'outplacement'
    ) then
      raise exception 'already sponsored';
    end if;
  end if;
  insert into public.org_members (org_id, user_id, role) values (v_org.id, v_uid, v_inv.role);
  update public.org_invites set uses = uses + 1 where id = v_inv.id;
  return v_org.id;
end;
$$;

create function public.set_org_ai_key(p_org uuid, p_provider text, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret uuid;
begin
  if not public.is_org_admin(p_org) then raise exception 'not allowed'; end if;
  if p_provider not in ('openai', 'anthropic', 'gemini') then raise exception 'invalid provider'; end if;
  if p_key is null or length(p_key) < 20 then raise exception 'invalid key'; end if;
  select ai_key_secret_id into v_secret from public.organizations where id = p_org;
  if v_secret is null then
    v_secret := vault.create_secret(p_key, 'org_ai_key_' || p_org::text, 'Offerwing organization AI key');
  else
    perform vault.update_secret(v_secret, p_key, 'org_ai_key_' || p_org::text, 'Offerwing organization AI key');
  end if;
  update public.organizations set ai_provider = p_provider, ai_key_last4 = right(p_key, 4), ai_key_secret_id = v_secret where id = p_org;
end;
$$;

create function public.remove_org_ai_key(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret uuid;
begin
  if not public.is_org_admin(p_org) then raise exception 'not allowed'; end if;
  select ai_key_secret_id into v_secret from public.organizations where id = p_org;
  if v_secret is not null then delete from vault.secrets where id = v_secret; end if;
  update public.organizations set ai_provider = null, ai_key_last4 = null, ai_key_secret_id = null where id = p_org;
end;
$$;

-- The sponsor key for a member's AI run. Service role only; the app checks the sponsorship first.
create function public.get_org_ai_key(p_org_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from public.organizations o
  join vault.decrypted_secrets s on s.id = o.ai_key_secret_id
  where o.id = p_org_id;
$$;

-- The caller's active outplacement sponsor, if any (used to pick the AI credential).
create function public.get_my_sponsor()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('org_id', o.id, 'name', o.name, 'brand_color', o.brand_color, 'provider', o.ai_provider, 'ends_at', o.sponsorship_ends_at)
  from public.org_members m
  join public.organizations o on o.id = m.org_id
  where m.user_id = (select auth.uid())
    and m.role = 'member'
    and o.kind = 'outplacement'
    and o.ai_key_secret_id is not null
    and (o.sponsorship_ends_at is null or o.sponsorship_ends_at >= current_date)
  limit 1;
$$;

-- Outplacement dashboard. Aggregates only once 5 members have joined (so no one can be singled
-- out); individual rows only for members who turned on share_progress.
create function public.org_progress(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_members integer;
  v_result jsonb;
begin
  if not public.is_org_admin(p_org) then raise exception 'not allowed'; end if;
  select count(*) into v_members from public.org_members where org_id = p_org and role = 'member';

  with m as (
    select om.user_id, om.share_progress, om.joined_at from public.org_members om where om.org_id = p_org and om.role = 'member'
  ), per as (
    select
      m.user_id,
      m.share_progress,
      m.joined_at,
      p.full_name,
      u.email,
      u.last_sign_in_at,
      p.onboarding_step = 'done' as onboarded,
      (select count(*) from public.jobs j where j.user_id = m.user_id and j.stage not in ('discovered', 'dismissed')) as jobs_saved,
      (select count(*) from public.jobs j where j.user_id = m.user_id and j.applied_at is not null) as applied,
      (select count(*) from public.jobs j where j.user_id = m.user_id and j.stage in ('screen', 'interview', 'offer')) as interviewing,
      (select count(*) from public.offers f where f.user_id = m.user_id) as offers,
      exists (select 1 from public.offers f where f.user_id = m.user_id and f.status = 'accepted') as placed
    from m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
  )
  select jsonb_build_object(
    'members', v_members,
    'aggregate', case when v_members >= 5 then jsonb_build_object(
      'onboarded', (select count(*) from per where onboarded),
      'active_7d', (select count(*) from per where last_sign_in_at > now() - interval '7 days'),
      'applied', (select coalesce(sum(applied), 0) from per),
      'interviewing', (select count(*) from per where interviewing > 0),
      'with_offer', (select count(*) from per where offers > 0),
      'placed', (select count(*) from per where placed)
    ) else null end,
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', full_name, 'email', email, 'joined_at', joined_at, 'last_active', last_sign_in_at, 'onboarded', onboarded,
        'jobs_saved', jobs_saved, 'applied', applied, 'interviewing', interviewing, 'offers', offers, 'placed', placed
      ) order by joined_at)
      from per where share_progress
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- Member names and emails for the admin's member list (no progress data).
create function public.org_member_list(p_org uuid)
returns table (user_id uuid, full_name text, email text, role text, share_progress boolean, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_org_admin(p_org) then raise exception 'not allowed'; end if;
  return query
    select m.user_id, p.full_name, u.email::text, m.role, m.share_progress, m.joined_at
    from public.org_members m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.org_id = p_org
    order by m.role, m.joined_at;
end;
$$;

revoke execute on function public.company_key(text) from public, anon;
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.is_org_admin(uuid) from public, anon;
revoke execute on function public.create_organization(text, text, text) from public, anon;
revoke execute on function public.get_invite_preview(text) from public;
revoke execute on function public.redeem_org_invite(text) from public, anon;
revoke execute on function public.set_org_ai_key(uuid, text, text) from public, anon;
revoke execute on function public.remove_org_ai_key(uuid) from public, anon;
revoke execute on function public.get_org_ai_key(uuid) from public, anon, authenticated;
revoke execute on function public.get_my_sponsor() from public, anon;
revoke execute on function public.org_progress(uuid) from public, anon;
revoke execute on function public.org_member_list(uuid) from public, anon;
revoke execute on function public.org_name_change_unverifies() from public, anon, authenticated;

grant execute on function public.company_key(text) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.create_organization(text, text, text) to authenticated;
grant execute on function public.get_invite_preview(text) to anon, authenticated;
grant execute on function public.redeem_org_invite(text) to authenticated;
grant execute on function public.set_org_ai_key(uuid, text, text) to authenticated;
grant execute on function public.remove_org_ai_key(uuid) to authenticated;
grant execute on function public.get_org_ai_key(uuid) to service_role;
grant execute on function public.get_my_sponsor() to authenticated;
grant execute on function public.org_progress(uuid) to authenticated;
grant execute on function public.org_member_list(uuid) to authenticated;

-- Deleting an account also deletes organizations the user solely owns, with their Vault keys.
create or replace function public.delete_my_account()
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
  with solo as (
    select m.org_id from public.org_members m
    where m.user_id = v_uid and m.role = 'owner'
      and not exists (select 1 from public.org_members o where o.org_id = m.org_id and o.role = 'owner' and o.user_id <> v_uid)
  )
  delete from vault.secrets where id in (select ai_key_secret_id from public.organizations where id in (select org_id from solo) and ai_key_secret_id is not null);
  delete from public.organizations where id in (
    select m.org_id from public.org_members m
    where m.user_id = v_uid and m.role = 'owner'
      and not exists (select 1 from public.org_members o where o.org_id = m.org_id and o.role = 'owner' and o.user_id <> v_uid)
  );
  delete from auth.users where id = v_uid;
end;
$$;
