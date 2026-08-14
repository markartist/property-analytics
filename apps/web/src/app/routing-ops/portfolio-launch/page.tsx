"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  Layers3,
  Route,
  Search,
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

type MigrationStatus = "passed" | "in_progress" | "blocked" | "pending" | "accepted_exception";

type MigrationScore = {
  label: string;
  exact?: number;
  fresh?: number;
  status: MigrationStatus;
  note: string;
};

type MigrationEvidence = {
  label: string;
  status: MigrationStatus;
  detail: string;
};

type MigrationProperty = {
  propertyName: string;
  propertyCode: string;
  market: string;
  phase: string;
  captain: string;
  lastProofDate: string;
  opsStatus: "live" | "running" | "blocked" | "verify";
  liveSummary: string;
  doneSummary: string;
  runningSummary: string;
  blockerSummary: string;
  mobile: MigrationScore;
  desktop: MigrationScore;
  gates: MigrationEvidence[];
  evidence: MigrationEvidence[];
  nextAction: string;
};

const migrationProperties: MigrationProperty[] = [
  {
    propertyName: "TowneStone at 359",
    propertyCode: "TX4FC",
    market: "Richmond, TX",
    phase: "Production mobile topper",
    captain: "Captain Townestone",
    lastProofDate: "08/06/2026",
    opsStatus: "verify",
    liveSummary: "Mobile topper is live.",
    doneSummary: "Zaraz live; GTM removed.",
    runningSummary: "Run fresh mobile and desktop PSI.",
    blockerSummary: "Needs fresh both-device proof.",
    mobile: {
      label: "Production topper",
      exact: 100,
      fresh: 100,
      status: "passed",
      note: "PSI UI showed 100s after the production topper.",
    },
    desktop: {
      label: "Native pass-through",
      exact: 98,
      status: "accepted_exception",
      note: "Desktop remains native; prior desktop PSI was strong but must be rechecked under the new 90+ both-types target.",
    },
    gates: [
      { label: "Identity", status: "passed", detail: "Governed as TX4FC with live domain and Captain activation." },
      { label: "Analytics", status: "passed", detail: "GA4, Heap, Ahrefs, and Resi bridge moved to Zaraz; no GTM in live proof." },
      { label: "Mobile shell", status: "passed", detail: "Production Worker marker v19+ with optimized same-origin hero and lazy continuation." },
      { label: "Source attribution", status: "passed", detail: "Remote D1 lookup defaults to VWS TX4FC30L `(346) 623-1550`; source-coded IDs keep feed overrides." },
      { label: "Indexing", status: "in_progress", detail: "Homepage indexed; deeper URLs submitted and still being monitored in GSC." },
      { label: "Desktop 90+", status: "in_progress", detail: "Desktop proof must be promoted from native-good to explicit 90+ evidence." },
    ],
    evidence: [
      { label: "Production proof packet", status: "passed", detail: "reports/resi_edge_performance/2026-08-06/townestone-mobile-topper-production-v19/" },
      { label: "Zaraz migration packet", status: "passed", detail: "reports/cloudflare_zaraz/townestone_20260805_gtm_to_zaraz/" },
      { label: "llms.txt edge fix", status: "passed", detail: "Linked markdown served from the edge after PSI Agent Accessibility warning." },
      { label: "Attribution lookup", status: "passed", detail: "Remote D1 run resi_source_lookup_0995b04ee0a8; zero non-VWS default phone sources." },
    ],
    nextAction: "Run fresh mobile and desktop PSI through the governed API lane and attach both score artifacts to the Captain record.",
  },
  {
    propertyName: "The Vine Kyle Parkway",
    propertyCode: "TX4EK",
    market: "Kyle, TX",
    phase: "Production mobile topper",
    captain: "Captain Vine",
    lastProofDate: "08/06/2026",
    opsStatus: "verify",
    liveSummary: "Mobile topper is live.",
    doneSummary: "Zaraz live; font errors fixed.",
    runningSummary: "Run official mobile and desktop PSI.",
    blockerSummary: "Needs official PSI proof.",
    mobile: {
      label: "Local proof",
      status: "in_progress",
      note: "Local Chrome measured 168ms FCP/LCP after the topper; official PSI rerun was blocked by 429 quota.",
    },
    desktop: {
      label: "Native pass-through",
      status: "pending",
      note: "Desktop stays native and has not yet been proven against the new 90+ both-types target.",
    },
    gates: [
      { label: "Identity", status: "passed", detail: "Governed as TX4EK with clean schema/meta and Captain activation." },
      { label: "Analytics", status: "passed", detail: "Zaraz GA4 and delayed Heap already restored; no GTM in proof." },
      { label: "Mobile shell", status: "passed", detail: "Production Worker marker v3 with corrected font assets and drawer proof." },
      { label: "Source attribution", status: "passed", detail: "Remote D1 lookup defaults to VWS TX4EK30L `(737) 357-8867`; source-coded IDs keep feed overrides." },
      { label: "Console health", status: "passed", detail: "Font 404s corrected; browser proof showed zero console errors and failed requests." },
      { label: "PSI proof", status: "in_progress", detail: "Needs fresh official PSI mobile and desktop evidence after rate limit clears." },
    ],
    evidence: [
      { label: "Benchmark packet", status: "passed", detail: "reports/resi_edge_performance/2026-08-06/thevine-benchmark/" },
      { label: "Production proof packet", status: "passed", detail: "reports/resi_edge_performance/2026-08-06/thevine-mobile-topper-production-v1/" },
      { label: "llms.txt edge fix", status: "passed", detail: "Existing edge-message-worker serves linked markdown for /llms.txt." },
      { label: "Attribution lookup", status: "passed", detail: "Remote D1 run resi_source_lookup_0995b04ee0a8; zero non-VWS default phone sources." },
    ],
    nextAction: "Run official PSI mobile and desktop, then decide whether desktop needs a shell or a native optimizer pass.",
  },
  {
    propertyName: "Champions Green",
    propertyCode: "GA4CG",
    market: "Alpharetta, GA",
    phase: "Origin reset",
    captain: "Captain Champions",
    lastProofDate: "08/08/2026",
    opsStatus: "verify",
    liveSummary: "Reset to original origin pass-through.",
    doneSummary: "Reset proof captured: no Worker shell, consent pill, CSS repair, or edge markers.",
    runningSummary: "Apply the runbook from the clean baseline.",
    blockerSummary: "Mobile baseline is 58; Ahrefs still unresolved.",
    mobile: {
      label: "Origin baseline",
      exact: 58,
      status: "blocked",
      note: "Origin reset baseline on 08/08/2026 scored 58 mobile with LCP 10.920s.",
    },
    desktop: {
      label: "Origin baseline",
      exact: 99,
      status: "passed",
      note: "Origin reset baseline on 08/08/2026 scored 99 desktop. Preserve desktop; optimize mobile.",
    },
    gates: [
      { label: "Origin reset", status: "passed", detail: "Worker version b79ce468-b0d1-4094-a3af-d9c4c1c9df67 returns origin directly." },
      { label: "No edge meddling", status: "passed", detail: "Proof confirms no shell, topper, consent pill, CSS repair, analytics strip, or edge markers." },
      { label: "Desktop preservation", status: "passed", detail: "Original desktop is styled and scores 99. Do not add a desktop shell." },
      { label: "Mobile performance", status: "blocked", detail: "Original mobile scores 58. This is the runbook optimization target." },
      { label: "Analytics", status: "blocked", detail: "Zaraz has GA4 and Heap, but Ahrefs Web Analytics is missing for the live vanity domain." },
      { label: "Ahrefs profile", status: "blocked", detail: "Existing Ahrefs project 10125771 targets `venterraliving.com/apartments/champions-green/`, not `championsgreen-ga.com/`." },
    ],
    evidence: [
      { label: "Reset readout", status: "passed", detail: "reports/resi_edge_performance/08-08-2026/champions/origin-reset/CHAMPIONS_ORIGIN_RESET_READOUT.md" },
      { label: "Browser proof", status: "passed", detail: "reports/resi_edge_performance/08-08-2026/champions/origin-reset/origin-reset-proof-summary.json" },
      { label: "PSI baseline", status: "passed", detail: "reports/resi_edge_performance/08-08-2026/champions/origin-reset/psi/psi-summary.json" },
      { label: "Attribution lookup", status: "passed", detail: "Remote D1 run resi_source_lookup_0995b04ee0a8 includes Champions VWS/APL/GOA rows." },
    ],
    nextAction: "Run the property upgrade runbook from the origin baseline: preserve desktop, rebuild only the mobile lane, then re-prove everything live.",
  },
  {
    propertyName: "Calais Midtown",
    propertyCode: "TX4MI",
    market: "Houston, TX",
    phase: "Production mobile shell",
    captain: "Captain Calais",
    lastProofDate: "08/07/2026",
    opsStatus: "live",
    liveSummary: "Standalone mobile shell is live.",
    doneSummary: "Architecture, source phone, browser, and PSI proof passed.",
    runningSummary: "Monitor live stability and Captain evidence.",
    blockerSummary: "No active blocker after v15.1 proof.",
    mobile: {
      label: "Live production shell",
      exact: 100,
      status: "passed",
      note: "Live PSI on 08/07/2026 scored 100 with same-origin AVIF LCP, 0ms TBT, and CLS 0.",
    },
    desktop: {
      label: "Live native pass-through",
      exact: 98,
      status: "passed",
      note: "Desktop remains native by design and live PSI scored 98 on 08/07/2026.",
    },
    gates: [
      { label: "Identity", status: "passed", detail: "Governed as TX4MI; GA4CM is explicitly blocked as Canton Mill." },
      { label: "R2 readback", status: "passed", detail: "16 of 16 derivatives uploaded; sampled remote byte/SHA readback matched." },
      { label: "Architecture", status: "passed", detail: "Live clean and GOA URLs passed the standalone mobile shell validator." },
      { label: "Source attribution", status: "passed", detail: "`?id=TX4MIGOA` renders GOA `(346) 639-3361` in link, drawer, schema, and analytics payload." },
      { label: "Analytics", status: "passed", detail: "Zaraz-first package remains active; desktop native pass-through receives surgical analytics cleanup." },
      { label: "Visual QA", status: "passed", detail: "Live browser proof shows full-height first viewport, no horizontal overflow, and lazy full-width native continuation after scroll." },
      { label: "Production proof", status: "passed", detail: "Worker version 438d0195-9149-4547-a7e9-bac9a82597b0 is live." },
    ],
    evidence: [
      { label: "Candidate manifest", status: "passed", detail: "config/portfolio_resi_edge_stabilization/calais-midtown-tx4mi.manifest.json" },
      { label: "Architecture proof", status: "passed", detail: "reports/resi_edge_performance/08-07-2026/calais/architecture/" },
      { label: "Live browser proof", status: "passed", detail: "reports/resi_edge_performance/08-07-2026/calais/live-production-v15-1-browser/" },
      { label: "Live PSI proof", status: "passed", detail: "reports/resi_edge_performance/08-07-2026/calais/live-production-v15-1-psi/" },
      { label: "Rollback reference", status: "passed", detail: "Previous live Worker version d1a357d6-2551-47ce-90f6-3e586acb8b5f." },
      { label: "Case-study correction", status: "passed", detail: "docs/RESI_EDGE_CASE_STUDY_2026-08-06.md" },
      { label: "Attribution lookup", status: "passed", detail: "Remote D1 run resi_source_lookup_0995b04ee0a8 includes Calais VWS/APL/GOA rows." },
    ],
    nextAction: "Monitor live stability and keep Calais as the recovery reference for failed properties: reset, preview proof, source proof, browser proof, live PSI.",
  },
];

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

