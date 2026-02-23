"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

interface Props {
  onSubmit: (rows: Record<string, unknown>[]) => Promise<void>;
  communityId: string;
}

const FIELDS: { key: string; type: "date" | "select" | "number"; required?: boolean }[] = [
  { key: "week_date", type: "date", required: true },
  { key: "type", type: "select", required: true },
  { key: "g_cards", type: "number" },
  { key: "visits", type: "number" },
  { key: "first_tours", type: "number" },
  { key: "apps", type: "number" },
  { key: "leases", type: "number" },
  { key: "c_and_ds", type: "number" },
  { key: "move_ins", type: "number" },
  { key: "v_gc_conv", type: "number" },
  { key: "a_gc_conv", type: "number" },
  { key: "l_gc_conv", type: "number" },
  { key: "l_v_ratio", type: "number" },
  { key: "c_d_pct_of_gcs", type: "number" },
  { key: "mi_gc_conv", type: "number" },
  { key: "mi_v_ratio", type: "number" },
  { key: "g_cards_delta", type: "number" },
  { key: "visits_delta", type: "number" },
  { key: "apps_delta", type: "number" },
  { key: "leases_delta", type: "number" },
  { key: "c_and_ds_delta", type: "number" },
  { key: "move_ins_delta", type: "number" },
  { key: "v_gc_conv_delta", type: "number" },
  { key: "a_gc_conv_delta", type: "number" },
  { key: "l_gc_conv_delta", type: "number" },
  { key: "l_v_ratio_delta", type: "number" },
  { key: "c_d_pct_of_gcs_delta", type: "number" },
  { key: "mi_gc_conv_delta", type: "number" },
  { key: "mi_v_ratio_delta", type: "number" },
];

export function ManualMetricsForm({ onSubmit, communityId }: Props) {
  const [form, setForm] = React.useState<Record<string, string>>({ type: "community" });
  const [saving, setSaving] = React.useState(false);

  const set = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const record: Record<string, unknown> = { community_id: communityId };
      for (const f of FIELDS) {
        const v = form[f.key];
        if (v === undefined || v === "") continue;
        record[f.key] = f.type === "number" ? parseFloat(v) || 0 : v;
      }
      await onSubmit([record]);
      setForm({ type: form.type }); // keep type
    } catch (err) {
      console.error("Manual save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-none shadow-none">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Enter Metrics Manually</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {FIELDS.map((f) => {
              if (f.key === "type") {
                return (
                  <div key={f.key} className="space-y-2">
                    <Label>Type</Label>
                    <select
                      value={form.type ?? "community"}
                      onChange={(e) => set("type", e.target.value)}
                      className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    >
                      <option value="community">Community</option>
                      <option value="portfolio">Portfolio</option>
                    </select>
                  </div>
                );
              }
              return (
                <div key={f.key} className="space-y-2">
                  <Label htmlFor={f.key} className="capitalize text-slate-700">
                    {f.key.replace(/_/g, " ")}
                  </Label>
                  <Input
                    id={f.key}
                    type={f.type === "date" ? "date" : "number"}
                    step="any"
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.key.replace(/_/g, " ")}
                    required={f.required}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Save Metrics
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
