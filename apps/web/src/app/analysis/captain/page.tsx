"use client";

import React from "react";
import {
  Activity,
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Database,
  ListChecks,
  RefreshCw,
  ShipWheel,
} from "lucide-react";
import {
  getCaptainBriefRead,
  getCaptainCommandCenter,
  getCaptainRoster,
  getCommunities,
  type CaptainBriefRead,
  type CaptainCommandCenter,
  type CaptainRosterResponse,
  type Community,
} from "@/lib/api";

const DEFAULT_PROPERTY_CODE = "AR4PB";

function formatDate(value: unknown): string {
  if (!value || typeof value !== "string") return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${month}/${day}/${year}` : value;
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  return `$${number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function sourceLabel(key: string): string {
  const labels: Record<string, string> = {
    guestCards: "Guest Cards",
    unitFeed: "Unit Feed",
    marketingBiPacket: "Marketing BI Packet",
    availableUnitInterest: "Unit Interest",
    trafficConversions: "Traffic Conversions",
    cancelDenial: "Cancel / Denial",
    ga4: "GA4",
    gsc: "GSC",
    googleAds: "Google Ads",
    googleAdsPosture: "Ads Posture",
    psi: "PSI",
    gbp: "GBP",
    reputationCom: "Reputation.com",
    competitorMarketResearch: "Competitor Market",
    marketingOpsSummary: "Marketing Ops Summary",
    dataforseoRankings: "DataForSEO Rankings",
    dataforseoOnPage: "DataForSEO OnPage",
    dataforseoBusiness: "DataForSEO Business Profile",
  };
  return labels[key] ?? key;
}

function percent(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = number(value);
  return `${parsed >= 0 ? "+" : ""}${(parsed * 100).toFixed(1)}%`;
}

function StatusPill({ status }: { status: unknown }) {
  const value = String(status ?? "open");
  const isGood = ["success", "resolved", "done", "draft"].includes(value);
  const isWarning = ["warning", "open", "in_progress", "monitoring", "blocked"].includes(value);
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        isGood ? "bg-emerald-50 text-emerald-700" : isWarning ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600",
      ].join(" ")}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

function SupRef({ id }: { id: string }) {
  return (
    <sup className="ml-1 align-super text-[10px] font-black text-[#0057c2]">
      <a href={`#data-integrity-${id}`} className="hover:underline">[{id}]</a>
    </sup>
  );
}

function EvidenceRefs({ ids }: { ids: unknown }) {
  const values = Array.isArray(ids) ? ids.map((id) => String(id)) : [];
  return <>{values.map((id) => <SupRef key={id} id={id} />)}</>;
}

function Header({ brief }: { brief: CaptainBriefRead }) {
  return (
    <header className="border-b border-slate-200 bg-white px-6 py-8 text-center">
      <div className="mx-auto max-w-6xl">
        <div className="flex justify-center">
          <div className="flex items-center gap-3 text-[#15284B]">
            <ShipWheel className="h-7 w-7" />
            <span className="text-sm font-black uppercase tracking-[0.42em]">Venterra</span>
          </div>
        </div>
        <p className="mt-7 text-sm font-bold uppercase tracking-[0.22em] text-[#0057c2]">Captain Brief</p>
        <h1 className="mt-4 text-4xl font-black tracking-normal text-slate-700 md:text-5xl">{brief.property.name}</h1>
        <p className="mt-4 text-lg font-semibold text-slate-400">{brief.captainName} Resolution Read</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm font-semibold text-slate-500">
          <span>{formatDate(brief.period.start)} to {formatDate(brief.period.end)}</span>
          <span>•</span>
          <span>Generated {formatDate(brief.period.generatedAt)}</span>
          <span>•</span>
          <span>Property ID: {brief.propertyCode}</span>
          <span>•</span>
          <span>Captain: {brief.captainName.replace(/^Captain\s+/i, "")}</span>
        </div>
      </div>
    </header>
  );
}

function KpiStrip({ brief }: { brief: CaptainBriefRead }) {
  const { buckets } = brief.inventory;
  const items = [
    { label: "Active Watch Items", value: brief.activeWatchItems.length, note: "open, monitoring, escalated" },
    { label: "Open Actions", value: brief.activeActions.length, note: "owner-tracked next moves" },
    { label: "Units 90+ Days", value: buckets.aged90, note: `${buckets.aged60} at 60+ days` },
    { label: "Units 365+ Days", value: buckets.aged365, note: "requires classification" },
  ];
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{item.value}</p>
          <p className="mt-2 text-sm font-medium text-slate-500">{item.note}</p>
        </div>
      ))}
    </section>
  );
}

