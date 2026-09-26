-- Outreach: more draft kinds, send tracking (for the weekly invite budget) and follow-up counting.

alter table public.outreach_drafts drop constraint outreach_drafts_kind_check;
alter table public.outreach_drafts add constraint outreach_drafts_kind_check check (kind in ('referral_ask', 'follow_up', 'connection_note'));
alter table public.outreach_drafts add column sent_at timestamptz;
create index outreach_drafts_user_sent_idx on public.outreach_drafts (user_id, sent_at);

-- After two follow-ups with no reply, Offerwing stops suggesting more.
alter table public.contacts add column follow_ups_sent smallint not null default 0 check (follow_ups_sent >= 0);
