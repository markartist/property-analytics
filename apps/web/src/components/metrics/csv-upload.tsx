"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, CheckCircle, AlertCircle, Download, Info } from "lucide-react";
import { TEMPLATE_HEADERS, parseMetricsText } from "@/lib/column-mapping";

interface Props {
  onDataExtracted: (rows: Record<string, unknown>[]) => Promise<void>;
  title?: string;
}

export function CSVUpload({ onDataExtracted, title = "Upload CSV" }: Props) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [status, setStatus] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setStatus({ type: "error", message: "Please select a CSV file." });
      return;
    }
    setUploading(true);
    setStatus(null);
    try {
      const text = await file.text();
      const rows = parseMetricsText(text);
      setStatus({ type: "success", message: `Processed ${rows.length} row(s) from ${file.name}` });
      await onDataExtracted(rows);
    } catch (err: unknown) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_HEADERS.join(",")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "metrics_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Card className="border-none shadow-none">
      <CardContent className="p-6">
        <div className="text-center">
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <FileText className="h-8 w-8 text-slate-600" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mx-auto mb-6 max-w-lg text-slate-600">
            Upload a CSV file with your metrics. Download the template to ensure the correct format.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Download Template
            </Button>
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" />
                  Processing…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" /> Select CSV File
                </>
              )}
            </Button>
          </div>
          {status && (
            <div
              className={`mx-auto mt-6 flex items-center gap-2 rounded-lg p-3 text-left ${
                status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {status.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span className="text-sm font-medium">{status.message}</span>
            </div>
          )}
        </div>
        <div className="mt-8 border-t border-slate-200 pt-6">
          <h4 className="mb-3 flex items-center justify-center gap-2 text-center text-sm font-semibold text-slate-800">
            <Info className="h-4 w-4" /> CSV Format Requirements
          </h4>
          <div className="mx-auto max-w-3xl rounded-lg bg-slate-50 p-4">
            <p className="break-words font-mono text-xs leading-relaxed text-slate-800">
              {TEMPLATE_HEADERS.join(", ")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