function migrationStatusTone(status: MigrationStatus) {
  if (status === "passed") return "border-[#3B9189]/30 bg-[#3B9189]/10 text-[#1f6f69]";
  if (status === "blocked") return "border-[#BD4830]/30 bg-[#BD4830]/10 text-[#9f3522]";
  if (status === "accepted_exception") return "border-[#7DCAC2]/35 bg-[#7DCAC2]/15 text-[#294782]";
  if (status === "in_progress") return "border-[#3D66B9]/30 bg-[#3D66B9]/10 text-[#294782]";
  return "border-[#D6D6D2] bg-[#F6F6F5] text-[#15284B]";
}

function migrationStatusLabel(status: MigrationStatus) {
  if (status === "accepted_exception") return "Accepted exception";
  return humanize(status);
}

function MigrationStatusIcon({ status }: { status: MigrationStatus }) {
  if (status === "passed") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "blocked") return <AlertTriangle className="h-4 w-4" />;
  if (status === "accepted_exception") return <ShieldCheck className="h-4 w-4" />;
  return <CircleDashed className="h-4 w-4" />;
}

function EvidenceChip({ item }: { item: MigrationEvidence }) {
  return (
    <span className={`inline-flex min-h-9 max-w-full items-center gap-2 rounded-md border px-3 py-2 text-xs font-black ${migrationStatusTone(item.status)}`}>
      <MigrationStatusIcon status={item.status} />
      <span className="min-w-0 truncate">{item.label}</span>
    </span>
  );
}

