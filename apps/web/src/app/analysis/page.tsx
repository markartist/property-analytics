"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function AnalysisPage() {
  const [data, setData] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Add week_ending picker; for now fetch without param.
    apiFetch("/v1/analysis")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading analysis…</p>;

  return (
    <div>
      <h1>Analysis</h1>
      {data ? (
        <pre style={{ background: "#f5f5f5", padding: "1rem" }}>{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <p>No analysis data available.</p>
      )}
    </div>
  );
}
