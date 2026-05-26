import { OverviewSectionCard } from "@/components/tracker/overview-section-card";
import { TrackerPageShell } from "@/components/tracker/page-shell";
import { getOverviewSnapshot } from "@/lib/pilot-kpi";

export default async function TrackerConversionsPage() {
  const overview = await getOverviewSnapshot();
  const funnel = overview.sections.find((section) => section.section_key === "funnel");

  const conversionSection = funnel
    ? {
        ...funnel,
        title: "Conversions: Website Source Only",
        metrics: funnel.metrics.filter((metric) =>
          [
            "website_sales_funnel_completed_applications",
            "website_funnel_conversions_click_to_call",
            "website_funnel_conversions_contact_form",
            "website_sales_funnel_price_quote",
            "website_sales_funnel_visits_schedule_tour",
          ].includes(metric.metric_key),
        ),
      }
    : null;

  return (
    <TrackerPageShell
      title="Conversions: Website Source Only"
      description="Inherited conversion mode. This keeps the website-attributed funnel and conversion metrics in one scan-friendly view."
      meta={overview.meta}
      currentPath="/tracker/conversions"
    >
      <div className="space-y-6">
        {conversionSection ? <OverviewSectionCard section={conversionSection} /> : null}
      </div>
    </TrackerPageShell>
  );
}
