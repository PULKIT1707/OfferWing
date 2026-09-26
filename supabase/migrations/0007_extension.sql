-- Browser extension: private-mode results (scored in the browser with the user's own key) and job lookup by URL.

alter table public.job_matches drop constraint job_matches_credential_check;
alter table public.job_matches add constraint job_matches_credential_check check (credential in ('starter', 'cloud', 'private'));

create index jobs_user_url_idx on public.jobs (user_id, url);
