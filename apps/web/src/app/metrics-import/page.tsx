"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function MetricsImportPage() {
  const [tsv, setTsv] = useState("");
  const [result, setResult] = useState<string | null>(null);

  async function handlePasteImport(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const res = await apiFetch("/v1/metrics/import/paste", {
      method: "POST",
      body: JSON.stringify({ tsv }),
    });
    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  }

  return (
    <div>
      <h1>Metrics Import</h1>
      <form onSubmit={handlePasteImport}>
        <div style={{ marginBottom: "1rem" }}>
          <label>Paste TSV Data</label><br />
          <textarea
            value={tsv}
            onChange={(e) => setTsv(e.target.value)}
            rows={10}
            style={{ width: "100%", fontFamily: "monospace" }}
            placeholder="metric_date\twindow_days\ttype\tcommunity_external_key\toccupancy_rate"
          />
        </div>
        <button type="submit">Import</button>
      </form>
      {result && <pre style={{ marginTop: "1rem", background: "#f5f5f5", padding: "1rem" }}>{result}</pre>}
    </div>
  );
}
