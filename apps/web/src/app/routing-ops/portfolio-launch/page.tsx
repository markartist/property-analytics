"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ExternalLink,
  Globe2,
  LockKeyhole,
  RotateCcw,
  Route,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import readinessData from "@/data/portfolio-launch-readiness.json";

type LaunchRow = {
  propertyName: string;
  propertyCode: string;
  market: string;
  routeStatus: string;
  launchReadinessStatus: string;
  currentSourcePath: string;
  newCityStatePath: string;
  oldBetaUrl: string;
  betaCityStateUrl: string;
  futureProductionUrl: string;
  stagingOriginUrl: string;
  originHostHeader: string;
  healthCheckUrl: string;
  originAuthStatus: string;
  rewritePolicy: string;
  seoRedirectStatus: string;
  canonicalStatus: string;
  sitemapStatus: string;
  robotsStatus: string;
  queryPolicy: string;
  vanityDomainStatus: string;
  testStatus: string;
  launchBatch: string;
  approvalStatus: string;
  rollbackPlanStatus: string;
  notes: string;
};

type ReadinessPayload = {
  summary: {
    totalRows: number;
    pilotReadyRows: number;
    awaitingStagingOrigin: number;
    sourcePathReviewRequired: number;
    identityReviewRequired: number;
    localTestPassed: number;
    productionApproved: number;
  };
  rows: LaunchRow[];
};

const readiness = readinessData as ReadinessPayload;

type FilterId = "all" | "ready" | "origin" | "source" | "identity";

function propertySortKey(value: string) {
  return (value || "").replace(/^the\s+/i, "").toLowerCase();
}

function humanize(value: string) {
  if (!value) return "Open";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Tbd", "TBD");
}

function conditionFor(row: LaunchRow) {
  if (row.launchReadinessStatus === "pilot_ready_for_local_beta") return "Ready for beta";
  if (row.launchReadinessStatus === "blocked_pending_staging_origin") return "Needs origin";
  if (row.launchReadinessStatus === "blocked_pending_source_path_review") return "Needs source path";
  if (row.launchReadinessStatus === "blocked_pending_identity_review") return "Needs identity";
  return "Needs review";
}

function lifecycleFor(row: LaunchRow) {
  if (row.approvalStatus === "approved_for_production") return "Production approved";
  if (row.launchReadinessStatus === "pilot_ready_for_local_beta") return "Beta ready";
  if (row.launchReadinessStatus === "blocked_pending_staging_origin") return "Draft: origin";
  if (row.launchReadinessStatus === "blocked_pending_source_path_review") return "Draft: source path";
  if (row.launchReadinessStatus === "blocked_pending_identity_review") return "Draft: identity";
  return "Draft review";
}

function seoGateFor(row: LaunchRow) {
  const checks = [row.canonicalStatus, row.robotsStatus, row.sitemapStatus];
  if (checks.every((status) => status && status !== "tbd")) return "SEO proof ready";
  if (row.launchReadinessStatus === "pilot_ready_for_local_beta") return "SEO proof pending";
  return "SEO blocked";
}

function routeGateFor(row: LaunchRow) {
  if (row.testStatus === "local_route_test_passed") return "Route test ready";
  if (row.routeStatus === "awaiting_staging_origin") return "Origin missing";
  if (row.routeStatus === "source_path_review_required") return "Source review";
  if (row.routeStatus === "identity_review_required") return "Identity review";
  return "Route review";
}

function rollbackGateFor(row: LaunchRow) {
  if (!row.rollbackPlanStatus || row.rollbackPlanStatus.includes("pending")) return "Rollback pending";
  return humanize(row.rollbackPlanStatus);
}

function legacyTargetFor(row: LaunchRow) {
  return row.currentSourcePath ? `https://venterraliving.com${row.currentSourcePath}` : "";
}

function deliveryModeFor(row: LaunchRow) {
  if (row.stagingOriginUrl && row.currentSourcePath) return "Switchable";
  if (row.currentSourcePath) return "Legacy baseline";
  if (row.stagingOriginUrl) return "Candidate only";
  return "Route review";
}

