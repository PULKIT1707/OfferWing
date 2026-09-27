// Pure helpers for organization invites and sponsorship dates (safe in client components).

export function inviteActive(i: { revoked_at: string | null; uses: number; max_uses: number; expires_at: string }): boolean {
  return !i.revoked_at && i.uses < i.max_uses && Date.parse(i.expires_at) > Date.now();
}

export const sponsorshipEnded = (endsAt: string | null) => !!endsAt && endsAt < new Date().toISOString().slice(0, 10);
