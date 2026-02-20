"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function MarketingPage() {
  const [records, setRecords] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/v1/marketing")
      .then((res) => res.json())
      .then((data) => setRecords(data.items ?? []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading marketing data…</p>;

  return (
    <div>
      <h1>Marketing Weekly</h1>
      {records.length === 0 ? (
        <p>No marketing records found.</p>
      ) : (
        <ul>
          {records.map((r: any) => (
            <li key={r.id}>{r.week_ending} — {r.community_id} — Leads: {r.leads_count}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