function EvidenceList({ title, icon, items }: { title: string; icon: React.ReactNode; items: MigrationEvidence[] }) {
  return (
    <section className="min-w-0">
      <div className="mb-2 flex items-center gap-2 text-sm font-black text-[#15284B]">
        {icon}
        {title}
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={`${item.label}-${item.detail}`} className="rounded-md border border-[#D6D6D2] bg-white px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <EvidenceChip item={item} />
              <span className="text-xs font-black text-[#9B9B96]">{migrationStatusLabel(item.status)}</span>
            </div>
            <p className="mt-2 break-words text-xs font-semibold leading-5 text-[#294782]">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MigrationPropertyDrawer({ property }: { property: MigrationProperty }) {
  const statusLabel =
    property.opsStatus === "live"
      ? "Live"
      : property.opsStatus === "running"
        ? "Running"
        : property.opsStatus === "blocked"
          ? "Blocked"
          : "Verify";
  const statusClass =
    property.opsStatus === "blocked"
      ? "border-[#BD4830] bg-[#BD4830] text-white"
      : property.opsStatus === "running"
        ? "border-[#3D66B9] bg-[#3D66B9] text-white"
        : property.opsStatus === "live"
          ? "border-[#3B9189] bg-[#3B9189] text-white"
          : "border-[#294782] bg-[#294782] text-white";

  return (
    <details className="group overflow-hidden rounded-lg border border-[#D6D6D2] bg-white shadow-sm">
      <summary className="grid cursor-pointer list-none gap-4 border-l-4 border-[#7DCAC2] px-4 py-4 transition-colors hover:bg-[#F6F6F5] xl:grid-cols-[96px_minmax(210px,0.72fr)_minmax(560px,1.8fr)_20px] xl:items-center">
        <span className={`inline-flex h-10 items-center justify-center rounded-md border px-3 text-xs font-black uppercase tracking-normal ${statusClass}`}>
          {statusLabel}
        </span>

        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-[#D6D6D2] bg-[#F6F6F5] text-[#294782]">
              {property.propertyCode}
            </Badge>
            <Badge variant="outline" className="border-[#D6D6D2] bg-white text-[#294782]">
              {property.market}
            </Badge>
          </span>
          <span className="mt-2 block truncate text-base font-black text-[#15284B]">{property.propertyName}</span>
          <span className="mt-1 block truncate text-xs font-bold text-[#294782]">{property.phase}</span>
        </span>

        <span className="grid min-w-0 gap-3 md:grid-cols-3">
          <span className="min-w-0 rounded-md border border-[#D6D6D2] bg-[#F6F6F5] px-3 py-2">
            <span className="block text-[10px] font-black uppercase tracking-normal text-[#294782]">Live</span>
            <span className="mt-1 block text-sm font-bold leading-5 text-[#15284B]">{property.liveSummary}</span>
          </span>
          <span className="min-w-0 rounded-md border border-[#D6D6D2] bg-white px-3 py-2">
            <span className="block text-[10px] font-black uppercase tracking-normal text-[#294782]">Done</span>
            <span className="mt-1 block text-sm font-bold leading-5 text-[#15284B]">{property.doneSummary}</span>
          </span>
          <span className={`min-w-0 rounded-md border px-3 py-2 ${property.opsStatus === "blocked" ? "border-[#BD4830]/30 bg-[#BD4830]/5" : "border-[#3D66B9]/25 bg-[#3D66B9]/5"}`}>
            <span className="block text-[10px] font-black uppercase tracking-normal text-[#294782]">Next</span>
            <span className="mt-1 block text-sm font-bold leading-5 text-[#15284B]">{property.runningSummary}</span>
            <span className={`mt-2 inline-flex items-center gap-1.5 text-xs font-black ${property.opsStatus === "blocked" ? "text-[#9f3522]" : "text-[#294782]"}`}>
              {property.opsStatus === "blocked" ? <AlertTriangle className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
              {property.blockerSummary}
            </span>
          </span>
        </span>

        <ChevronRight className="hidden h-5 w-5 text-[#294782] transition-transform group-open:rotate-90 md:block" />
      </summary>

      <div className="border-t border-[#D6D6D2] bg-[#F6F6F5] px-4 py-4">
        <div className="mb-4 rounded-md border border-[#D6D6D2] bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-black text-[#294782]">
            <ClipboardCheck className="h-4 w-4" />
            {property.captain}
            <span className="text-[#9B9B96]">Proof updated {property.lastProofDate}</span>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#15284B]">{property.nextAction}</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <EvidenceList title="Gate State" icon={<Layers3 className="h-4 w-4 text-[#3D66B9]" />} items={property.gates} />
          <EvidenceList title="Evidence Cards" icon={<FileCheck2 className="h-4 w-4 text-[#3B9189]" />} items={property.evidence} />
        </div>
      </div>
    </details>
  );
}

function MigrationAccountabilityPanel() {
  const liveCount = migrationProperties.filter((property) => property.phase.startsWith("Production")).length;
  const runningCount = migrationProperties.filter((property) => property.opsStatus === "running" || property.opsStatus === "verify").length;
  const blockedCount = migrationProperties.filter((property) => property.opsStatus === "blocked").length;
  const approvalReadyCount = migrationProperties.filter(
    (property) => property.opsStatus === "live" && property.mobile.status === "passed" && property.desktop.status === "passed"
  ).length;

  return (
    <section className="overflow-hidden rounded-lg border border-[#15284B]/20 bg-white shadow-sm">
      <div className="bg-[#15284B] px-5 py-5 text-white">
        <div className="grid gap-5 lg:grid-cols-[minmax(280px,1fr)_minmax(520px,1.5fr)] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-[#7DCAC2]/50 bg-[#7DCAC2]/15 text-white">
                Resi Migration
              </Badge>
              <Badge variant="outline" className="border-white/25 bg-white/10 text-white">
                90+ mobile and desktop
              </Badge>
            </div>
            <p className="mt-4 text-sm font-black uppercase tracking-normal text-[#7DCAC2]">Production approval status</p>
            <div className="mt-2 flex items-end gap-3">
              <span className="text-6xl font-black leading-none text-white">{approvalReadyCount}/4</span>
              <span className="pb-2 text-lg font-black text-white/75">ready</span>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/75">
              This is the important part: Calais has live 90+ proof. Champions has been reset to original; desktop is already 99, mobile is 58, so the runbook target is mobile only.
            </p>
          </div>

          <div className="rounded-lg border border-white/15 bg-white/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-[#BD4830]" />
              <div className="min-w-0">
                <p className="text-base font-black text-white">What is up?</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                  Champions is back to origin pass-through. No edge shell, no consent pill, no CSS repair. Baseline proof says preserve desktop and rebuild the mobile lane through the runbook.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-[#D6D6D2] md:grid-cols-4">
        <div className="bg-white px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-normal text-[#294782]">Live in production</p>
          <p className="mt-1 text-3xl font-black text-[#3B9189]">{liveCount}</p>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-normal text-[#294782]">Running now</p>
          <p className="mt-1 text-3xl font-black text-[#3D66B9]">{runningCount}</p>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-normal text-[#294782]">Blocked</p>
          <p className="mt-1 text-3xl font-black text-[#BD4830]">{blockedCount}</p>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-normal text-[#294782]">Approval ready</p>
          <p className="mt-1 text-3xl font-black text-[#3B9189]">{approvalReadyCount}</p>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-2 grid grid-cols-[96px_minmax(160px,0.72fr)_minmax(560px,1.8fr)_28px] gap-4 px-4 text-[10px] font-black uppercase tracking-normal text-[#294782] max-xl:hidden">
          <span>Status</span>
          <span>Property</span>
          <span>Operations</span>
          <span />
        </div>
        <div className="space-y-2">
          {migrationProperties.map((property) => (
            <MigrationPropertyDrawer key={property.propertyCode} property={property} />
          ))}
        </div>
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
                Migration status for production launches, active work, blockers, and proof-gated approvals.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 md:px-8">
        <div className="mb-5 grid gap-4">
          <MigrationAccountabilityPanel />
          <details className="overflow-hidden rounded-lg border border-[#D6D6D2] bg-white shadow-sm">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-[#15284B] transition-colors hover:bg-[#F6F6F5]">
              Routing context
              <span className="ml-2 text-xs font-bold text-[#294782]">Beta behavior, control plane, and route counts</span>
            </summary>
            <div className="grid gap-4 border-t border-[#D6D6D2] bg-[#F6F6F5] p-4">
              <BetaBehaviorStrip />
              <ProgrammaticControlStrip switchableRows={switchableRows} />
              <LaunchStats summary={summary} switchableRows={switchableRows} />
            </div>
          </details>
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
