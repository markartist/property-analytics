import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrackerModeTabs } from "@/components/tracker/mode-tabs";
import { StatusBadge } from "@/components/tracker/status-badge";
import type { SnapshotMeta, StatusObject } from "@/lib/pilot-kpi";

export function TrackerPageShell({
  title,
  description,
  meta,
  currentPath,
  children,
}: {
  title: string;
  description: string;
  meta: SnapshotMeta;
  currentPath?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbfc_0%,#f7f9fc_28%,#f8fafc_100%)] px-6 py-8 md:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[28px] border border-[#15284B]/10 bg-[radial-gradient(circle_at_top_left,#0D5E6D_0%,#15284B_42%,#0f1f3d_100%)] p-8 text-white shadow-[0_24px_80px_rgba(21,40,75,0.18)]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#b9d8de]">
              Pilot Tracker
              <Badge className="border border-white/20 bg-white/10 text-white">As of {meta.as_of_date}</Badge>
              <Badge className="border border-white/15 bg-[#7CCAC2]/15 text-[#c6f0ea]">tracker.venterradev.com</Badge>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
            <p className="max-w-3xl text-sm text-white/75">{description}</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(meta.sources).map(([key, source]) => (
            <Card key={key} className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur">
              <CardHeader className="pb-3">
                <CardDescription className="text-[11px] uppercase tracking-[0.18em]">{key.replace(/_/g, " ")}</CardDescription>
                <CardTitle className="text-base font-semibold text-slate-900">{source.latest_date}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <StatusBadge status={{ state: (source.status === "pending_today" ? "pending" : source.status === "stale" ? "widening" : "closing") as StatusObject["state"], label: source.status.replace(/_/g, " "), reason: source.source_file ?? "" }} />
                {source.source_file ? (
                  <span className="max-w-[10rem] truncate text-[11px] text-slate-400" title={source.source_file}>source</span>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-medium text-[#4473D0]">
          <Link href="/tracker" className="hover:underline">Overview</Link>
          <Link href="/tracker/cwv" className="hover:underline">Core Web Vitals</Link>
          <Link href="/tracker/traffic" className="hover:underline">Traffic & Engagement</Link>
          <Link href="/tracker/funnel" className="hover:underline">Funnel</Link>
          <Link href="/tracker/property" className="hover:underline">Property Detail</Link>
          <Link href="/tracker/archive" className="hover:underline">Archive</Link>
        </div>
        <TrackerModeTabs currentPath={currentPath ?? "/tracker"} />
        {children}
      </div>
    </div>
  );
}
