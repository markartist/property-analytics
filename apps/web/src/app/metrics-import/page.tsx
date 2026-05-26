"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { importWeeklyMetricsText, uploadWeeklyMetricsFile } from "@/lib/api";
import { ClipboardPaste, Upload, CheckCircle, AlertCircle, FileText } from "lucide-react";

export default function MetricsImportPage() {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [tsv, setTsv] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handlePasteImport(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const data = await importWeeklyMetricsText(tsv);
      setResult(`Import ${data.status}. Rows applied: ${data.rows_applied}. Run: ${data.import_run_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const data = await uploadWeeklyMetricsFile(file);
      setResult(`Upload ${data.status}. Rows applied: ${data.rows_applied}. Run: ${data.import_run_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#15284B]">Weekly Metrics Import</h1>
          <p className="mt-2 text-slate-600">
            Import POP Brief weekly metrics with pasted TSV or uploaded CSV. Dates must be Fridays and community rows can use `community_external_key`.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardPaste className="h-5 w-5" />
                Paste TSV
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasteImport} className="space-y-4">
                <Textarea
                  value={tsv}
                  onChange={(e) => setTsv(e.target.value)}
                  rows={14}
                  className="font-mono text-xs"
                  placeholder={"metric_date\twindow_days\ttype\tcommunity_external_key\toccupancy_rate\n2026-04-17\t7\tcommunity\tCOMM_A\t95%"}
                />
                <Button type="submit" disabled={busy || !tsv.trim()}>
                  {busy ? "Importing..." : "Import TSV"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload CSV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                <p className="mb-4 text-sm text-slate-600">
                  Upload a `.csv` or `.tsv` file with `metric_date`, `window_days`, `type`, and the metric columns you want to replace-import.
                </p>
                <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? "Uploading..." : "Choose File"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {(result || error) && (
          <Card>
            <CardContent className="p-4">
              {result && (
                <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">{result}</p>
                </div>
              )}
              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