function CaptainRead({ brief }: { brief: CaptainBriefRead }) {
  return (
    <section className="rounded-lg border border-cyan-100 bg-cyan-50 p-6">
      <div className="flex items-start gap-4">
        <Database className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
        <div>
          <h2 className="text-xl font-black text-slate-900">Current Read</h2>
          <p className="mt-3 max-w-5xl text-lg leading-8 text-slate-800">{brief.summary}</p>
          <p className="mt-5 text-sm font-semibold text-cyan-900">{brief.sourceAuthority}</p>
        </div>
      </div>
    </section>
  );
}

function DiagnosticRead({ brief }: { brief: CaptainBriefRead }) {
  const diagnostic = brief.diagnosticRead;
  const recovery = diagnostic.recoveryMath;
  const doctrine = diagnostic.designationDoctrine ?? {};
  const peerRead = diagnostic.peerFamilyRead;
  const cards = [
    { label: "Primary Constraint", value: diagnostic.primaryConstraint.replace(/_/g, " "), note: `confidence: ${diagnostic.confidence}` },
    { label: "Move-Ins Needed", value: text(recovery.moveInsNeeded), note: "to reach 10% exposure" },
    { label: "Guest Cards Needed", value: text(recovery.guestCardsNeededAtCurrentClose), note: recovery.volumeMultiple ? `${recovery.volumeMultiple}x current T30 volume` : "at current close ratio" },
    { label: "Volume Realistic", value: recovery.volumeRealistic === null ? "-" : recovery.volumeRealistic ? "Yes" : "No", note: `close ratio ${percent(recovery.closeRatio)}` },
  ];
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-[#0057c2]" />
        <h2 className="text-2xl font-black text-slate-900">Diagnostic Plan</h2>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-5xl text-base font-semibold leading-7 text-slate-700">{diagnostic.executiveRead}</p>
          <StatusPill status={diagnostic.confidence} />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-black capitalize text-slate-900">{card.value}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{card.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">Designation Doctrine</p>
            <p className="mt-2 text-lg font-black text-slate-900">{text(doctrine.designation) || "Baseline"}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{text(doctrine.meaning)}</p>
            <p className="mt-2 text-sm font-semibold text-blue-900">Cadence: {text(doctrine.attentionLevel).replace(/_/g, " ")}</p>
            <p className="mt-1 text-sm font-semibold text-blue-900">Escalation: {text(doctrine.escalationRule)}</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Peer Family Read</p>
              <StatusPill status={peerRead.status} />
            </div>
            {peerRead.peerSet.length > 0 ? (
              <div className="mt-3 space-y-3">
                {peerRead.peerSet.slice(0, 3).map((peer) => (
                  <div key={`${text(peer.propertyCode)}-${text(peer.propertyName)}`} className="rounded-lg bg-white/70 p-3">
                    <p className="font-black text-slate-900">{text(peer.propertyName)}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{text(peer.reason)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{text(peerRead.message) || "No stronger peer identified in this cycle."}</p>
            )}
          </div>
        </div>
        {peerRead.borrowableTactics.length > 0 && (
          <div className="mt-5 rounded-lg border border-emerald-100 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Borrowable Peer Tactics</p>
            <div className="mt-3 space-y-3">
              {peerRead.borrowableTactics.map((tactic, index) => (
                <div key={`${text(tactic.sourcePeer)}-${index}`} className="rounded-lg bg-slate-50 p-4">
                  <p className="font-bold leading-6 text-slate-800">{text(tactic.tactic)}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-500">Peer: {text(tactic.sourcePeer)} · Confidence: {text(tactic.confidence)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Proof: {text(tactic.proofCheck)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {diagnostic.recommendations.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Recommended Fixes</p>
            <div className="mt-3 space-y-3">
              {diagnostic.recommendations.map((item, index) => (
                <div key={`${text(item.constraint)}-${index}`} className="rounded-lg border border-slate-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-black uppercase tracking-[0.08em] text-slate-500">{text(item.constraint).replace(/_/g, " ")}</p>
                    <span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">{text(item.confidence)} confidence</span>
                  </div>
                  <p className="mt-2 font-bold leading-6 text-slate-800">{text(item.action)}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-500">Owner: {text(item.owner_role)} · Due: {text(item.due_date)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Proof: {text(item.proof_check)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {diagnostic.doNotRecommend.length > 0 && (
          <div className="mt-5 rounded-lg border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">Do Not Recommend Yet</p>
            <ul className="mt-3 space-y-2">
              {diagnostic.doNotRecommend.map((gate) => (
                <li key={gate} className="text-sm font-semibold leading-6 text-amber-900">{gate}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-4 text-sm font-semibold text-slate-500">{diagnostic.proofCadence}</p>
      </div>
    </section>
  );
}

function SourceReadiness({ brief }: { brief: CaptainBriefRead }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        <h2 className="text-2xl font-black text-slate-900">Source Readiness</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(brief.sources).map(([key, value]) => (
          <div key={key} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{sourceLabel(key)}</p>
            <p className="mt-2 text-lg font-black text-slate-900">{key === "googleAdsPosture" ? text(value).replace(/_/g, " ") : formatDate(value)}</p>
          </div>
        ))}
      </div>
      {brief.resolvedSourceItems.length > 0 && (
        <p className="mt-4 text-sm font-medium text-slate-500">
          Resolved source-routing items: {brief.resolvedSourceItems.map((item) => text(item.watch_key).replace(/_/g, " ")).join(", ")}.
        </p>
      )}
    </section>
  );
}

function OperatingSnapshot({ brief }: { brief: CaptainBriefRead }) {
  const metrics = brief.operatingSnapshot.metrics;
  const rows = [
    { label: "Occupancy", value: metrics?.occupancy_rate ? `${(number(metrics.occupancy_rate) * 100).toFixed(1)}%` : "-" },
    { label: "Leased", value: metrics?.leased_rate ? `${(number(metrics.leased_rate) * 100).toFixed(1)}%` : "-" },
    { label: "Leases", value: metrics?.leases_count ?? "-" },
    { label: "Cancellations", value: metrics?.cancellations_count ?? "-" },
    { label: "Booked Concessions", value: metrics?.booked_concession_dollars !== null && metrics?.booked_concession_dollars !== undefined ? money(metrics.booked_concession_dollars) : "-" },
  ];
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Database className="h-5 w-5 text-[#0057c2]" />
        <h2 className="text-2xl font-black text-slate-900">Operating Snapshot</h2>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-4xl text-sm font-semibold leading-6 text-slate-600">{brief.operatingSnapshot.message}</p>
          <StatusPill status={brief.operatingSnapshot.status} />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-5">
          {rows.map((row) => (
            <div key={row.label} className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{row.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{text(row.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MarketingInsight({ brief }: { brief: CaptainBriefRead }) {
  const insight = brief.marketingInsight;
  const metrics = insight.conversionRead.metrics;
  const sourceSpend = insight.sourceSpendRead ?? {};
  const sourceSpendMetrics = (sourceSpend.metrics && typeof sourceSpend.metrics === "object" ? sourceSpend.metrics : {}) as Record<string, unknown>;
  const bestSources = (sourceSpend.bestSources && typeof sourceSpend.bestSources === "object" ? sourceSpend.bestSources : {}) as Record<string, unknown>;
  const channelEconomics = Array.isArray(sourceSpend.channelEconomics) ? sourceSpend.channelEconomics as Array<Record<string, unknown>> : [];
  const unitTypeTargeting = (sourceSpend.unitTypeTargeting && typeof sourceSpend.unitTypeTargeting === "object" ? sourceSpend.unitTypeTargeting : {}) as Record<string, unknown>;
  const unitTypeRows = Array.isArray(unitTypeTargeting.rows) ? unitTypeTargeting.rows as Array<Record<string, unknown>> : [];
  const bestLease = (bestSources.lease && typeof bestSources.lease === "object" ? bestSources.lease : null) as Record<string, unknown> | null;
  const bestApp = (bestSources.application && typeof bestSources.application === "object" ? bestSources.application : null) as Record<string, unknown> | null;
  const cards = [
    { label: "T30 Guest Cards", value: text(metrics.t30GuestCards), note: `${percent(metrics.t30Yoy)} YoY` },
    { label: "Available Units", value: text(metrics.availableUnits), note: `${text(metrics.vacantAvailableUnits)} vacant / ${text(metrics.noticeAvailableUnits)} notice` },
    { label: "GC per Available Unit", value: metrics.t30PerAvailableUnit === null || metrics.t30PerAvailableUnit === undefined ? "-" : Number(metrics.t30PerAvailableUnit).toFixed(1), note: "T30 demand intensity" },
    { label: "T30 Quotes", value: text(metrics.t30QuoteVolume), note: "prospect quote volume" },
  ];
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Database className="h-5 w-5 text-cyan-700" />
        <h2 className="text-2xl font-black text-slate-900">Marketing BI Read</h2>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Packet {formatDate(insight.packet?.report_date)} · Period {formatDate(insight.packet?.selected_period_start)} to {formatDate(insight.packet?.selected_period_end)}
            </p>
            <p className="mt-3 max-w-5xl text-base font-semibold leading-7 text-slate-700">{insight.narrative}</p>
          </div>
          <StatusPill status={insight.status} />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{card.value}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{card.note}</p>
            </div>
          ))}
        </div>
        {(insight.cancelDenial.topReasons.length > 0 || insight.cancelDenial.topSources.length > 0) && (
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-100 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Top Friction Reasons</p>
              <div className="mt-3 space-y-2">
                {insight.cancelDenial.topReasons.map((item) => (
                  <div key={item.reason} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-700">{item.reason}</span>
                    <span className="font-black text-slate-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-100 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Top Friction Sources</p>
              <div className="mt-3 space-y-2">
                {insight.cancelDenial.topSources.map((item) => (
                  <div key={item.source} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-700">{item.source}</span>
                    <span className="font-black text-slate-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="mt-5 rounded-lg border border-slate-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Source / Spend Economics</p>
            <StatusPill status={text(sourceSpend.status)} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Latest Spend</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{money(sourceSpendMetrics.latestAdSpendTotal)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{text(sourceSpendMetrics.latestSpendMonth)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Best Lease Source</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{text(bestLease?.sourceGroup)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{money(bestLease?.costPerLease)} / lease</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Best App Source</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{text(bestApp?.sourceGroup)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{money(bestApp?.costPerApplication)} / app</p>
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">{text(sourceSpend.sourceAuthority)}</p>
        </div>
        {channelEconomics.length > 0 && (
          <div className="mt-5 rounded-lg border border-slate-100 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Channel Cost Efficiency</p>
              <p className="text-sm font-semibold text-slate-500">Cost / PQ plus derived cost / move-in where the source has move-ins.</p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2 text-right">PQ</th>
                    <th className="px-3 py-2 text-right">Move-Ins</th>
                    <th className="px-3 py-2 text-right">Cost / PQ</th>
                    <th className="px-3 py-2 text-right">Cost / Move-In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {channelEconomics.slice(0, 8).map((row) => (
                    <tr key={`${text(row.source)}-${text(row.leases)}-${text(row.moveIns)}`}>
                      <td className="px-3 py-2 font-semibold text-slate-800">{text(row.source)}</td>
                      <td className="px-3 py-2 text-right font-black text-slate-900">{text(row.leases)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{text(row.moveIns)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{money(row.costPerLease)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{money(row.costPerMoveIn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {unitTypeRows.length > 0 && (
          <div className="mt-5 rounded-lg border border-slate-100 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Unit-Type Spend / Targeting</p>
              <p className="text-sm font-semibold text-slate-500">
                Week {formatDate(unitTypeTargeting.weekDate)} · Classified {money(unitTypeTargeting.classifiedSpend)} of {money(unitTypeTargeting.totalSpend)} ({percent(unitTypeTargeting.classifiedShare)}) · {text(unitTypeTargeting.targetedUnitTypes)} unit type(s)
              </p>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-500">PIB-style paid-search targeting evidence showing how much spend is explicitly aimed at unit-type intent versus generic capture.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-3 py-2">Unit Type</th>
                    <th className="px-3 py-2 text-right">Spend</th>
                    <th className="px-3 py-2 text-right">Share</th>
                    <th className="px-3 py-2 text-right">Clicks</th>
                    <th className="px-3 py-2 text-right">Conv.</th>
                    <th className="px-3 py-2">Top Keywords</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unitTypeRows.slice(0, 6).map((row) => {
                    const topKeywords = Array.isArray(row.topKeywords) ? row.topKeywords as Array<Record<string, unknown>> : [];
                    const keywords = topKeywords.slice(0, 3).map((item) => text(item.keyword)).filter((value) => value && value !== "—").join(", ");
                    const totalSpend = typeof unitTypeTargeting.totalSpend === "number" ? unitTypeTargeting.totalSpend : Number(unitTypeTargeting.totalSpend ?? 0);
                    const spend = typeof row.spend === "number" ? row.spend : Number(row.spend ?? 0);
                    const share = totalSpend > 0 ? spend / totalSpend : null;
                    return (
                      <tr key={`${text(row.unitType)}-${text(row.clicks)}-${text(row.conversions)}`}>
                        <td className="px-3 py-2 font-semibold text-slate-800">{text(row.unitType)}</td>
                        <td className="px-3 py-2 text-right font-black text-slate-900">{money(row.spend)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{share === null ? "—" : percent(share)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{text(row.clicks)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{text(row.conversions)}</td>
                        <td className="px-3 py-2 text-slate-700">{keywords || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-500">{text(unitTypeTargeting.sourceAuthority)}</p>
          </div>
        )}
        <p className="mt-4 text-sm font-semibold text-slate-500">{insight.sourceAuthority}</p>
      </div>
    </section>
  );
}

function CompetitorMarketRead({ brief }: { brief: CaptainBriefRead }) {
  const read = brief.competitorMarketRead ?? {};
  const counts = (read.counts && typeof read.counts === "object" ? read.counts : {}) as Record<string, unknown>;
  const subject = (read.subject && typeof read.subject === "object" ? read.subject : {}) as Record<string, unknown>;
  const pricingPressure = (read.pricingPressure && typeof read.pricingPressure === "object" ? read.pricingPressure : {}) as Record<string, unknown>;
  const decision = (read.decision && typeof read.decision === "object" ? read.decision : {}) as Record<string, unknown>;
  const stephanie = (read.stephanieAnswers && typeof read.stephanieAnswers === "object" ? read.stephanieAnswers : {}) as Record<string, unknown>;
  const competitors = Array.isArray(read.competitors) ? read.competitors as Array<Record<string, unknown>> : [];
  const lowerRentCompetitors = Array.isArray(pricingPressure.lowerRentCompetitors) ? pricingPressure.lowerRentCompetitors as Array<Record<string, unknown>> : [];
  const confirmedSpecials = Array.isArray(pricingPressure.confirmedSpecials) ? pricingPressure.confirmedSpecials as Array<Record<string, unknown>> : [];
  const ownedSpecials = Array.isArray(subject.visibleSpecials) ? subject.visibleSpecials as unknown[] : [];
  const sourceGaps = Array.isArray(read.sourceGaps) ? read.sourceGaps as Array<Record<string, unknown>> : [];
  const why = Array.isArray(read.why) ? read.why as Array<Record<string, unknown>> : [];
  const decisionItems: Array<[string, unknown]> = [
    ["Pricing", decision.pricing],
    ["Advertising", decision.advertising],
    ["Web Copy", decision.webCopy],
    ["Ad Copy", decision.adCopy],
    ["Package Review", decision.packageReview],
  ];
  const cards = [
    { label: "Our Visible Rent", value: `${money(subject.rentMin)} - ${money(subject.rentMax)}`, note: `unit feed ${formatDate(subject.unitFeedSnapshotDate)}` },
    { label: "Comp Set", value: text(counts.competitors), note: "sourced competitors" },
    { label: "Lower Rent Comps", value: text(lowerRentCompetitors.length), note: "visible starting rent" },
    { label: "Comp Specials", value: text(confirmedSpecials.length), note: "confirmed public specials" },
  ];
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Database className="h-5 w-5 text-violet-700" />
        <h2 className="text-2xl font-black text-slate-900">Competitive Market Read</h2>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Snapshot {formatDate(read.snapshotDate)} · {text(read.marketName)}
            </p>
            <p className="mt-3 max-w-5xl text-base font-semibold leading-7 text-slate-700">
              {text(read.decisionSummary)}
              <EvidenceRefs ids={["CM-1", "CM-2", "CM-3", "CM-4"]} />
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-500">{text(read.sourceAuthority)}</p>
          </div>
          <StatusPill status={read.status} />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{card.value}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {card.note}
                {card.label === "Our Visible Rent" && <SupRef id="CM-1" />}
                {card.label === "Lower Rent Comps" && <SupRef id="CM-2" />}
                {card.label === "Comp Specials" && <SupRef id="CM-3" />}
              </p>
            </div>
          ))}
        </div>
        {ownedSpecials.length > 0 && (
          <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">Our Current Visible Specials<SupRef id="CM-1" /></p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ownedSpecials.map((special) => (
                <span key={text(special)} className="rounded-full bg-white px-3 py-1 text-sm font-bold text-blue-900">{text(special)}</span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-violet-100 bg-violet-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-700">Captain Decision Logic</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {decisionItems.map(([label, value]) => (
                <div key={label} className="rounded-lg bg-white/80 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.1em] text-violet-700">{label}</p>
                  <p className="mt-1 text-sm font-bold leading-5 text-slate-800">{text(value).replace(/_/g, " ")}</p>
                </div>
              ))}
            </div>
            {why.length > 0 && (
              <div className="mt-4 space-y-3">
                {why.map((item, index) => (
                  <div key={`${text(item.statement)}-${index}`} className="rounded-lg bg-white/70 p-3">
                    <p className="text-sm font-black text-slate-900">
                      {text(item.statement)}
                      <EvidenceRefs ids={item.refs} />
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{text(item.why)}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{text(stephanie.pricingVsAdvertising)}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{text(stephanie.adCopy)}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{text(stephanie.webCopy)}</p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">What We Cannot Confirm<SupRef id="CM-4" /></p>
            <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">{text(stephanie.packageStatus)}</p>
            {sourceGaps.length > 0 && (
              <ul className="mt-3 space-y-2">
                {sourceGaps.slice(0, 3).map((gap, index) => (
                  <li key={`${text(gap.sourceUrl)}-${index}`} className="text-sm font-semibold leading-6 text-amber-900">{text(gap.claim)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {lowerRentCompetitors.length > 0 && (
          <div className="mt-5 rounded-lg border border-slate-100 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Lower Visible Rent Pressure</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {lowerRentCompetitors.slice(0, 6).map((item) => (
                <div key={text(item.competitorName)} className="rounded-lg bg-slate-50 p-4">
                  <p className="font-black text-slate-900">{text(item.competitorName)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">Starts at {money(item.rentMin)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Gap vs subject: {money(item.gapVsSubjectMin)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {confirmedSpecials.length > 0 && (
          <div className="mt-5 rounded-lg border border-slate-100 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Confirmed Visible Specials</p>
            <div className="mt-3 space-y-3">
              {confirmedSpecials.slice(0, 5).map((item, index) => (
                <div key={`${text(item.competitorName)}-${index}`} className="rounded-lg bg-slate-50 p-4">
                  <p className="font-black text-slate-900">{text(item.competitorName)}</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{text(item.specialText)}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Captured {formatDate(item.capturedDate)} · {text(item.confidence)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {competitors.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Competitor", "Rent Range", "Specials", "USP Rows", "Sources"].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {competitors.map((item) => {
                  const specials = Array.isArray(item.specials) ? item.specials : [];
                  const usps = Array.isArray(item.usps) ? item.usps : [];
                  const sources = Array.isArray(item.sourceUrls) ? item.sourceUrls : [];
                  return (
                    <tr key={text(item.competitorName)}>
                      <td className="px-4 py-3 font-black text-slate-900">{text(item.competitorName)}</td>
                      <td className="px-4 py-3 text-slate-700">{money(item.rentMin)} - {money(item.rentMax)}</td>
                      <td className="px-4 py-3 text-slate-700">{specials.length}</td>
                      <td className="px-4 py-3 text-slate-700">{usps.length}</td>
                      <td className="px-4 py-3 text-slate-700">{sources.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function DataIntegrityPanel({ brief }: { brief: CaptainBriefRead }) {
  const read = brief.competitorMarketRead ?? {};
  const references = Array.isArray(read.evidenceReferences) ? read.evidenceReferences as Array<Record<string, unknown>> : [];
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Database className="h-5 w-5 text-slate-500" />
        <h2 className="text-2xl font-black text-slate-900">Data Integrity</h2>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="max-w-5xl text-sm font-semibold leading-6 text-slate-600">
          Superscript references identify the source behind Captain statements. Confirmed evidence can support recommendations; missing or unverified evidence can only support a source-gap or human-review action.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {references.map((ref) => (
            <div id={`data-integrity-${text(ref.id)}`} key={text(ref.id)} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-slate-900">[{text(ref.id)}] {text(ref.label)}</p>
                <StatusPill status={ref.confidence} />
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-700">Source: {text(ref.source)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Date: {formatDate(ref.date)} · Type: {text(ref.sourceType).replace(/_/g, " ")}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{text(ref.detail)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WatchAndActions({ brief }: { brief: CaptainBriefRead }) {
  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div>
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h2 className="text-2xl font-black text-slate-900">Active Watch</h2>
        </div>
        <div className="space-y-3">
          {brief.activeWatchItems.map((item) => (
            <div key={text(item.id)} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-black text-slate-900">{text(item.title)}</h3>
                <StatusPill status={item.status} />
              </div>
              <p className="mt-3 leading-7 text-slate-700">{text(item.current_state)}</p>
              <p className="mt-3 text-sm font-semibold text-slate-500">{text(item.next_move)}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-4 flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-[#0057c2]" />
          <h2 className="text-2xl font-black text-slate-900">Action Register</h2>
        </div>
        <div className="space-y-3">
          {brief.activeActions.map((item) => (
            <div key={text(item.id)} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-black text-slate-900">{text(item.title)}</h3>
                <StatusPill status={item.status} />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-500">Owner: {text(item.owner_role)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Priority: {text(item.priority)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AgedUnitSection({ brief }: { brief: CaptainBriefRead }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Aged Unit Detail</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Snapshot {formatDate(brief.inventory.latestSnapshot)}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-bold text-slate-700">
          <span className="rounded-full bg-slate-100 px-3 py-1">30+: {brief.inventory.buckets.aged30}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">60+: {brief.inventory.buckets.aged60}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">90+: {brief.inventory.buckets.aged90}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">180+: {brief.inventory.buckets.aged180}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">365+: {brief.inventory.buckets.aged365}</span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Unit", "Floorplan", "Days", "Moved Out", "Available", "Rent", "Concession"].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {brief.inventory.agedUnits.map((unit) => (
              <tr key={`${text(unit.unit_id)}-${text(unit.apt_number)}`}>
                <td className="px-4 py-3 font-black text-slate-900">{text(unit.apt_number || unit.unit_id)}</td>
                <td className="px-4 py-3 text-slate-700">{text(unit.floorplan_name)}</td>
                <td className="px-4 py-3 font-bold text-slate-900">{text(unit.days_unleased)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(unit.moved_out_date)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(unit.available_date)}</td>
                <td className="px-4 py-3 text-slate-700">{money(unit.rent_from)}</td>
                <td className="max-w-[320px] px-4 py-3 text-slate-600">{text(unit.pricing_and_specials_message || unit.concession_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RecentRuns({ brief }: { brief: CaptainBriefRead }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Clock3 className="h-5 w-5 text-slate-500" />
        <h2 className="text-2xl font-black text-slate-900">Captain Runtime</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {brief.recentRuns.slice(0, 8).map((run) => (
          <div key={text(run.id)} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <p className="font-black text-slate-900">{text(run.agent_key).replace(/_/g, " ")}</p>
              <p className="text-sm font-medium text-slate-500">{formatDate(run.finished_at)}</p>
            </div>
            <StatusPill status={run.run_status} />
          </div>
        ))}
      </div>
    </section>
  );
}

function CaptainCommandCenterPanel({
  roster,
  command,
  propertyId,
  onSelect,
}: {
  roster: CaptainRosterResponse | null;
  command: CaptainCommandCenter | null;
  propertyId: string;
  onSelect: (propertyCode: string) => void;
}) {
  const rosterItems = roster?.items ?? [];
  const selected = rosterItems.find((item) => item.propertyCode === propertyId);
  const topStats = [
    { label: "Captains", value: roster?.summary.propertyCount ?? "-", note: `${roster?.summary.activeAgentCount ?? 0} active support agents` },
    { label: "Focused / Urgent", value: `${roster?.summary.focusedCount ?? 0}/${roster?.summary.urgentCount ?? 0}`, note: "Spotlight, Sale, Critical posture" },
    { label: "Open Watch", value: roster?.summary.activeWatchCount ?? "-", note: "monitoring and escalated items" },
    { label: "Open Actions", value: roster?.summary.activeActionCount ?? "-", note: `${roster?.summary.staleMemoryCount ?? 0} memory refresh candidates` },
  ];
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0057c2]">Captain Command Center</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-slate-900">Inspect the Captain, not just the Brief</h2>
          <p className="mt-2 max-w-4xl text-base font-semibold leading-7 text-slate-600">
            Roster, runtime, memory, source coverage, watch items, and action ownership for the property-scoped Captain system.
          </p>
        </div>
        {selected ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Current Captain</p>
            <p className="mt-1 text-lg font-black text-slate-900">{selected.propertyName}</p>
            <p className="text-sm font-semibold capitalize text-slate-500">
              {selected.commandPosture.intensity} · {selected.commandPosture.designation ?? "Baseline"}
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {topStats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{stat.value}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{stat.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Roster</p>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {rosterItems.map((item) => (
              <button
                key={item.propertyCode}
                type="button"
                onClick={() => onSelect(item.propertyCode)}
                className={[
                  "block w-full border-b border-slate-100 px-4 py-3 text-left transition",
                  item.propertyCode === propertyId ? "bg-blue-50" : "bg-white hover:bg-slate-50",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900">{item.propertyName}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{item.propertyCode}</p>
                  </div>
                  <span className={[
                    "rounded-full px-2 py-1 text-xs font-black capitalize",
                    item.commandPosture.intensity === "urgent"
                      ? "bg-rose-50 text-rose-700"
                      : item.commandPosture.intensity === "focused"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600",
                  ].join(" ")}>
                    {item.commandPosture.designation ?? item.commandPosture.intensity}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold text-slate-500">
                  <span>{item.activeWatchCount} watch</span>
                  <span>{item.activeActionCount} actions</span>
                  <span>{item.supportAgentCount} agents</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-400">Latest run: {formatDate(item.latestRunAt)}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <CommandMiniPanel
              icon={Activity}
              label="Runtime"
              value={`${command?.latestRuns.length ?? 0} recent runs`}
              detail={`Latest: ${formatDate(command?.latestRuns[0]?.finished_at)}`}
            />
            <CommandMiniPanel
              icon={BookOpenText}
              label="Memory"
              value={`${command?.memoryEntries.length ?? 0} entries`}
              detail={`Latest: ${formatDate(command?.memoryEntries[0]?.created_at)}`}
            />
            <CommandMiniPanel
              icon={ClipboardList}
              label="Ownership"
              value={`${command?.actions.filter((item) => ["open", "in_progress", "blocked"].includes(String(item.status))).length ?? 0} open actions`}
              detail={`${command?.watchItems.filter((item) => ["open", "monitoring", "escalated"].includes(String(item.status))).length ?? 0} active watch items`}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <CommandList title="Current Runs" rows={(command?.latestRuns ?? []).slice(0, 6)} primary="agent_key" secondary="finished_at" statusKey="run_status" />
            <CommandList title="Captain Memory" rows={(command?.memoryEntries ?? []).slice(0, 6)} primary="summary" secondary="source_system" statusKey="status" />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-slate-500" />
              <h3 className="text-xl font-black text-slate-900">Knowledge And Source Coverage</h3>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(command?.sourceCoverage ?? []).map((source) => (
                <div key={source.key} className="rounded-lg bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-slate-900">{source.label}</p>
                    <StatusPill status={source.status === "ready" ? "ready" : "not loaded"} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{source.group} · {source.rows} rows</p>
                  <p className="mt-1 text-sm font-semibold text-slate-400">Latest: {formatDate(source.latest)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <CommandList title="Active Watch" rows={(command?.watchItems ?? []).slice(0, 5)} primary="title" secondary="current_state" statusKey="severity" />
            <CommandList title="Open Actions" rows={(command?.actions ?? []).slice(0, 5)} primary="title" secondary="owner_role" statusKey="status" />
          </div>
        </div>
      </div>
    </section>
  );
}

function CommandMiniPanel({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-[#0057c2]" />
        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function CommandList({
  title,
  rows,
  primary,
  secondary,
  statusKey,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  primary: string;
  secondary: string;
  statusKey: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-xl font-black text-slate-900">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.length ? rows.map((row, index) => (
          <div key={`${title}-${index}-${text(row.id)}`} className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-black leading-6 text-slate-900">{text(row[primary]).replace(/_/g, " ")}</p>
              <StatusPill status={row[statusKey]} />
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-slate-500">{secondary.includes("_at") || secondary === "finished_at" ? formatDate(row[secondary]) : text(row[secondary])}</p>
          </div>
        )) : (
          <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">No rows yet.</p>
        )}
      </div>
    </div>
  );
}

export default function CaptainBriefPage() {
  const [communities, setCommunities] = React.useState<Community[]>([]);
  const [propertyId, setPropertyId] = React.useState(DEFAULT_PROPERTY_CODE);
  const [brief, setBrief] = React.useState<CaptainBriefRead | null>(null);
  const [roster, setRoster] = React.useState<CaptainRosterResponse | null>(null);
  const [command, setCommand] = React.useState<CaptainCommandCenter | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [commandLoading, setCommandLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getCommunities()
      .then((items) => {
        setCommunities(items);
        const pointe = items.find((item) => item.encasa_property_code === DEFAULT_PROPERTY_CODE);
        if (pointe?.encasa_property_code) setPropertyId(pointe.encasa_property_code);
      })
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    getCaptainRoster().then(setRoster).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    setCommandLoading(true);
    getCaptainCommandCenter(propertyId)
      .then(setCommand)
      .catch(() => setCommand(null))
      .finally(() => setCommandLoading(false));
  }, [propertyId]);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    getCaptainBriefRead(propertyId)
      .then(setBrief)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [propertyId]);

  return (
    <div className="min-h-screen bg-slate-50">
      {brief ? <Header brief={brief} /> : <div className="border-b border-slate-200 bg-white px-6 py-8" />}
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <select
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm"
          >
            <option value={DEFAULT_PROPERTY_CODE}>The Pointe Bentonville</option>
            {communities
              .filter((community) => community.encasa_property_code && community.encasa_property_code !== DEFAULT_PROPERTY_CODE)
              .map((community) => (
                <option key={community.id} value={community.encasa_property_code ?? community.id}>{community.name}</option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setCommandLoading(true);
              getCaptainRoster().then(setRoster).catch(() => undefined);
              getCaptainCommandCenter(propertyId).then(setCommand).catch(() => setCommand(null)).finally(() => setCommandLoading(false));
              getCaptainBriefRead(propertyId).then(setBrief).catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
            }}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#15284B] px-4 text-sm font-bold text-white shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <CaptainCommandCenterPanel roster={roster} command={commandLoading ? null : command} propertyId={propertyId} onSelect={setPropertyId} />

        {loading && <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-semibold text-slate-500">Loading Captain Brief...</div>}
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 font-semibold text-rose-700">{error}</div>}
        {brief && !loading && (
          <>
            <KpiStrip brief={brief} />
            <CaptainRead brief={brief} />
            <DiagnosticRead brief={brief} />
            <SourceReadiness brief={brief} />
            <MarketingInsight brief={brief} />
            <CompetitorMarketRead brief={brief} />
            <OperatingSnapshot brief={brief} />
            <WatchAndActions brief={brief} />
            <AgedUnitSection brief={brief} />
            <RecentRuns brief={brief} />
            <DataIntegrityPanel brief={brief} />
          </>
        )}
      </main>
    </div>
  );
}
