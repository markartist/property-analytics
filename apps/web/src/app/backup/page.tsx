"use client";

import React from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCommunities, getT7Metrics, getT30Metrics, getMarketingData } from "@/lib/api";
import { Download, Database, CheckCircle, AlertCircle, FileArchive } from "lucide-react";

function convertToCSV(data: object[], headers: string[]): string {
  if (!data.length) return "";
  const rows = data.map((row) =>
    headers.map((h) => {
      let v = (row as Record<string, unknown>)[h];
      if (v == null) v = "";
      v = String(v);
      if ((v as string).includes(",") || (v as string).includes("\n") || (v as string).includes('"'))
        v = `"${(v as string).replace(/"/g, '""')}"`;
      return v;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const METRIC_HEADERS = [
  "id", "community_id", "week_date", "type",
  "g_cards", "visits", "first_tours", "apps", "leases", "c_and_ds", "move_ins",
  "v_gc_conv", "a_gc_conv", "l_gc_conv", "l_v_ratio", "c_d_pct_of_gcs", "mi_gc_conv", "mi_v_ratio",
  "g_cards_delta", "visits_delta", "apps_delta", "leases_delta", "c_and_ds_delta", "move_ins_delta",
  "v_gc_conv_delta", "a_gc_conv_delta", "l_gc_conv_delta", "l_v_ratio_delta",
  "c_d_pct_of_gcs_delta", "mi_gc_conv_delta", "mi_v_ratio_delta",
];

export default function BackupPage() {
  const [exporting, setExporting] = React.useState(false);
  const [status, setStatus] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [stats, setStats] = React.useState<Record<string, number> | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setStatus(null);
    setStats(null);
    try {
      const ts = format(new Date(), "yyyy-MM-dd_HHmmss");
      const s: Record<string, number> = {};

      const comms = await getCommunities();
      s.communities = comms.length;
      if (comms.length) downloadCSV(convertToCSV(comms, ["id", "name", "region", "manager_name", "unit_count"]), `backup_communities_${ts}.csv`);

      const t7 = await getT7Metrics({});
      s.t7Metrics = t7.length;
      if (t7.length) downloadCSV(convertToCSV(t7, METRIC_HEADERS), `backup_t7_metrics_${ts}.csv`);

      const t30 = await getT30Metrics({});
      s.t30Metrics = t30.length;
      if (t30.length) downloadCSV(convertToCSV(t30, METRIC_HEADERS), `backup_t30_metrics_${ts}.csv`);

      const mktg = await getMarketingData({});
      s.marketingData = mktg.length;
      if (mktg.length) {
        const mHeaders = Object.keys(mktg[0]);
        downloadCSV(convertToCSV(mktg, mHeaders), `backup_marketing_data_${ts}.csv`);
      }

      setStats(s);
      setStatus({ type: "success", message: "All data exported successfully! Check your downloads folder." });
    } catch (err: unknown) {
      setStatus({ type: "error", message: `Export failed: ${(err as Error).message}` });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#15284B]">Data Backup & Export</h1>
          <p className="mt-2 text-slate-600">Download complete backups of all your data</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Full System Backup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="mb-2 font-semibold text-blue-900">What gets backed up?</h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>✓ All Communities (names, regions, managers, units)</li>
                <li>✓ All T7 Metrics (7-day performance data)</li>
                <li>✓ All T30 Metrics (30-day performance data)</li>
                <li>✓ All Marketing Data (spend, notes, analytics)</li>
              </ul>
            </div>

            <div className="flex flex-col items-center gap-4 py-6">
              <FileArchive className="h-16 w-16 text-slate-400" />
              <Button onClick={handleExport} disabled={exporting} size="lg">
                {exporting ? (
                  <><div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-b-transparent" />Exporting Data…</>
                ) : (
                  <><Download className="mr-2 h-5 w-5" />Export All Data to CSV</>
                )}
              </Button>
              <p className="max-w-md text-center text-sm text-slate-500">
                This will download 4 CSV files with all your data. The export may take a moment depending on your data size.
              </p>
            </div>

            {status && (
              <div className={`flex items-start gap-3 rounded-lg border p-4 ${
                status.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
              }`}>
                {status.type === "success" ? <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="mb-1 font-semibold">{status.message}</p>
                  {stats && (
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>• Communities: {stats.communities}</li>
                      <li>• T7 Metrics: {stats.t7Metrics}</li>
                      <li>• T30 Metrics: {stats.t30Metrics}</li>
                      <li>• Marketing Data: {stats.marketingData}</li>
                    </ul>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
