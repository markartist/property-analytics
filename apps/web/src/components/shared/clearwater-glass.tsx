import * as React from "react";
import { cn } from "@/lib/utils";

type GlassTone = "clear" | "standard" | "tinted";

const glassToneClasses: Record<GlassTone, string> = {
  clear: "clearwater-glass clearwater-glass-clear",
  standard: "clearwater-glass",
  tinted: "clearwater-glass clearwater-glass-tinted",
};

export function ClearwaterStage({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("clearwater-stage relative min-h-screen overflow-hidden", className)}>
      <div className="clearwater-field" aria-hidden="true" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export interface ClearwaterPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: GlassTone;
}

export const ClearwaterPanel = React.forwardRef<HTMLDivElement, ClearwaterPanelProps>(
  ({ className, tone = "standard", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl p-6 text-white will-change-[backdrop-filter,transform]",
        glassToneClasses[tone],
        className
      )}
      {...props}
    />
  )
);
ClearwaterPanel.displayName = "ClearwaterPanel";

export function ClearwaterBadge({
  className,
  children,
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-white/16 bg-white/8 px-3 py-2 text-xs font-semibold text-white/88 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </span>
  );
}

export function ClearwaterKicker({
  className,
  children,
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-[11px] font-semibold uppercase tracking-[0.28em] text-white/58", className)}>
      {children}
    </p>
  );
}
