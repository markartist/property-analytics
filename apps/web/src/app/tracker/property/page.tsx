import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyPairLabel } from "@/components/tracker/property-pair-label";
import { TrackerPageShell } from "@/components/tracker/page-shell";
import { getOverviewSnapshot, getPropertiesSnapshot } from "@/lib/pilot-kpi";

export default async function TrackerPropertyIndexPage() {
  const [properties, overview] = await Promise.all([getPropertiesSnapshot(), getOverviewSnapshot()]);

  return (
    <TrackerPageShell
      title="Property Detail"
      description="Jump into any pilot and sister pair for full scorecards, CWV trends, traffic context, and funnel comparisons."
      meta={overview.meta}
      currentPath="/tracker"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {properties.pairs.map((pair) => (
          <Link key={pair.identity.pair_key} href={`/tracker/property/${pair.identity.pair_key}`}>
            <Card className="h-full border-slate-200 transition-all hover:-translate-y-0.5 hover:border-[#4473D0]/30 hover:shadow-md">
              <CardHeader className="space-y-3">
                <PropertyPairLabel pilot={pair.identity.pilot.name} sister={pair.identity.sister.name} className="text-2xl" />
                <CardDescription className="text-sm text-slate-600">
                  Compare technical health, traffic, and funnel performance for this pilot/sister set.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm">
                <div className="space-y-1">
                  <div className="font-medium text-slate-900">Pilot ID: {pair.identity.pilot.property_id}</div>
                  <div className="font-medium text-slate-500">Sister ID: {pair.identity.sister.property_id}</div>
                </div>
                <div className="font-semibold text-[#4473D0]">Open →</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </TrackerPageShell>
  );
}
