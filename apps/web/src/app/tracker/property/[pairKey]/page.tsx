import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GapSummary } from "@/components/tracker/gap-summary";
import { MiniTrendChart } from "@/components/tracker/mini-trend-chart";
import { PropertyPairLabel } from "@/components/tracker/property-pair-label";
import { StatRail } from "@/components/tracker/stat-rail";
import { TrackerPageShell } from "@/components/tracker/page-shell";
import { formatMetricValue, getOverviewSnapshot, getPropertiesSnapshot } from "@/lib/pilot-kpi";

export const dynamicParams = false;
const FALLBACK_PAIR_KEY = "__snapshot_unavailable__";

export async function generateStaticParams() {
  const snapshot = await getPropertiesSnapshot();
  if (!snapshot.pairs.length) {
    return [{ pairKey: FALLBACK_PAIR_KEY }];
  }
  return snapshot.pairs.map((pair) => ({ pairKey: pair.identity.pair_key }));
}

const FUNNEL_LABELS: Record<string, string> = {
  lead_to_available_unit_rate: "Lead (Guest Card) to Available Unit Rate",
  website_sales_funnel_price_quote: "Price Quote",
  website_sales_funnel_visits_schedule_tour: "Visits (Schedule a Tour)",
  website_sales_funnel_completed_applications: "Completed Applications",
  website_funnel_conversions_click_to_call: "Click to Call / Phone",
  website_funnel_conversions_contact_form: "Contact Form",
};

export default async function TrackerPropertyDetailPage({ params }: { params: { pairKey: string } }) {
  if (params.pairKey === FALLBACK_PAIR_KEY) {
    return (
      <TrackerPageShell
        title="Property Detail"
        description="Pilot KPI snapshots are not available in this build environment yet."
        meta={{ as_of_date: "n/a", generated_at: "n/a", sources: {}, theme: {} }}
        currentPath="/tracker"
      >
        <Card className="border-amber-200 bg-amber-50/80">
          <CardHeader>
            <CardTitle className="text-xl text-amber-900">Tracker snapshot unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-950/80">
            Property-level tracker pages need the latest pilot KPI snapshot files. The rest of Data Pond can still deploy safely without them.
          </CardContent>
        </Card>
      </TrackerPageShell>
    );
  }

  const [properties, overview] = await Promise.all([getPropertiesSnapshot(), getOverviewSnapshot()]);
  const pair = properties.pairs.find((entry) => entry.identity.pair_key === params.pairKey);
  if (!pair) return notFound();

  const scorecards = [
    {
      key: "psi",
      title: "PSI",
      format: "score" as const,
      pilot: pair.cwv.psi.pilot_current,
      sister: pair.cwv.psi.sister_current,
      baseline: pair.cwv.psi.baseline,
    },
    {
      key: "gtmetrix",
      title: "GTMetrix",
      format: "score" as const,
      pilot: pair.cwv.gtmetrix.pilot_current,
      sister: pair.cwv.gtmetrix.sister_current,
      baseline: pair.cwv.gtmetrix.baseline,
    },
    ...(pair.traffic
      ? [
          {
            key: "organic",
            title: "Organic Traffic %",
            format: "percent" as const,
            pilot: pair.traffic.pilot_current,
            sister: pair.traffic.sister_current,
            baseline: pair.traffic.pilot_baseline,
          },
        ]
      : []),
    ...Object.entries(pair.funnel).map(([key, metric]) => ({
      key,
      title: FUNNEL_LABELS[key] ?? key,
      format: "percent" as const,
      pilot: metric.pilot_current,
      sister: metric.sister_current,
      baseline: metric.pilot_baseline,
    })),
  ];

  return (
    <TrackerPageShell
      title="Property Detail"
      description="Property-level scorecard and trend view preserving the inherited pilot-vs-sister comparison intent."
      meta={overview.meta}
      currentPath="/tracker"
    >
      <div className="space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="space-y-4">
            <PropertyPairLabel pilot={pair.identity.pilot.name} sister={pair.identity.sister.name} className="text-3xl" />
            <div className="flex flex-wrap gap-3">
              {scorecards.map((card) => (
                <div key={card.key} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  {card.title}: <span className="font-semibold">{formatMetricValue(card.pilot, card.format)}</span>
                </div>
              ))}
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scorecards.map((card) => (
            <Card key={card.key} className="border-slate-200">
              <CardHeader className="space-y-3">
                <CardTitle className="text-lg text-[#15284B]">{card.title}</CardTitle>
                <GapSummary pilot={card.pilot} sister={card.sister} format={card.format} />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-bold text-slate-900">{formatMetricValue(card.pilot, card.format)}</div>
                <div className="text-sm text-slate-500">Sister: {formatMetricValue(card.sister, card.format)}</div>
                <div className="text-sm text-slate-500">Baseline: {formatMetricValue(card.baseline, card.format)}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-5">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-xl text-[#15284B]">Core Web Vitals Trends</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <h3 className="text-lg font-semibold">PSI</h3>
                <MiniTrendChart series={pair.cwv.psi.series} format="score" baseline={pair.cwv.psi.baseline} floor={pair.cwv.psi.floor} />
                <StatRail format="score" pilot={pair.cwv.psi.pilot_current} sister={pair.cwv.psi.sister_current} baseline={pair.cwv.psi.baseline} floor={pair.cwv.psi.floor} />
              </div>
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <h3 className="text-lg font-semibold">GTMetrix</h3>
                <MiniTrendChart series={pair.cwv.gtmetrix.series} format="score" baseline={pair.cwv.gtmetrix.baseline} floor={pair.cwv.gtmetrix.floor} />
                <StatRail format="score" pilot={pair.cwv.gtmetrix.pilot_current} sister={pair.cwv.gtmetrix.sister_current} baseline={pair.cwv.gtmetrix.baseline} floor={pair.cwv.gtmetrix.floor} />
              </div>
            </CardContent>
          </Card>

          {pair.traffic ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-xl text-[#15284B]">Traffic & Engagement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 rounded-xl border border-slate-200 p-4">
                <h3 className="text-lg font-semibold">Organic Traffic as % of Unique Users</h3>
                <MiniTrendChart series={pair.traffic.series} format="percent" />
                <StatRail format="percent" pilot={pair.traffic.pilot_current} sister={pair.traffic.sister_current} baseline={pair.traffic.pilot_baseline} />
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-xl text-[#15284B]">Funnel Trends</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              {Object.entries(pair.funnel).map(([key, metric]) => (
                <div key={key} className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">{FUNNEL_LABELS[key] ?? key}</h3>
                    <GapSummary pilot={metric.pilot_current} sister={metric.sister_current} format="percent" />
                  </div>
                  <MiniTrendChart series={metric.series} format="percent" />
                  <StatRail format="percent" pilot={metric.pilot_current} sister={metric.sister_current} baseline={metric.pilot_baseline} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </TrackerPageShell>
  );
}
