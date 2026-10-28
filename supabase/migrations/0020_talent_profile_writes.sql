-- Talent profiles are presented to recruiters as anonymous and fact-checked, so users must not be
-- able to write them directly (they could set any skills, highlights, verification or status, and
-- publish it). The server writes them with the service role after redacting and checking; users
-- keep reading and deleting their own row.

drop policy "own talent profile: all" on public.talent_profiles;
create policy "own talent profile: read" on public.talent_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own talent profile: delete" on public.talent_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke insert, update on public.talent_profiles from authenticated, anon;