function conditionTone(row: LaunchRow) {
  if (row.launchReadinessStatus === "pilot_ready_for_local_beta") {
    return "border-[#3B9189]/30 bg-[#3B9189]/10 text-[#1f6f69]";
  }
  if (row.launchReadinessStatus === "blocked_pending_staging_origin") {
    return "border-[#BD4830]/30 bg-[#BD4830]/10 text-[#9f3522]";
  }
  if (row.launchReadinessStatus === "blocked_pending_identity_review") {
    return "border-[#E02472]/30 bg-[#E02472]/10 text-[#B71959]";
  }
  return "border-[#3D66B9]/30 bg-[#3D66B9]/10 text-[#294782]";
}

function ConditionIcon({ row }: { row: LaunchRow }) {
  if (row.launchReadinessStatus === "pilot_ready_for_local_beta") {
    return <CheckCircle2 className="h-4 w-4" />;
  }
  if (row.launchReadinessStatus === "blocked_pending_identity_review") {
    return <AlertTriangle className="h-4 w-4" />;
  }
  return <CircleDashed className="h-4 w-4" />;
}

function hostFromUrl(value: string) {
  if (!value) return "Missing";
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function formatFact(value: string) {
  if (!value) return "Open";
  if (value.startsWith("http") || value.startsWith("/")) return value;
  if (/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:\/)?$/.test(value)) return value;
  return humanize(value);
}

function isAbsoluteHttpUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function FactValue({ value }: { value: string }) {
  const displayValue = formatFact(value);

  if (!isAbsoluteHttpUrl(value)) {
    return <>{displayValue}</>;
  }

  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex max-w-full items-start gap-1.5 text-[#294782] underline decoration-[#7DCAC2] decoration-2 underline-offset-2 transition-colors hover:text-[#3D66B9]"
    >
      <span className="min-w-0 break-all">{displayValue}</span>
      <ExternalLink className="mt-1 h-3.5 w-3.5 flex-none" aria-hidden="true" />
    </a>
  );
}

