import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GapSummary } from "@/components/tracker/gap-summary";
import { MiniTrendChart } from "@/components/tracker/mini-trend-chart";
import { PropertyPairLabel } from "@/components/tracker/property-pair-label";
import { StatRail } from "@/components/tracker/stat-rail";
import { TrackerPageShell } from "@/components/tracker/page-shell";
import { StatusBadge } from "@/components/tracker/status-badge";
import { getFunnelSnapshot } from "@/lib/pilot-kpi";

export default async function TrackerFunnelPage() {
  const funnel = await getFunnelSnapshot();
  return (
    <TrackerPageShell
      title="Funnel"
      description="Website-attributed funnel metrics built from the daily BI export, with pilot vs sister rollups and pair-level trend detail."
      meta={funnel.meta}
      currentPath="/tracker/conversions"
    >
      <div className="space-y-6">
        {funnel.metrics.map((metric) => (
          <Card key={metric.metric_key} className="border-slate-200">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-2xl text-[#15284B]">{metric.title}</CardTitle>
                <GapSummary pilot={metric.pilot_current} sister={metric.sister_current} format="percent" />
              </div>
              <StatusBadge status={metric.status} />
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <MiniTrendChart series={metric.series} format="percent" />
                <StatRail format="percent" pilot={metric.pilot_current} sister={metric.sister_current} baseline={metric.pilot_baseline} />
              </div>
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
            </CardContent>
          </Card>
        ))}
      </div>
    </TrackerPageShell>
  );
}
