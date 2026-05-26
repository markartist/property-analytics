import { OverviewSectionCard } from "@/components/tracker/overview-section-card";
import { TrackerPageShell } from "@/components/tracker/page-shell";
import { getOverviewSnapshot } from "@/lib/pilot-kpi";

export default async function TrackerWebsiteSourcePage() {
  const overview = await getOverviewSnapshot();
  const websiteSections = overview.sections.filter(
    (section) => section.section_key === "traffic_engagement" || section.section_key === "funnel",
  ).map((section) => {
    if (section.section_key !== "funnel") return section;
    return {
      ...section,
      title: "Website Source Volumes",
      metrics: section.metrics.filter((metric) =>
        ["lead_to_available_unit_rate", "website_sales_funnel_price_quote", "website_sales_funnel_visits_schedule_tour"].includes(
          metric.metric_key,
        ),
      ),
    };
  });

  return (
    <TrackerPageShell
      title="Volumes: Website Source Only"
      description="Inherited website-source volume mode. This focuses on Heap traffic plus the website-attributed intake metrics coming from the BI daily drop."
      meta={overview.meta}
      currentPath="/tracker/website-source"
    >
      <div className="space-y-6">
        {websiteSections.map((section) => (
          <OverviewSectionCard key={section.section_key} section={section} />
        ))}
      </div>
    </TrackerPageShell>
  );
}
