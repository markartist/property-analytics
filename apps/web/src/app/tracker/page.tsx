import { OverviewSectionCard } from "@/components/tracker/overview-section-card";
import { TrackerPageShell } from "@/components/tracker/page-shell";
import { getOverviewSnapshot } from "@/lib/pilot-kpi";

export default async function TrackerOverviewPage() {
  const overview = await getOverviewSnapshot();
  return (
    <TrackerPageShell
      title="Pilot KPI Tracker"
      description="Daily pilot-vs-sister KPI monitoring. This dashboard preserves the inherited comparison and trend intent while reading from the same normalized pipeline as the workbook and email."
      meta={overview.meta}
      currentPath="/tracker"
    >
      <div className="space-y-6">
        {overview.sections.map((section) => (
          <OverviewSectionCard key={section.section_key} section={section} />
        ))}
      </div>
    </TrackerPageShell>
  );
}
