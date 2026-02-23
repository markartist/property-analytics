"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, ClipboardPaste } from "lucide-react";
import { parseMetricsText } from "@/lib/column-mapping";

interface Props {
  onDataExtracted: (rows: Record<string, unknown>[]) => Promise<void>;
  title?: string;
}

export function PasteMetricsData({ onDataExtracted, title = "Paste Data from Spreadsheet" }: Props) {
  const [text, setText] = React.useState("");
  const [processing, setProcessing] = React.useState(false);
  const [status, setStatus] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [parsed, setParsed] = React.useState<Record<string, unknown>[] | null>(null);

  const handleProcess = () => {
    if (!text.trim()) {
      setStatus({ type: "error", message: "Please paste data into the text area." });
      return;
    }
    setProcessing(true);
    setStatus(null);
    setParsed(null);
    try {
      const rows = parseMetricsText(text);
      setParsed(rows);
      setStatus({ type: "success", message: `Parsed ${rows.length} record(s). Review below and confirm.` });
    } catch (err: unknown) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsed) return;
    setProcessing(true);
    try {
      await onDataExtracted(parsed);
      setParsed(null);
      setText("");
      setStatus({ type: "success", message: "Data saved successfully." });
    } catch (err: unknown) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-none shadow-none">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <ClipboardPaste className="h-8 w-8 text-slate-600" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mx-auto mb-6 max-w-lg text-slate-600">
            Copy your data from the spreadsheet (including headers) and paste it below.
            Make sure to include the &ldquo;Week Ending&rdquo; and &ldquo;Scope&rdquo; columns.
          </p>

          <div className="mx-auto max-w-3xl">
            <Label className="mb-2 block text-left text-sm font-medium text-slate-700">
              Paste Spreadsheet Data
            </Label>
            <Textarea
              placeholder="Paste tab-separated data here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-48 min-h-[12rem] font-mono text-sm"
              disabled={processing || !!parsed}
            />
          </div>

          {!parsed && (
            <Button onClick={handleProcess} disabled={processing} className="mt-6">
              {processing ? "Processing…" : "Process Data"}
            </Button>
          )}

          {status && (
            <div
              className={`mx-auto mt-6 flex max-w-3xl items-center gap-2 rounded-lg p-3 text-left ${
                status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {status.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span className="text-sm font-medium">{status.message}</span>
            </div>
          )}
        </div>

        {parsed && (
          <div className="mx-auto mt-8 max-w-4xl border-t border-slate-200 pt-6">
            <h3 className="mb-4 text-center text-lg font-semibold text-slate-900">Review Parsed Data</h3>
            <pre className="max-h-96 overflow-x-auto rounded-md bg-slate-100 p-4 text-xs">
              {JSON.stringify(parsed, null, 2)}
            </pre>
            <div className="mt-6 flex justify-center gap-4">
              <Button variant="outline" onClick={() => { setParsed(null); setStatus(null); }}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={processing} className="bg-green-600 hover:bg-green-700">
                {processing ? "Saving…" : "Confirm and Save"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
