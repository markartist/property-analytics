"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/v1/communities")
      .then((res) => res.json())
      .then((data) => setCommunities(data.items ?? []))
      .catch(() => setCommunities([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading communities…</p>;

  return (
    <div>
      <h1>Communities</h1>
      {communities.length === 0 ? (
        <p>No communities found.</p>
      ) : (
        <ul>
          {communities.map((c: any) => (
            <li key={c.id}>{c.name} ({c.status})</li>
          ))}
        </ul>
      )}
    </div>
  );
}
