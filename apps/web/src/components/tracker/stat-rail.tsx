import { formatMetricValue } from "@/lib/pilot-kpi";

type Props = {
  format: "score" | "percent";
  pilot: number | null | undefined;
  sister: number | null | undefined;
  baseline?: number | null;
  floor?: number | null;
};

export function StatRail({ format, pilot, sister, baseline, floor }: Props) {
  const items = [
    { label: "Pilot", value: pilot, color: "#4473D0" },
    { label: "Sister", value: sister, color: "#7CCAC2" },
    { label: "Baseline", value: baseline, color: "#A3A3A3" },
    ...(floor !== undefined ? [{ label: "Floor", value: floor, color: "#F4A6A6" }] : []),
  ];
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-6 text-sm">
          <span className="font-semibold" style={{ color: item.color }}>{item.label}</span>
          <span className="font-semibold text-slate-900">{formatMetricValue(item.value ?? null, format)}</span>
        </div>
      ))}
    </div>
  );
}
