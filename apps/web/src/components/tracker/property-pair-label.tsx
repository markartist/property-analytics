import { cn } from "@/lib/utils";

type Props = {
  pilot: string;
  sister: string;
  className?: string;
};

export function PropertyPairLabel({ pilot, sister, className }: Props) {
  return (
    <div className={cn("text-lg font-semibold tracking-tight", className)}>
      <span style={{ color: "#4473D0" }}>{pilot}</span>
      <span className="mx-2 text-slate-900">vs</span>
      <span style={{ color: "#7CCAC2" }}>{sister}</span>
    </div>
  );
}
