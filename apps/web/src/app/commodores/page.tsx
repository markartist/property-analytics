import Link from "next/link";
import { OPS_WATCH_SNAPSHOT } from "@/lib/ops-watch/generated-snapshot";
import type { OpsWatchCommodorePattern, OpsWatchCommodorePropertySignal, OpsWatchCommodoreRegion } from "@/lib/ops-watch/types";
import {
  AlertTriangle,
  Anchor,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Radar,
  ShieldAlert,
  ShipWheel,
  Sparkles,
} from "lucide-react";

const FLAG_LABELS: Record<string, string> = {
  customer_waiting: "Customer waiting",
  stale_14_day: "Stale 14+",
  vendor_idle: "Vendor idle",
  critical: "Critical",
  pending_vendor: "Pending vendor",
  proof_needed: "Proof needed",
  employee_photo: "Employee photo",
  routing_check: "Routing check",
  monitor: "Monitor",
};

function formatOpsDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function postureClasses(posture: string): string {
  if (posture === "blocked") return "border-[#E02472]/35 bg-[#E02472]/10 text-[#E02472]";
  if (posture === "warn") return "border-[#BD4830]/35 bg-[#BD4830]/10 text-[#BD4830]";
  return "border-[#3B9189]/30 bg-[#7DCAC2]/14 text-[#0D5E6D]";
}

function severityClasses(severity: string): string {
  if (severity === "critical") return "border-[#E02472]/35 bg-[#E02472]/10 text-[#E02472]";
  if (severity === "high") return "border-[#BD4830]/35 bg-[#BD4830]/10 text-[#8B2F1F]";
  return "border-[#3D66B9]/24 bg-[#5A81CF]/10 text-[#294782]";
}

function compactList(values: string[], max = 3): string {
  if (values.length <= max) return values.join(", ");
  return `${values.slice(0, max).join(", ")} +${values.length - max}`;
}

function cadenceLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function StatCard({ label, value, note, tone = "standard" }: { label: string; value: number | string; note: string; tone?: "standard" | "alert" | "good" }) {
  const classes = tone === "alert"
    ? "border-[#E02472]/30 bg-[#E02472]/8"
    : tone === "good"
      ? "border-[#3B9189]/24 bg-[#7DCAC2]/12"
      : "border-[#5A81CF]/24 bg-white";
  return (
    <div className={`rounded-lg border px-4 py-3 ${classes}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-normal text-[#15284B]">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{note}</p>
    </div>
  );
}

function PatternCard({ pattern }: { pattern: OpsWatchCommodorePattern }) {
  return (
    <article className="min-w-[280px] rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{pattern.escalationPath}</p>
          <h3 className="mt-1 text-base font-black text-[#15284B]">{pattern.title}</h3>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${severityClasses(pattern.severity)}`}>
          {pattern.severity}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Mini label="Records" value={pattern.recordCount} />
        <Mini label="Properties" value={pattern.propertyCount} />
        <Mini label="Regions" value={pattern.regionCount} />
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{pattern.recommendedAction}</p>
      <p className="mt-3 text-xs font-semibold text-slate-400">{compactList(pattern.affectedRegions)}</p>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-[#F6F6F5] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-[#15284B]">{value}</p>
    </div>
  );
}

function RegionCard({ region }: { region: OpsWatchCommodoreRegion }) {
  const signaled = region.properties.length > 0;
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3B9189]">{region.commodoreName}</p>
          <h2 className="mt-1 text-xl font-black tracking-normal text-[#15284B]">{region.regionName}</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {region.commodoreCallSign} · {region.humanOwner ?? "System persona"} · {cadenceLabel(region.cadence)}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${postureClasses(region.posture)}`}>
          {region.posture}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <Mini label="Roster" value={region.activePropertyCount} />
        <Mini label="Signal" value={region.signaledPropertyCount} />
        <Mini label="Tickets" value={region.activeTicketCount} />
        <Mini label="Stale" value={region.stale14DayCount} />
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-[#F6F6F5] p-3">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
          {FLAG_LABELS[region.topPattern] ?? region.topPattern}
        </p>
        <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{region.nextBestAction}</p>
      </div>

      <details className="mt-3 rounded-lg border border-[#7DCAC2]/30 bg-[#7DCAC2]/10 p-3">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-[#0D5E6D]">
          Standing orders active
        </summary>
        <ul className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-[#0D5E6D]">
          {region.standingOrders.slice(0, 5).map((order) => (
            <li key={order}>{order}</li>
          ))}
        </ul>
      </details>

      {signaled ? (
        <div className="mt-4 grid gap-2">
          {region.properties.slice(0, 4).map((property) => (
            <PropertySignal key={property.propertyCode} property={property} />
          ))}
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-[#3B9189]/20 bg-[#7DCAC2]/10 p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#3B9189]" />
          <p className="text-sm font-semibold leading-6 text-[#0D5E6D]">No mapped ticket pressure in this packet.</p>
        </div>
      )}
    </article>
  );
}

function PropertySignal({ property }: { property: OpsWatchCommodorePropertySignal }) {
  const firstRecord = property.records[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={property.captainHref} className="truncate text-sm font-black text-[#15284B] hover:text-[#3D66B9]">
            {property.propertyCode} {property.propertyName}
          </Link>
          <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
            {property.ticketCount} ticket{property.ticketCount === 1 ? "" : "s"} · {FLAG_LABELS[property.topFlag] ?? property.topFlag}
          </p>
        </div>
        <Link
          href={property.captainHref}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-[#294782] hover:bg-[#F6F6F5]"
          aria-label={`Open Captain for ${property.propertyName}`}
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {firstRecord && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          <a href={firstRecord.itemUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#3D66B9] hover:text-[#15284B]">
            {firstRecord.itemKey}
            <ExternalLink className="h-3 w-3" />
          </a>
          <span>{firstRecord.status}</span>
          <span>{formatOpsDate(firstRecord.updated)}</span>
        </div>
      )}
    </div>
  );
}

export default function CommodoresBridgePage() {
  const bridge = OPS_WATCH_SNAPSHOT.commodoreBridge;
  const pressureRegions = bridge.regions.filter((region) => region.activeTicketCount > 0);
  const quietRegions = bridge.regions.filter((region) => region.activeTicketCount === 0);
  const leadingEscalations = bridge.escalations.slice(0, 4);
  const activeCommodores = bridge.regions.filter((region) => region.activationStatus === "active");

  return (
    <main className="min-h-screen bg-[#F6F6F5] px-5 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-[1680px] space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#7DCAC2]/20 text-[#0D5E6D]">
                  <Radar className="h-5 w-5" />
                </span>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#3B9189]">Commodore’s Bridge</p>
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-normal text-[#15284B]">Regional Captain Command</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                {bridge.operatingModel.owns}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/captains/AR4PB" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-[#15284B] hover:bg-[#F6F6F5]">
                <ShipWheel className="h-4 w-4" />
                Captain’s Office
              </Link>
              <Link href="/watchtower#ops-watch" className="inline-flex items-center gap-2 rounded-lg bg-[#15284B] px-4 py-2 text-sm font-black text-white hover:bg-[#294782]">
                <ClipboardCheck className="h-4 w-4" />
                Ops Watch
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard label="Commodores" value={bridge.summary.activeCommodoreCount} note="standing orders active" tone="good" />
            <StatCard label="Roster" value={bridge.summary.activePropertyCount} note="active properties" tone="good" />
            <StatCard label="Signaled" value={bridge.summary.signaledPropertyCount} note="with ticket pressure" tone="standard" />
            <StatCard label="Critical" value={bridge.summary.criticalCount} note="Captain records" tone={bridge.summary.criticalCount ? "alert" : "good"} />
            <StatCard label="Stale" value={bridge.summary.stale14DayCount} note="14+ day records" tone={bridge.summary.stale14DayCount ? "alert" : "good"} />
            <StatCard label="Escalate" value={bridge.summary.escalationCount} note="regional candidates" tone={bridge.summary.escalationCount ? "alert" : "good"} />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-[#3B9189]" />
              <h2 className="text-lg font-black text-[#15284B]">Commodore Roster</h2>
            </div>
            <p className="text-sm font-semibold text-slate-500">
              {bridge.roster.version} · {cadenceLabel(bridge.roster.cadence)}
            </p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
            {activeCommodores.map((region) => (
              <div key={region.commodoreKey} className="rounded-lg border border-slate-200 bg-[#F6F6F5] px-3 py-3">
                <p className="truncate text-sm font-black text-[#15284B]">{region.commodoreName}</p>
                <p className="mt-1 truncate text-xs font-semibold text-slate-500">{region.regionName}</p>
              </div>
            ))}
          </div>
        </section>

        {leadingEscalations.length > 0 && (
          <section className="rounded-lg border border-[#E02472]/25 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[#E02472]" />
              <h2 className="text-lg font-black text-[#15284B]">Escalation Candidates</h2>
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-4">
              {leadingEscalations.map((item) => (
                <article key={item.escalationKey} className="rounded-lg border border-slate-200 bg-[#F6F6F5] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{item.regionName}</p>
                      <h3 className="mt-1 text-base font-black text-[#15284B]">{item.title}</h3>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${severityClasses(item.severity)}`}>
                      {item.severity}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{item.recommendedAction}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.captainHrefs.map((href) => (
                      <Link key={href} href={href} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-[#294782] hover:bg-[#F6F6F5]">
                        {href.replace("/captains/", "")}
                      </Link>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#3B9189]" />
              <h2 className="text-lg font-black text-[#15284B]">Shared Patterns</h2>
            </div>
            <p className="text-sm font-semibold text-slate-500">
              {bridge.summary.crossRegionPatternCount} cross-region pattern{bridge.summary.crossRegionPatternCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {bridge.patterns.map((pattern) => (
              <PatternCard key={pattern.patternKey} pattern={pattern} />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Anchor className="h-5 w-5 text-[#3B9189]" />
              <h2 className="text-lg font-black text-[#15284B]">Regional Pressure</h2>
            </div>
            <p className="text-sm font-semibold text-slate-500">
              Snapshot {formatOpsDate(OPS_WATCH_SNAPSHOT.asOf)}
            </p>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {pressureRegions.map((region) => (
              <RegionCard key={region.regionKey} region={region} />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#BD4830]" />
            <h2 className="text-lg font-black text-[#15284B]">Quiet Regions</h2>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {quietRegions.map((region) => (
              <div key={region.regionKey} className="rounded-lg border border-slate-200 bg-[#F6F6F5] px-3 py-3">
                <p className="truncate text-sm font-black text-[#15284B]">{region.regionName}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{region.activePropertyCount} active properties</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
