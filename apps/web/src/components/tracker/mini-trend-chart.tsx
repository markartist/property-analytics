import { formatMetricValue, type SeriesPoint } from "@/lib/pilot-kpi";

type Props = {
  series: SeriesPoint[];
  format: "score" | "percent";
  baseline?: number | null;
  floor?: number | null;
  height?: number;
};

function buildLine(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export function MiniTrendChart({ series, format, baseline, floor, height = 92 }: Props) {
  const width = 420;
  const margin = { top: 10, right: 10, bottom: 16, left: 10 };

  if (!series.length) {
    return <div className="flex h-[92px] items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">No trend data</div>;
  }

  const allValues = [
    ...series.map((point) => point.pilot_value),
    ...series.map((point) => point.sister_value),
    ...(baseline != null ? [baseline] : []),
    ...(floor != null ? [floor] : []),
  ];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const stepX = series.length > 1 ? innerWidth / (series.length - 1) : innerWidth;

  const toPoint = (value: number, index: number) => ({
    x: margin.left + stepX * index,
    y: margin.top + innerHeight - ((value - min) / range) * innerHeight,
  });

  const pilotPoints = series.map((point, index) => toPoint(point.pilot_value, index));
  const sisterPoints = series.map((point, index) => toPoint(point.sister_value, index));

  const baselineY = baseline != null ? toPoint(baseline, 0).y : null;
  const floorY = floor != null ? toPoint(floor, 0).y : null;

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[92px] w-full overflow-visible">
        {baselineY != null && (
          <line x1={margin.left} x2={width - margin.right} y1={baselineY} y2={baselineY} stroke="#A3A3A3" strokeDasharray="5 4" strokeWidth="1.5" />
        )}
        {floorY != null && (
          <line x1={margin.left} x2={width - margin.right} y1={floorY} y2={floorY} stroke="#F4A6A6" strokeDasharray="5 4" strokeWidth="1.5" />
        )}
        <path d={buildLine(sisterPoints)} fill="none" stroke="#7CCAC2" strokeWidth="3" strokeLinecap="round" />
        <path d={buildLine(pilotPoints)} fill="none" stroke="#4473D0" strokeWidth="3" strokeLinecap="round" />
        {sisterPoints.map((point, idx) => (
          <circle key={`s-${idx}`} cx={point.x} cy={point.y} r="4.5" fill="#7CCAC2" />
        ))}
        {pilotPoints.map((point, idx) => (
          <circle key={`p-${idx}`} cx={point.x} cy={point.y} r="4.5" fill="#4473D0" />
        ))}
      </svg>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        {series.map((point) => (
          <span key={point.date}>{point.label}</span>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="font-medium text-[#4473D0]">Pilot {formatMetricValue(series.at(-1)?.pilot_value ?? null, format)}</span>
        <span className="font-medium text-[#7CCAC2]">Sister {formatMetricValue(series.at(-1)?.sister_value ?? null, format)}</span>
      </div>
    </div>
  );
}
