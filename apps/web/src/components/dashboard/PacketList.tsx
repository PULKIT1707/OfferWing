import { Eye, FileText } from "lucide-react";
import Link from "next/link";

export type PacketSummary = {
  id: string;
  status: "generating" | "draft" | "live" | "revoked" | "failed";
  referrer_name: string | null;
  views: number;
  expires_at: string;
  created_at: string;
  jobs: { title: string; company: string } | null;
};

const LABEL: Record<PacketSummary["status"], string> = { generating: "Writing", draft: "Draft", live: "Live", revoked: "Off", failed: "Failed" };

// Referral packets the user has made, newest first.
export function PacketList({ packets }: { packets: PacketSummary[] }) {
  if (!packets.length) return null;
  return (
    <section className="mb-10 rounded-3xl bg-white p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold"><FileText className="size-5 text-wing" /> Referral packets</h2>
        <p className="text-xs text-muted">One-page links that make it easy to refer you</p>
      </div>
      <div>
        {packets.map((p) => {
          return (
            <Link key={p.id} href={`/dashboard/packets/${p.id}`} className="flex items-center gap-3 border-b border-line py-3 last:border-0 hover:text-wing">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.jobs ? `${p.jobs.title} · ${p.jobs.company}` : "Job removed"}</p>
                <p className="truncate text-xs text-muted">{p.referrer_name ? `For ${p.referrer_name}` : "No referrer named"}</p>
              </div>
              {p.status === "live" && (
                <span className="inline-flex items-center gap-1 text-xs text-muted"><Eye className="size-3.5" /> {p.views}</span>
              )}
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.status === "live" ? "bg-emerald-50 text-emerald-700" : "bg-card text-muted"}`}>{LABEL[p.status]}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
