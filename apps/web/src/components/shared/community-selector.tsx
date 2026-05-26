"use client";

import React from "react";
import { Building2, AlertCircle } from "lucide-react";
import { getCommunities, type Community } from "@/lib/api";

interface CommunitySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  communities?: Community[];
}

export function CommunitySelector({
  value,
  onValueChange,
  placeholder = "Select a community",
  communities: providedCommunities,
}: CommunitySelectorProps) {
  const [communities, setCommunities] = React.useState<Community[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (providedCommunities) {
      setCommunities(providedCommunities);
      setError(null);
      return;
    }

    getCommunities()
      .then((data) => {
        const sorted = data.sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" })
        );
        setCommunities(sorted);
      })
      .catch((err) => {
        console.error("Error loading communities:", err);
        setError("Could not load communities");
      });
  }, [providedCommunities]);

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-slate-500" />
      {error ? (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="h-10 w-64 rounded-md border border-yellow-300 bg-yellow-100 px-3 text-sm font-medium text-slate-900 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          <option value="">{placeholder}</option>
          {communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.region ?? "N/A"}{c.unit_count ? ` (${c.unit_count} units)` : ""}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
