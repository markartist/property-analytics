import { OverviewSectionCard } from "@/components/tracker/overview-section-card";
import { TrackerPageShell } from "@/components/tracker/page-shell";
import { getOverviewSnapshot } from "@/lib/pilot-kpi";

export default async function TrackerAllSourcesPage() {
  const overview = await getOverviewSnapshot();
  const allSourcesSections = overview.sections.filter((section) => section.section_key === "core_web_vitals" || section.section_key === "funnel").map((section) => {
    if (section.section_key !== "funnel") return section;
    return {
      ...section,
      title: "All-Sources Volumes",
      metrics: section.metrics.filter((metric) => metric.metric_key === "lead_to_available_unit_rate"),
    };
  });

  return (
    <TrackerPageShell
      title="Volumes: All Sources"
      description="Inherited all-sources dashboard mode. This view currently emphasizes the pilot-vs-sister volume proxy we have on live data today, alongside technical health context."
      meta={overview.meta}
      currentPath="/tracker/all-sources"
    >
      <div className="space-y-6">
        {allSourcesSections.map((section) => (
          <OverviewSectionCard
            key={section.section_key}
            section={section}
            sectionNote={
              section.section_key === "funnel"
                ? "Current live all-sources proxy from BI. Broader all-source guest-card volume widgets from the inherited app are the next mapping pass."
                : undefined
            }
          />
        ))}
      </div>
    </TrackerPageShell>
  );
}
