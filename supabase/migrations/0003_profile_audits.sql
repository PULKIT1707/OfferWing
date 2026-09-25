-- Profile Optimizer agent: audit runs and server-only access to cloud AI keys.

create table public.profile_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'complete', 'failed')),
  source_kind text not null check (source_kind in ('linkedin_pdf', 'resume')),
  source_file_name text not null,
  credential text not null check (credential in ('starter', 'cloud')),
  provider text not null check (provider in ('openai', 'anthropic', 'gemini')),
  model text not null,
  result jsonb,
  error text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index profile_audits_user_created_idx on public.profile_audits (user_id, created_at desc);

alter table public.profile_audits enable row level security;
create policy "own audits: read" on public.profile_audits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own audits: insert" on public.profile_audits
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own audits: update" on public.profile_audits
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Decrypts a user's cloud AI key. Only the server (service_role) may call this;
-- signed-in users can never read their key back.
create function public.get_user_ai_key(p_user_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select ds.decrypted_secret
  from public.ai_settings a
  join vault.decrypted_secrets ds on ds.id = a.key_secret_id
  where a.user_id = p_user_id and a.mode = 'cloud';
$$;

revoke execute on function public.get_user_ai_key(uuid) from public, anon, authenticated;
grant execute on function public.get_user_ai_key(uuid) to service_role;
