-- Offerwing: accounts, onboarding answers, career documents and AI key settings.

-- Profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  -- Unique inbox for forwarded LinkedIn job-alert emails: <alert_alias>@alerts.offerwing.ai
  alert_alias text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  onboarding_step text not null default 'career'
    check (onboarding_step in ('career', 'preferences', 'linkedin', 'documents', 'ai', 'connect', 'done')),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.ai_settings (user_id) values (new.id);
  return new;
end;
$$;

-- Job search profile (the onboarding questionnaire) ----------------------------
create table public.search_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  target_roles text[] not null default '{}',
  seniority text check (seniority in ('intern', 'entry', 'mid', 'senior', 'lead', 'manager', 'director', 'executive')),
  industries text[] not null default '{}',
  locations text[] not null default '{}',
  work_modes text[] not null default '{}',
  open_to_relocate boolean not null default false,
  needs_sponsorship boolean not null default false,
  salary_min integer check (salary_min >= 0),
  salary_target integer check (salary_target >= 0),
  salary_currency text not null default 'USD',
  notice_period text,
  search_mode text not null default 'open' check (search_mode in ('open', 'stealth')),
  urgency text not null default 'active' check (urgency in ('active', 'exploring')),
  daily_minutes integer not null default 60 check (daily_minutes in (15, 30, 60, 90)),
  dream_companies text[] not null default '{}',
  excluded_companies text[] not null default '{}',
  linkedin_tier text not null default 'free'
    check (linkedin_tier in ('free', 'premium_career', 'premium_business', 'sales_navigator', 'recruiter_lite')),
  inmail_credits integer check (inmail_credits >= 0),
  voice_samples text,
  updated_at timestamptz not null default now()
);

-- Uploaded career documents (files live in the private career-docs bucket) ----
create table public.career_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('resume', 'linkedin_pdf', 'linkedin_export')),
  storage_path text not null,
  file_name text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);
create index career_documents_user_id_idx on public.career_documents (user_id);

-- AI provider settings -----------------------------------------------------------
-- The key itself is never stored here: cloud keys go to Supabase Vault and are
-- write-only for users; private keys never leave the user's browser extension.
create table public.ai_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  mode text not null default 'starter' check (mode in ('starter', 'private', 'cloud')),
  provider text check (provider in ('openai', 'anthropic', 'gemini')),
  key_last4 text,
  key_secret_id uuid,
  updated_at timestamptz not null default now()
);

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row-level security -----------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.search_profiles enable row level security;
alter table public.career_documents enable row level security;
alter table public.ai_settings enable row level security;

create policy "own profile: read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "own profile: update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "own search profile: all" on public.search_profiles
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own documents: all" on public.career_documents
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ai_settings is read-only for users; all writes go through the functions below.
create policy "own ai settings: read" on public.ai_settings
  for select to authenticated using ((select auth.uid()) = user_id);

-- Users may only change these profile columns directly.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, onboarding_step, onboarding_completed_at, updated_at) on public.profiles to authenticated;

-- AI key functions ---------------------------------------------------------------------
create function public.set_ai_mode(p_mode text, p_provider text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_secret uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_mode not in ('starter', 'private') then raise exception 'use set_cloud_ai_key for cloud mode'; end if;
  if p_provider is not null and p_provider not in ('openai', 'anthropic', 'gemini') then raise exception 'invalid provider'; end if;

  -- Leaving cloud mode deletes the stored key immediately.
  select key_secret_id into v_secret from public.ai_settings where user_id = v_uid;
  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
  end if;

  update public.ai_settings
     set mode = p_mode, provider = p_provider, key_last4 = null, key_secret_id = null, updated_at = now()
   where user_id = v_uid;
end;
$$;

create function public.set_cloud_ai_key(p_provider text, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_secret uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_provider not in ('openai', 'anthropic', 'gemini') then raise exception 'invalid provider'; end if;
  if p_key is null or length(p_key) < 20 then raise exception 'invalid key'; end if;

  select key_secret_id into v_secret from public.ai_settings where user_id = v_uid;
  if v_secret is null then
    v_secret := vault.create_secret(p_key, 'ai_key_' || v_uid::text, 'Offerwing user AI key');
  else
    perform vault.update_secret(v_secret, p_key, 'ai_key_' || v_uid::text, 'Offerwing user AI key');
  end if;

  update public.ai_settings
     set mode = 'cloud', provider = p_provider, key_last4 = right(p_key, 4), key_secret_id = v_secret, updated_at = now()
   where user_id = v_uid;
end;
$$;

revoke execute on function public.set_ai_mode(text, text) from public, anon;
revoke execute on function public.set_cloud_ai_key(text, text) from public, anon;
grant execute on function public.set_ai_mode(text, text) to authenticated;
grant execute on function public.set_cloud_ai_key(text, text) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Storage: private bucket, one folder per user ---------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'career-docs', 'career-docs', false, 52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed'
  ]
);

create policy "career docs: own folder read" on storage.objects
  for select to authenticated
  using (bucket_id = 'career-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "career docs: own folder insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'career-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "career docs: own folder delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'career-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
