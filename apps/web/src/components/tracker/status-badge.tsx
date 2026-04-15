import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatusObject } from "@/lib/pilot-kpi";

const COLORS: Record<StatusObject["state"], string> = {
  closing: "border-emerald-200 bg-emerald-50 text-emerald-700",
  widening: "border-amber-200 bg-amber-50 text-amber-700",
  stable: "border-slate-200 bg-slate-100 text-slate-700",
  closed: "border-blue-200 bg-blue-50 text-blue-700",
  mixed: "border-violet-200 bg-violet-50 text-violet-700",
  pending: "border-orange-200 bg-orange-50 text-orange-700",
};

export function StatusBadge({ status }: { status: StatusObject }) {
  return <Badge className={cn("border", COLORS[status.state])}>{status.label}</Badge>;
}
