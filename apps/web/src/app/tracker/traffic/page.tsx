import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GapSummary } from "@/components/tracker/gap-summary";
import { MiniTrendChart } from "@/components/tracker/mini-trend-chart";
import { PropertyPairLabel } from "@/components/tracker/property-pair-label";
import { StatRail } from "@/components/tracker/stat-rail";
import { TrackerPageShell } from "@/components/tracker/page-shell";
import { StatusBadge } from "@/components/tracker/status-badge";
import { getTrafficSnapshot } from "@/lib/pilot-kpi";

export default async function TrackerTrafficPage() {
  const traffic = await getTrafficSnapshot();
  return (
    <TrackerPageShell
      title="Traffic & Engagement"
      description="Heap-driven traffic and engagement metrics, with explicit pending states when the daily Measurement workbook has not been updated yet."
      meta={traffic.meta}
      currentPath="/tracker/website-source"
    >
      <div className="space-y-6">
        {traffic.metrics.map((metric) => (
          <Card key={metric.metric_key} className="border-slate-200">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-2xl text-[#15284B]">{metric.title}</CardTitle>
                  {!metric.pending ? <GapSummary pilot={metric.pilot_current} sister={metric.sister_current} format="percent" /> : null}
                </div>
                {"source_note" in metric && metric.source_note ? (
                  <p className="mt-1 text-sm text-slate-600">{metric.source_note}</p>
                ) : null}
                {metric.pending ? <p className="mt-1 text-sm text-orange-700">{metric.pending_reason}</p> : null}
              </div>
              <StatusBadge status={metric.status} />
            </CardHeader>
            <CardContent className="space-y-5">
              {!metric.pending ? (
                <div className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_200px]">
                  <MiniTrendChart series={metric.series} format="percent" />
                  <StatRail format="percent" pilot={metric.pilot_current} sister={metric.sister_current} baseline={metric.pilot_baseline} />
                </div>
              ) : null}
              {metric.pairs?.length ? (
                <div className="space-y-4">
                  {metric.pairs.map((pair) => (
                    <div key={pair.identity.pair_key} className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-[240px_minmax(0,1fr)_180px]">
                      <div className="space-y-2">
                        <PropertyPairLabel pilot={pair.identity.pilot.name} sister={pair.identity.sister.name} className="text-base" />
                        <Link href={`/tracker/property/${pair.identity.pair_key}`} className="text-xs font-semibold text-[#4473D0] hover:underline">
                          Open property detail
                        </Link>
                      </div>
                      <MiniTrendChart series={pair.series} format="percent" />
                      <StatRail format="percent" pilot={pair.pilot_current} sister={pair.sister_current} baseline={pair.pilot_baseline} />
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </TrackerPageShell>
  );
}
