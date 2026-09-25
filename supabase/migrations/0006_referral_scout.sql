-- Referral Scout: connections imported from the user's LinkedIn data export, and outreach drafts.
-- Privacy: no email addresses and no message content are stored, only per-connection message counts and dates.

create table public.connection_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_id uuid references public.career_documents (id) on delete set null,
  status text not null default 'running' check (status in ('running', 'complete', 'failed')),
  stats jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index connection_imports_user_created_idx on public.connection_imports (user_id, created_at desc);
create index connection_imports_document_idx on public.connection_imports (document_id);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  profile_url text,
  company text,
  -- Normalized company name ("Stripe, Inc." → "stripe") for matching against target companies.
  company_key text,
  position text,
  connected_on date,
  message_count integer not null default 0,
  last_message_at timestamptz,
  imported_at timestamptz not null default now()
);
create index connections_user_company_idx on public.connections (user_id, company_key);
create unique index connections_user_url_idx on public.connections (user_id, profile_url) where profile_url is not null;

create table public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  connection_id uuid references public.connections (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  job_id uuid references public.jobs (id) on delete set null,
  kind text not null check (kind in ('referral_ask')),
  credential text not null check (credential in ('starter', 'cloud')),
  provider text not null check (provider in ('openai', 'anthropic', 'gemini')),
  model text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index outreach_drafts_user_created_idx on public.outreach_drafts (user_id, created_at desc);
create index outreach_drafts_connection_idx on public.outreach_drafts (connection_id);
create index outreach_drafts_contact_idx on public.outreach_drafts (contact_id);
create index outreach_drafts_job_idx on public.outreach_drafts (job_id);

alter table public.contacts add column connection_id uuid references public.connections (id) on delete set null;
create index contacts_connection_idx on public.contacts (connection_id);

alter table public.connection_imports enable row level security;
alter table public.connections enable row level security;
alter table public.outreach_drafts enable row level security;

create policy "own imports: all" on public.connection_imports
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own connections: all" on public.connections
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own drafts: all" on public.outreach_drafts
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
