import { gapLabel } from "@/lib/pilot-kpi";
import { cn } from "@/lib/utils";

export function GapSummary({
  pilot,
  sister,
  format,
  className,
}: {
  pilot: number | null | undefined;
  sister: number | null | undefined;
  format: "score" | "percent";
  className?: string;
}) {
  const diff = pilot != null && sister != null ? pilot - sister : null;
  const tone =
    diff == null
      ? "bg-slate-100 text-slate-500"
      : diff >= 0
        ? "bg-emerald-50 text-emerald-700"
        : "bg-amber-50 text-amber-700";

  return <div className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", tone, className)}>{gapLabel(pilot, sister, format)}</div>;
}
