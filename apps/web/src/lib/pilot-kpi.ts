import { promises as fs } from "fs";
import path from "path";

export type SnapshotMeta = {
  as_of_date: string;
  generated_at: string;
  sources: Record<string, { latest_date: string; status: string; source_file?: string }>;
  theme?: Record<string, string>;
};

export type SeriesPoint = {
  date: string;
  label: string;
  pilot_value: number;
  sister_value: number;
  pilot_value_display?: string | null;
  sister_value_display?: string | null;
};

export type StatusObject = {
  state: "closing" | "widening" | "stable" | "closed" | "mixed" | "pending";
  label: string;
  reason: string;
};

export type PairIdentity = {
  pair_key: string;
  pilot: { name: string; property_id: string };
  sister: { name: string; property_id: string };
};

export type OverviewMetric = {
  metric_key: string;
  title: string;
  format: "score" | "percent";
  series: SeriesPoint[];
  pilot_current: number | null;
  sister_current: number | null;
  pilot_baseline?: number | null;
  sister_baseline?: number | null;
  baseline?: number | null;
  floor?: number | null;
  status: StatusObject;
  pending?: boolean;
  pending_reason?: string;
};

export type OverviewSection = {
  section_key: string;
  title: string;
  detail_href: string;
  metrics: OverviewMetric[];
};

export type OverviewSnapshot = {
  meta: SnapshotMeta;
  sections: OverviewSection[];
};

export type CwvSnapshot = {
  meta: SnapshotMeta;
  rollups: Record<string, OverviewMetric>;
  pairs: Array<{
    identity: PairIdentity;
    metrics: Record<string, Omit<OverviewMetric, "status" | "title" | "metric_key">>;
  }>;
};

export type PairMetric = {
  identity: PairIdentity;
  pilot_current: number | null;
  pilot_current_display?: string | null;
  sister_current: number | null;
  sister_current_display?: string | null;
  pilot_baseline?: number | null;
  pilot_baseline_display?: string | null;
  sister_baseline?: number | null;
  sister_baseline_display?: string | null;
  series: SeriesPoint[];
  status: StatusObject;
};

export type TrafficSnapshot = {
  meta: SnapshotMeta;
  metrics: Array<OverviewMetric & { pairs: PairMetric[]; source_note?: string }>;
};

export type FunnelSnapshot = {
  meta: SnapshotMeta;
  metrics: Array<OverviewMetric & { pairs: PairMetric[] }>;
};

export type PropertiesSnapshot = {
  pairs: Array<{
    identity: PairIdentity;
    cwv: Record<string, { format: "score"; baseline: number; floor: number; series: SeriesPoint[]; pilot_current: number | null; sister_current: number | null }>;
    traffic?: PairMetric | null;
    funnel: Record<string, PairMetric>;
  }>;
};

export type ArchiveSnapshot = {
  latest: { date: string; workbook_path: string | null; email_preview_path: string | null };
  runs: Array<{ date: string; workbook_path: string | null; email_preview_path: string | null }>;
};

async function readSnapshot<T>(name: string): Promise<T> {
  const filePath = path.join(process.cwd(), "public", "pilot-kpi", "latest", name);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export function formatMetricValue(value: number | null | undefined, format: "score" | "percent"): string {
  if (value == null || Number.isNaN(value)) return "n/a";
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  const rounded = value.toFixed(1);
  return rounded.endsWith(".0") ? rounded.slice(0, -2) : rounded;
}

export function gapLabel(pilot: number | null | undefined, sister: number | null | undefined, format: "score" | "percent") {
  if (pilot == null || sister == null) return "Gap n/a";
  const diff = pilot - sister;
  if (format === "percent") {
    return `${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(1)} pts vs sister`;
  }
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} vs sister`;
}

export async function getOverviewSnapshot() {
  return readSnapshot<OverviewSnapshot>("overview.json");
}

export async function getCwvSnapshot() {
  return readSnapshot<CwvSnapshot>("cwv.json");
}

export async function getTrafficSnapshot() {
  return readSnapshot<TrafficSnapshot>("traffic.json");
}

export async function getFunnelSnapshot() {
  return readSnapshot<FunnelSnapshot>("funnel.json");
}

export async function getArchiveSnapshot() {
  return readSnapshot<ArchiveSnapshot>("archive.json");
}

export async function getPropertiesSnapshot() {
  return readSnapshot<PropertiesSnapshot>("properties.json");
}
