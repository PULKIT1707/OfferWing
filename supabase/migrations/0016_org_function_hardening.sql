-- Tighten function access after 0014/0015.
-- require_verified_recruiter and talent_hidden_from are only used inside other security-definer
-- functions, so signed-in users don't need to call them directly (the former returns a whole
-- organizations row). get_my_sponsor was replaced by an RLS query in the app (lib/orgs.ts).
revoke execute on function public.require_verified_recruiter(uuid) from authenticated;
revoke execute on function public.talent_hidden_from(text[], text) from authenticated;
drop function public.get_my_sponsor();