function FactList({ facts }: { facts: Array<[string, string]> }) {
  return (
    <dl className="divide-y divide-[#D6D6D2] rounded-md border border-[#D6D6D2] bg-white">
      {facts.map(([label, value]) => (
        <div key={label} className="grid gap-1 px-4 py-3 md:grid-cols-[180px_1fr] md:items-start">
          <dt className="text-[11px] font-black uppercase tracking-normal text-[#294782]">{label}</dt>
          <dd className="break-words text-sm font-semibold leading-6 text-[#15284B]">
            <FactValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function GatePill({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "ready" | "pending" | "blocked";
}) {
  const tone =
    status === "ready"
      ? "border-[#3B9189]/30 bg-[#3B9189]/10 text-[#1f6f69]"
      : status === "blocked"
        ? "border-[#BD4830]/30 bg-[#BD4830]/10 text-[#9f3522]"
        : "border-[#3D66B9]/30 bg-[#3D66B9]/10 text-[#294782]";

  return (
    <span className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-xs font-black ${tone}`}>
      {status === "ready" ? <CheckCircle2 className="h-4 w-4" /> : status === "blocked" ? <AlertTriangle className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
      <span className="min-w-0">
        <span className="block uppercase tracking-normal">{label}</span>
        <span className="block truncate normal-case">{value}</span>
      </span>
    </span>
  );
}

function ControlStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-[#D6D6D2] bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-[#294782]">
        {icon}
        <p className="text-[11px] font-black uppercase tracking-normal">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black text-[#15284B]">{value}</p>
    </div>
  );
}

function BetaBehaviorStrip() {
  return (
    <section className="rounded-lg border border-[#D6D6D2] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-[#3B9189]/10 text-[#1f6f69]">
            <Route className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-black text-[#15284B]">Beta Route Behavior</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#294782]">
              Old .io URLs redirect to the new city/state .io URL, which serves legacy content until the target is switched.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-black">
          <span className="rounded-md border border-[#3B9189]/30 bg-[#3B9189]/10 px-3 py-2 text-[#1f6f69]">Default: legacy baseline</span>
          <span className="rounded-md border border-[#3D66B9]/30 bg-[#3D66B9]/10 px-3 py-2 text-[#294782]">Switch: candidate origin</span>
          <span className="rounded-md border border-[#D6D6D2] bg-[#F6F6F5] px-3 py-2 text-[#15284B]">Host: venterraliving.io</span>
        </div>
      </div>
    </section>
  );
}

function ProgrammaticControlStrip({ switchableRows }: { switchableRows: number }) {
  return (
    <section className="rounded-lg border border-[#D6D6D2] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-[#3D66B9]/10 text-[#294782]">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-black text-[#15284B]">Programmatic Control Plane</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#294782]">
              Route-state contract is versioned and tested; dashboard mutation waits for the authenticated D1/KV control API.
            </p>
          </div>
        </div>
        <div className="grid gap-2 text-xs font-black sm:grid-cols-3 lg:w-[520px]">
          <span className="rounded-md border border-[#3B9189]/30 bg-[#3B9189]/10 px-3 py-2 text-[#1f6f69]">
            {switchableRows} legacy active
          </span>
          <span className="rounded-md border border-[#3D66B9]/30 bg-[#3D66B9]/10 px-3 py-2 text-[#294782]">
            State file ready
          </span>
          <span className="rounded-md border border-[#D6D6D2] bg-[#F6F6F5] px-3 py-2 text-[#15284B]">
            D1/KV next
          </span>
        </div>
      </div>
    </section>
  );
}

function LaunchStats({
  summary,
  switchableRows,
}: {
  summary: ReadinessPayload["summary"];
  switchableRows: number;
}) {
  return (
    <section className="rounded-lg border border-[#D6D6D2] bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ControlStat icon={<Route className="h-4 w-4" />} label="Live beta routes" value={summary.localTestPassed} />
        <ControlStat icon={<SlidersHorizontal className="h-4 w-4" />} label="Switchable" value={switchableRows} />
        <ControlStat icon={<CircleDashed className="h-4 w-4" />} label="Needs work" value={summary.awaitingStagingOrigin + summary.sourcePathReviewRequired + summary.identityReviewRequired} />
        <ControlStat icon={<CheckCircle2 className="h-4 w-4" />} label="Production approved" value={summary.productionApproved} />
      </div>
    </section>
  );
}

function UrlSummary({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-[10px] font-black uppercase tracking-normal text-[#294782]">{label}</span>
      <span className="mt-1 block text-sm font-bold leading-5 text-[#15284B]">
        <FactValue value={value} />
      </span>
    </span>
  );
}

function RouteUrlStack({ row }: { row: LaunchRow }) {
  return (
    <span className="grid min-w-0 gap-3">
      <UrlSummary label="Click" value={row.oldBetaUrl || row.currentSourcePath} />
      <UrlSummary label="Resolves to" value={row.betaCityStateUrl || row.newCityStatePath} />
    </span>
  );
}

function switchUrlFor(row: LaunchRow, target: "legacy_baseline" | "candidate_origin") {
  const returnPath = row.currentSourcePath || new URL(row.oldBetaUrl).pathname;
  return `https://venterraliving.io/__vtr-routing-ops/switch?property=${encodeURIComponent(row.propertyCode)}&target=${target}&return=${encodeURIComponent(returnPath)}`;
}

function RouteActions({ row }: { row: LaunchRow }) {
  if (row.launchReadinessStatus !== "pilot_ready_for_local_beta" || !row.propertyCode || !row.oldBetaUrl) {
    return <span className="text-xs font-black text-[#9B9B96]">Pending setup</span>;
  }

  return (
    <span className="flex flex-wrap gap-2 md:justify-end">
      <a
        href={switchUrlFor(row, "legacy_baseline")}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex h-9 items-center rounded-md border border-[#3B9189]/35 bg-[#3B9189]/10 px-3 text-xs font-black text-[#1f6f69] transition-colors hover:bg-[#3B9189]/15"
      >
        Open legacy
      </a>
      <a
        href={switchUrlFor(row, "candidate_origin")}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex h-9 items-center rounded-md border border-[#3D66B9]/35 bg-[#3D66B9]/10 px-3 text-xs font-black text-[#294782] transition-colors hover:bg-[#3D66B9]/15"
      >
        Switch to candidate
      </a>
    </span>
  );
}

function TargetBadge({ row }: { row: LaunchRow }) {
  if (row.launchReadinessStatus !== "pilot_ready_for_local_beta") {
    return (
      <Badge variant="outline" className={`${conditionTone(row)} gap-1 whitespace-nowrap`}>
        <ConditionIcon row={row} />
        {conditionFor(row)}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 whitespace-nowrap border-[#3B9189]/30 bg-[#3B9189]/10 text-[#1f6f69]">
      <CheckCircle2 className="h-4 w-4" />
      Legacy live
    </Badge>
  );
}

function QuietDetails({ row, legacyTarget }: { row: LaunchRow; legacyTarget: string }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section>
        <div className="mb-2 flex items-center gap-2 text-sm font-black text-[#15284B]">
          <Route className="h-4 w-4 text-[#3D66B9]" />
          Route
        </div>
        <FactList
          facts={[
            ["Click URL", row.oldBetaUrl],
            ["Resolved URL", row.betaCityStateUrl],
            ["Legacy target", legacyTarget],
            ["Future production", row.futureProductionUrl],
          ]}
        />
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 text-sm font-black text-[#15284B]">
          <SlidersHorizontal className="h-4 w-4 text-[#3B9189]" />
          Switch
        </div>
        <FactList
          facts={[
            ["Current target", deliveryModeFor(row) === "Switchable" ? "Legacy baseline" : deliveryModeFor(row)],
            ["Candidate target", row.stagingOriginUrl],
            ["Approval", row.approvalStatus],
            ["Rollback", rollbackGateFor(row)],
          ]}
        />
      </section>
    </div>
  );
}

function PropertyRouteDrawer({ row }: { row: LaunchRow }) {
  const legacyTarget = legacyTargetFor(row);

  return (
    <details className="group overflow-hidden rounded-lg border border-[#D6D6D2] bg-white shadow-sm">
      <summary className="grid cursor-pointer list-none gap-4 border-l-4 border-[#3D66B9] px-4 py-4 transition-colors hover:bg-[#F6F6F5] lg:grid-cols-[minmax(210px,0.8fr)_minmax(420px,1.6fr)_120px_minmax(230px,0.75fr)_20px] lg:items-center">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-[#D6D6D2] bg-[#F6F6F5] text-[#294782]">
              {row.propertyCode || "Review"}
            </Badge>
            <Badge variant="outline" className="border-[#D6D6D2] bg-white text-[#294782]">
              {row.market || "Market review"}
            </Badge>
          </span>
          <span className="mt-2 block truncate text-base font-black text-[#15284B]">{row.propertyName}</span>
        </span>
        <RouteUrlStack row={row} />
        <span className="flex items-center md:justify-end">
          <TargetBadge row={row} />
        </span>
        <RouteActions row={row} />
        <ChevronRight className="hidden h-5 w-5 text-[#294782] transition-transform group-open:rotate-90 md:block" />
      </summary>

      <div className="border-t border-[#D6D6D2] bg-[#F6F6F5] px-4 py-4">
        <QuietDetails row={row} legacyTarget={legacyTarget} />
      </div>
    </details>
  );
}

function PromotionContract() {
  return (
    <section className="rounded-lg border border-[#D6D6D2] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#15284B]">
        <SlidersHorizontal className="h-4 w-4 text-[#3D66B9]" />
        Promotion Contract - Reference
      </div>
      <FactList
        facts={[
          ["Beta host", "venterraliving.io"],
          ["Production host", "venterraliving.com"],
          ["Worker preview", "https://portfolio-launch-proxy-beta.mlaufhutte.workers.dev"],
          ["Production redirect", "301 after approval"],
        ]}
      />
    </section>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-[10px] font-black uppercase tracking-normal text-[#294782]">{label}</span>
      <span className="mt-1 block truncate text-sm font-bold text-[#15284B]">{value || "Open"}</span>
    </span>
  );
}

export default function PortfolioLaunchRoutingOpsPage() {
  const { summary, rows } = readiness;
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterId>("all");
  const switchableRows = rows.filter((row) => legacyTargetFor(row) && row.stagingOriginUrl).length;

  const filters: Array<{ id: FilterId; label: string; count: number }> = [
    { id: "all", label: "All", count: summary.totalRows },
    { id: "ready", label: "Beta ready", count: summary.pilotReadyRows },
    { id: "origin", label: "Needs origin", count: summary.awaitingStagingOrigin },
    { id: "source", label: "Needs source path", count: summary.sourcePathReviewRequired },
    { id: "identity", label: "Needs identity", count: summary.identityReviewRequired },
  ];

  const sortedRows = [...rows].sort((left, right) => {
    return propertySortKey(left.propertyName).localeCompare(propertySortKey(right.propertyName), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  const filteredRows = sortedRows.filter((row) => {
    const haystack = [
      row.propertyName,
      row.propertyCode,
      row.market,
      row.currentSourcePath,
      row.newCityStatePath,
      row.stagingOriginUrl,
    ].join(" ").toLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "ready" && row.launchReadinessStatus === "pilot_ready_for_local_beta") ||
      (filter === "origin" && row.launchReadinessStatus === "blocked_pending_staging_origin") ||
      (filter === "source" && row.launchReadinessStatus === "blocked_pending_source_path_review") ||
      (filter === "identity" && row.launchReadinessStatus === "blocked_pending_identity_review");
    return matchesQuery && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-[#F6F6F5]">
      <header className="border-b-4 border-[#7DCAC2] bg-[#15284B] text-white">
        <div className="mx-auto max-w-7xl px-5 py-6 md:px-8">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-white/14">
              <Route className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-[#7DCAC2]/45 bg-[#7DCAC2]/15 text-[#F6F6F5]">
                  Routing Ops
                </Badge>
                <Badge variant="outline" className="border-white/25 bg-white/10 text-white">
                  {summary.totalRows} properties
                </Badge>
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-normal">Portfolio Launch Command Center</h1>
              <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-white/72">
                {summary.pilotReadyRows} beta ready, {summary.awaitingStagingOrigin} need origins, {summary.sourcePathReviewRequired} need source-path review, {summary.identityReviewRequired} need identity review, {summary.productionApproved} production approved.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 md:px-8">
        <div className="mb-5 grid gap-4">
          <BetaBehaviorStrip />
          <ProgrammaticControlStrip switchableRows={switchableRows} />
          <LaunchStats summary={summary} switchableRows={switchableRows} />
        </div>

        <div className="mb-5 rounded-lg border border-[#D6D6D2] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#294782]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search property, code, market, URL"
                className="h-10 w-full rounded-md border border-[#D6D6D2] bg-[#F6F6F5] pl-9 pr-3 text-sm font-semibold text-[#15284B] outline-none focus:border-[#3D66B9] focus:bg-white"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-black transition-colors ${
                    filter === item.id
                      ? "border-[#15284B] bg-[#15284B] text-white"
                      : "border-[#D6D6D2] bg-white text-[#15284B] hover:bg-[#F6F6F5]"
                  }`}
                >
                  {item.label}
                  <span className={filter === item.id ? "text-white/70" : "text-[#294782]"}>{item.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredRows.map((row, index) => (
            <PropertyRouteDrawer key={`${row.propertyCode || row.propertyName}-${row.newCityStatePath}-${index}`} row={row} />
          ))}
        </div>
      </main>
    </div>
  );
}
