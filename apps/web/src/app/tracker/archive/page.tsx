import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrackerPageShell } from "@/components/tracker/page-shell";
import { getArchiveSnapshot, getOverviewSnapshot } from "@/lib/pilot-kpi";

export default async function TrackerArchivePage() {
  const [archive, overview] = await Promise.all([getArchiveSnapshot(), getOverviewSnapshot()]);
  return (
    <TrackerPageShell
      title="Report Archive"
      description="Daily generated artifacts for the pilot KPI tracker, including the workbook and email preview when present."
      meta={overview.meta}
      currentPath="/tracker"
    >
      <div className="grid gap-6">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl text-[#15284B]">Latest Run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>Date: <span className="font-semibold">{archive.latest.date}</span></div>
            <div>Workbook: {archive.latest.workbook_path ? <span className="font-mono text-xs">{archive.latest.workbook_path}</span> : "n/a"}</div>
            <div>Email Preview: {archive.latest.email_preview_path ? <span className="font-mono text-xs">{archive.latest.email_preview_path}</span> : "n/a"}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl text-[#15284B]">Runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {archive.runs.map((run) => (
              <div key={run.date} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="font-semibold">{run.date}</div>
                <div className="mt-1 text-slate-600">Workbook: {run.workbook_path ?? "n/a"}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Link href="/tracker" className="text-sm font-semibold text-[#4473D0] hover:underline">Back to tracker overview</Link>
      </div>
    </TrackerPageShell>
  );
}
