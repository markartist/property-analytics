import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GapSummary } from "@/components/tracker/gap-summary";
import { MiniTrendChart } from "@/components/tracker/mini-trend-chart";
import { PropertyPairLabel } from "@/components/tracker/property-pair-label";
import { StatRail } from "@/components/tracker/stat-rail";
import { TrackerPageShell } from "@/components/tracker/page-shell";
import { getCwvSnapshot } from "@/lib/pilot-kpi";

export default async function TrackerCwvPage() {
  const cwv = await getCwvSnapshot();
  return (
    <TrackerPageShell
      title="Core Web Vitals"
      description="PSI and GTMetrix rollups plus pair-level detail for all five pilot and sister sets."
      meta={cwv.meta}
      currentPath="/tracker"
    >
      <div className="space-y-6">
        <div className="grid gap-5 lg:grid-cols-2">
          {Object.entries(cwv.rollups).map(([key, metric]) => (
            <Card key={key} className="border-slate-200">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-xl text-[#15284B]">{metric.title}</CardTitle>
                  <GapSummary pilot={metric.pilot_current} sister={metric.sister_current} format="score" />
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
                <MiniTrendChart series={metric.series} format="score" baseline={metric.baseline} floor={metric.floor} />
                <StatRail format="score" pilot={metric.pilot_current} sister={metric.sister_current} baseline={metric.baseline} floor={metric.floor} />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-5">
          {cwv.pairs.map((pair) => (
            <Card key={pair.identity.pair_key} className="border-slate-200">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <PropertyPairLabel pilot={pair.identity.pilot.name} sister={pair.identity.sister.name} />
                  <Link href={`/tracker/property/${pair.identity.pair_key}`} className="text-sm font-semibold text-[#4473D0] hover:underline">
                    Open property detail
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {(["psi", "gtmetrix"] as const).map((metricKey) => {
                  const metric = pair.metrics[metricKey];
                  return (
                    <div key={metricKey} className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-slate-900">{metricKey === "psi" ? "PSI" : "GTMetrix"}</h3>
                        <MiniTrendChart series={metric.series} format="score" baseline={metric.baseline} floor={metric.floor} />
                      </div>
                      <StatRail format="score" pilot={metric.pilot_current} sister={metric.sister_current} baseline={metric.baseline} floor={metric.floor} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </TrackerPageShell>
  );
}
