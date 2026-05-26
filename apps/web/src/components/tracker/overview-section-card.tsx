import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { GapSummary } from "@/components/tracker/gap-summary";
import { MiniTrendChart } from "@/components/tracker/mini-trend-chart";
import { StatRail } from "@/components/tracker/stat-rail";
import { StatusBadge } from "@/components/tracker/status-badge";
import type { OverviewSection } from "@/lib/pilot-kpi";

export function OverviewSectionCard({
  section,
  sectionNote,
}: {
  section: OverviewSection;
  sectionNote?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-row items-start justify-between gap-6 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-2xl font-semibold text-[#15284B]">{section.title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {sectionNote ?? "Pilot average vs sister average with current values, baselines, and trend context."}
          </p>
        </div>
        <Link href={section.detail_href} className="text-sm font-semibold text-[#4473D0] hover:underline">
          View details
        </Link>
      </div>
      <div className="grid gap-5 p-6">
        {section.metrics.map((metric) => (
          <div
            key={metric.metric_key}
            className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_220px]"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{metric.title}</h3>
                    {!metric.pending ? (
                      <GapSummary pilot={metric.pilot_current} sister={metric.sister_current} format={metric.format} />
                    ) : null}
                  </div>
                  {metric.pending ? <p className="text-sm text-orange-700">{metric.pending_reason}</p> : null}
                </div>
                <StatusBadge status={metric.status} />
              </div>
              <MiniTrendChart
                series={metric.series}
                format={metric.format}
                baseline={metric.baseline ?? metric.pilot_baseline}
                floor={metric.floor}
              />
              {!metric.pending ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge className="border border-slate-200 bg-slate-50 text-slate-700">
                    Trend window: {metric.series.at(0)?.label} to {metric.series.at(-1)?.label}
                  </Badge>
                  <Badge className="border border-slate-200 bg-slate-50 text-slate-700">{section.title}</Badge>
                </div>
              ) : null}
            </div>
            <StatRail
              format={metric.format}
              pilot={metric.pilot_current}
              sister={metric.sister_current}
              baseline={metric.baseline ?? metric.pilot_baseline}
              floor={metric.floor}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
