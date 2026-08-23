"use client";

import React from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  Gauge,
  Globe2,
  LineChart,
  Link2,
  LockKeyhole,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { launchSnapshot } from "@/lib/resi-edge-launch/generated-snapshot";
import type { LaunchBreakdown, LaunchMetric, LaunchProperty, LaunchSignal, LaunchTrendPoint, PsiLaunchTarget, SignalColor } from "@/lib/resi-edge-launch/types";
import { cn } from "@/lib/utils";

const toneColors: Record<SignalColor, string> = {
  green: "#3B9189",
  yellow: "#F5C542",
  red: "#BD4830",
  gray: "#9B9B96",
};

const forwardingCleanupDomains = new Set([
  "anatoleatnorman.com",
  "axialbuckhead.com",
  "balmoralvillageapts.com",
  "carlyleplacesa.com",
  "linksatwindsorparke.com",
  "liveatforestviewapts.com",
  "livecantonmill.com",
  "retreatatkedronvillage.com",
  "sanpalmilla-houston.com",
  "thewhitneysandysprings.com",
]);

const forwardingRemovedDomains = new Set([
  "anatoleatnorman.com",
  "axialbuckhead.com",
  "balmoralvillageapts.com",
  "carlyleplacesa.com",
  "linksatwindsorparke.com",
  "liveatforestviewapts.com",
  "livecantonmill.com",
  "retreatatkedronvillage.com",
  "sanpalmilla-houston.com",
  "thewhitneysandysprings.com",
]);
const dnsPointedDomains = new Set([
  "anatoleatnorman.com",
  "axialbuckhead.com",
  "balmoralvillageapts.com",
  "blvdatlakeside.com",
  "carlyleplacesa.com",
  "creeksideapt.com",
  "linksatwindsorparke.com",
  "liveatforestviewapts.com",
  "livecantonmill.com",
  "lumaheadwaters.com",
  "parkonwurzbach.com",
  "phoenixfortworth.com",
  "retreatatkedronvillage.com",
  "sanpalmilla-houston.com",
  "stonecreekranchapartments.com",
  "themetropolitankentuckyapts.com",
  "thewhitneysandysprings.com",
  "timberlanevillageapts.com",
  "tuscanylindbergh.com",
  "villagewalkapts.com",
]);
const primaryDomainPendingDomains = new Set<string>();
const primaryDomainCompleteDomains = dnsPointedDomains;
const indexingReleasedDomains = dnsPointedDomains;
const contentIssueDomains = new Set<string>();
const vanityQaIssueDomains = contentIssueDomains;
const vanityQaPassedDomains = new Set(
  [...dnsPointedDomains].filter((domain) => !vanityQaIssueDomains.has(domain)),
);

type LaunchPhase = {
  label: string;
  value: string;
  status: LaunchSignal;
  percent: number;
};

const signalStyles: Record<SignalColor, { dot: string; badge: string; text: string; icon: React.ElementType }> = {
  green: {
    dot: "bg-[#3B9189]",
    badge: "border-[#3B9189]/30 bg-[#3B9189]/10 text-[#15284B]",
    text: "Green",
    icon: CheckCircle2,
  },
  yellow: {
    dot: "bg-[#F5C542]",
    badge: "border-[#F5C542]/45 bg-[#F5C542]/18 text-[#15284B]",
    text: "Yellow",
    icon: Clock3,
  },
  red: {
    dot: "bg-[#BD4830]",
    badge: "border-[#BD4830]/35 bg-[#BD4830]/12 text-[#15284B]",
    text: "Red",
    icon: ShieldCheck,
  },
  gray: {
    dot: "bg-[#9B9B96]",
    badge: "border-[#D6D6D2] bg-[#F6F6F5] text-[#15284B]",
    text: "Not Started",
    icon: Clock3,
  },
};

function SignalBadge({ signal, compact = false }: { signal: LaunchSignal; compact?: boolean }) {
  const style = signalStyles[signal.color];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-black",
        compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        style.badge,
      )}
    >
      <span className={cn("h-2.5 w-2.5 rounded-full", style.dot)} />
      <Icon className="h-3.5 w-3.5" />
      {style.text}: {signal.label}
    </span>
  );
}

function ExternalUrl({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 break-all text-sm font-black text-[#3D66B9] underline-offset-4 hover:underline"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
    </a>
  );
}

function Dial({
  label,
  value,
  helper,
  percent,
  tone,
  size = "large",
}: {
  label: string;
  value: string;
  helper: string;
  percent: number;
  tone: SignalColor;
  size?: "large" | "small";
}) {
  const color = toneColors[tone];
  const degree = Math.max(0, Math.min(100, percent)) * 3.6;

  return (
    <div className={cn("rounded-lg border border-[#D6D6D2] bg-white", size === "large" ? "p-4" : "p-3")}>
      <div className="flex items-center gap-3">
        <div
          className={cn("grid shrink-0 place-items-center rounded-full", size === "large" ? "h-24 w-24" : "h-16 w-16")}
          style={{ background: `conic-gradient(${color} ${degree}deg, #E8E8E4 0deg)` }}
          aria-label={`${label}: ${value}`}
        >
          <div className={cn("grid place-items-center rounded-full bg-white text-center", size === "large" ? "h-[72px] w-[72px]" : "h-12 w-12")}>
            <span className={cn("font-black text-[#15284B]", size === "large" ? "text-xl" : "text-sm")}>{value}</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-[#15284B]">{label}</p>
          <p className="mt-1 text-xs leading-5 text-[#15284B]/70">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function PortfolioChart() {
  return (
    <div className="rounded-lg border border-[#D6D6D2] bg-white p-4">
      <div className="flex items-center gap-2">
        <LineChart className="h-4 w-4 text-[#3D66B9]" />
        <p className="text-sm font-black text-[#15284B]">Launch Path</p>
      </div>
      <div className="mt-5 grid gap-4">
        {launchSnapshot.stageBars.map((stage) => {
          const percent = Math.round((stage.value / stage.total) * 100);
          return (
            <div key={stage.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black text-[#15284B]">
                <span>{stage.label}</span>
                <span>
                  {stage.value}/{stage.total}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[#E8E8E4]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percent}%`,
                    background: toneColors[stage.tone],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TruthChip({ tone, label }: { tone: SignalColor; label: string }) {
  const Icon = signalStyles[tone].icon;

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-3 py-1.5 text-sm font-black text-white">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: toneColors[tone] }} />
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function formatDelta(value: number | null) {
  if (value === null) return "n/a";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value}%`;
}

function scoreTone(value: number | null): SignalColor {
  if (value === null) return "gray";
  if (value >= 90) return "green";
  if (value >= 50) return "yellow";
  return "red";
}

function domainFromUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

function averageScore(targetIndex: number, scoreKey: "mobileScore" | "desktopScore") {
  const scores = launchSnapshot.properties
    .map((property) => property.psiLaunchTargets[targetIndex]?.[scoreKey])
    .filter((score): score is number => typeof score === "number");
  if (!scores.length) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function measuredTargets(targetIndex: number) {
  return launchSnapshot.properties.filter((property) => {
    const target = property.psiLaunchTargets[targetIndex];
    return typeof target?.mobileScore === "number" && typeof target?.desktopScore === "number";
  }).length;
}

function propertyHasForwardingCleanup(property: LaunchProperty) {
  const domain = domainFromUrl(property.newUrl.url);
  return forwardingCleanupDomains.has(domain) && !forwardingRemovedDomains.has(domain);
}

function propertyForwardingRemoved(property: LaunchProperty) {
  return forwardingRemovedDomains.has(domainFromUrl(property.newUrl.url));
}

function propertyDnsPointed(property: LaunchProperty) {
  return dnsPointedDomains.has(domainFromUrl(property.newUrl.url));
}

function propertyPrimaryPending(property: LaunchProperty) {
  return primaryDomainPendingDomains.has(domainFromUrl(property.newUrl.url));
}

function propertyPrimaryComplete(property: LaunchProperty) {
  return primaryDomainCompleteDomains.has(domainFromUrl(property.newUrl.url));
}

function propertyIndexingReleased(property: LaunchProperty) {
  return indexingReleasedDomains.has(domainFromUrl(property.newUrl.url));
}

function propertyHasContentIssue(property: LaunchProperty) {
  return contentIssueDomains.has(domainFromUrl(property.newUrl.url));
}

function propertyVanityQaPassed(property: LaunchProperty) {
  return vanityQaPassedDomains.has(domainFromUrl(property.newUrl.url));
}

function propertyDisplaySignal(property: LaunchProperty): LaunchSignal {
  if (propertyHasContentIssue(property)) {
    return {
      color: "yellow",
      label: "Live, Content Fix Open",
      detail: "The vanity domain is live and indexable; one visible content/template issue needs correction.",
    };
  }
  if (propertyPrimaryComplete(property)) {
    return {
      color: "green",
      label: "Vanity QA Passed",
      detail: "The vanity domain holds in-browser, is indexable, and passed read-only mobile smoke QA.",
    };
  }
  if (propertyDnsPointed(property) && propertyPrimaryPending(property)) {
    return {
      color: "yellow",
      label: "DNS Pointed, Handoff Pending",
      detail: "The vanity DNS is pointed to Kinsta; Resi/Blue Team must set the vanity hostname as primary.",
    };
  }
  return property.overall;
}

function propertyDisplayProgress(property: LaunchProperty) {
  if (propertyHasContentIssue(property)) return 88;
  if (propertyVanityQaPassed(property)) return 100;
  if (propertyPrimaryComplete(property)) return 92;
  return propertyDnsPointed(property) ? Math.max(property.progressPercent, 66) : property.progressPercent;
}

function propertyDisplayNextStep(property: LaunchProperty) {
  if (propertyHasContentIssue(property)) {
    return `Next: Resi/Blue Team fixes the ${domainFromUrl(property.newUrl.url)} page title placeholder, then WebOps rechecks content.`;
  }
  if (propertyPrimaryComplete(property)) {
    return `Next: run final visual, analytics, source attribution, PSI, and post-launch readout checks for ${domainFromUrl(property.newUrl.url)}.`;
  }
  if (propertyDnsPointed(property) && propertyPrimaryPending(property)) {
    return `Next: Resi/Blue Team sets ${domainFromUrl(property.newUrl.url)} as the primary Kinsta/WordPress hostname, then WebOps verifies the vanity URL holds.`;
  }
  return property.nextStep;
}

function propertyPhases(property: LaunchProperty): LaunchPhase[] {
  const needsForwardingCleanup = propertyHasForwardingCleanup(property);
  const forwardingRemoved = propertyForwardingRemoved(property);
  const dnsPointed = propertyDnsPointed(property);
  const primaryPending = propertyPrimaryPending(property);
  const primaryComplete = propertyPrimaryComplete(property);
  const indexingReleased = propertyIndexingReleased(property);
  const contentIssue = propertyHasContentIssue(property);

  return [
    {
      label: "Domain Ready",
      value: "Ready",
      percent: 100,
      status: { color: "green", label: "Ready", detail: "The property domain is controlled and ready for the switch." },
    },
    {
      label: "Staging Site",
      value: "Ready",
      percent: 100,
      status: { color: "green", label: "Ready", detail: "The launch site is reachable before the public move." },
    },
    {
      label: "Old Forwarding",
      value: forwardingRemoved ? "Removed" : needsForwardingCleanup ? "Remove" : "Clear",
      percent: needsForwardingCleanup ? 45 : 100,
      status: forwardingRemoved
        ? { color: "green", label: "Removed", detail: "Old Cloudflare vanity forwarding has been removed for this domain." }
        : needsForwardingCleanup
          ? { color: "yellow", label: "Pending", detail: "Old vanity forwarding must be removed during the switch." }
          : { color: "green", label: "Clear", detail: "No old vanity forwarding was found for this domain." },
    },
    {
      label: "DNS Switch",
      value: dnsPointed ? "Pointed" : "Next",
      percent: dnsPointed ? 100 : 0,
      status: dnsPointed
        ? { color: "green", label: "Pointed", detail: "Root and www now point to the Kinsta launch target." }
        : { color: "gray", label: "After Approval", detail: "Public DNS changes run only after launch approval." },
    },
    {
      label: "Primary Domain",
      value: primaryComplete ? "Live" : primaryPending ? "Resi" : dnsPointed ? "Confirm" : "After",
      percent: primaryComplete ? 100 : primaryPending ? 45 : dnsPointed ? 70 : 0,
      status: primaryComplete
        ? { color: "green", label: "Verified", detail: "The vanity hostname remains in-browser after primary assignment." }
        : primaryPending
        ? { color: "yellow", label: "Handoff", detail: "Resi/Blue Team must set the vanity hostname as primary in Kinsta and WordPress." }
        : dnsPointed
          ? { color: "yellow", label: "Confirm", detail: "Confirm the vanity hostname remains in-browser after primary assignment." }
          : { color: "gray", label: "After DNS", detail: "Primary-domain assignment happens after WebOps points the vanity DNS." },
    },
    {
      label: "Indexing",
      value: indexingReleased ? "Index" : "Release",
      percent: indexingReleased ? 100 : 40,
      status: indexingReleased
        ? { color: "green", label: "Indexable", detail: "Robots and canonical posture are index/follow on the vanity domain." }
        : { color: "yellow", label: "Waiting", detail: "Resi must remove the prelaunch noindex and nofollow protection." },
    },
    {
      label: "Content QA",
      value: contentIssue ? "Fix" : "Clear",
      percent: contentIssue ? 70 : 100,
      status: contentIssue
        ? { color: "yellow", label: "Fix Open", detail: "A visible title/template issue remains open." }
        : { color: "green", label: "Clear", detail: "No title, canonical, or robots issue was flagged in the latest root readback." },
    },
    {
      label: "Vanity QA",
      value: contentIssue ? "Fix" : primaryComplete ? "Pass" : "After",
      percent: contentIssue ? 92 : primaryComplete ? 100 : 0,
      status: contentIssue
        ? { color: "yellow", label: "Fix Open", detail: "Automated vanity QA passed the launch checks except for this content issue." }
        : primaryComplete
          ? { color: "green", label: "Passed", detail: "Vanity routing, canonical, indexing, metadata, CTA signals, and mobile smoke QA passed." }
          : { color: "gray", label: "After Switch", detail: "Vanity QA happens after the primary-domain switch." },
    },
  ];
}

function portfolioPhases(): LaunchPhase[] {
  const total = launchSnapshot.summary.totalProperties;
  const forwardingPending = launchSnapshot.properties.filter(propertyHasForwardingCleanup).length;
  const forwardingClear = total - forwardingPending;
  const forwardingRemoved = launchSnapshot.properties.filter(propertyForwardingRemoved).length;
  const dnsPointed = launchSnapshot.properties.filter(propertyDnsPointed).length;
  const primaryPending = launchSnapshot.properties.filter(propertyPrimaryPending).length;
  const primaryComplete = launchSnapshot.properties.filter(propertyPrimaryComplete).length;
  const indexingReleased = launchSnapshot.properties.filter(propertyIndexingReleased).length;
  const contentIssues = launchSnapshot.properties.filter(propertyHasContentIssue).length;
  const vanityQaPassed = launchSnapshot.properties.filter(propertyVanityQaPassed).length;

  return [
    {
      label: "Domain Control",
      value: `${launchSnapshot.summary.domainsControlled}/${total}`,
      percent: 100,
      status: { color: "green", label: "Ready", detail: "All launch domains are in the company-controlled DNS lane." },
    },
    {
      label: "Staging Reachable",
      value: `${launchSnapshot.summary.stagingReachable}/${total}`,
      percent: 100,
      status: { color: "green", label: "Ready", detail: "All launch sites have a reachable staging page." },
    },
    {
      label: "Old Forwarding",
      value: forwardingRemoved ? `${forwardingRemoved} removed` : `${forwardingClear}/${total} clear`,
      percent: Math.round((forwardingClear / total) * 100),
      status: {
        color: forwardingPending ? "yellow" : "green",
        label: forwardingPending ? `${forwardingPending} To Remove` : "Clear",
        detail: forwardingPending ? "Old vanity forwarding is removed during each domain switch." : "No old vanity forwarding remains.",
      },
    },
    {
      label: "DNS Pointed",
      value: `${dnsPointed}/${total}`,
      percent: Math.round((dnsPointed / total) * 100),
      status: {
        color: dnsPointed === total ? "green" : dnsPointed ? "yellow" : "gray",
        label: dnsPointed === total ? "Complete" : dnsPointed ? "In Progress" : "After Approval",
        detail: dnsPointed === total ? "All launch domains are pointed to Kinsta." : dnsPointed ? "Some launch domains are pointed to Kinsta." : "Public DNS switch has not started.",
      },
    },
    {
      label: "Primary Domain",
      value: `${primaryComplete}/${total}`,
      percent: Math.round((primaryComplete / total) * 100),
      status: {
        color: primaryComplete === total ? "green" : "yellow",
        label: primaryComplete === total ? "Verified" : `${primaryPending} Open`,
        detail: primaryComplete === total ? "All vanity domains hold in-browser after primary assignment." : "Resi/Blue Team must set pointed vanity domains as primary.",
      },
    },
    {
      label: "Indexing Release",
      value: `${indexingReleased}/${total}`,
      percent: Math.round((indexingReleased / total) * 100),
      status: {
        color: indexingReleased === total ? "green" : "yellow",
        label: indexingReleased === total ? "Indexable" : "Waiting On Resi",
        detail: indexingReleased === total ? "All checked vanity roots report index/follow and vanity canonicals." : "Prelaunch noindex and nofollow protection must be removed.",
      },
    },
    {
      label: "Content QA",
      value: `${contentIssues} open`,
      percent: Math.round(((total - contentIssues) / total) * 100),
      status: {
        color: contentIssues ? "yellow" : "green",
        label: contentIssues ? "Fix Needed" : "Clear",
        detail: contentIssues ? "One visible title/template issue is open." : "No title/template issue was flagged in root readback.",
      },
    },
    {
      label: "Vanity QA",
      value: `${vanityQaPassed}/${total}`,
      percent: Math.round((vanityQaPassed / total) * 100),
      status: {
        color: contentIssues ? "yellow" : "green",
        label: contentIssues ? `${contentIssues} Fix Open` : "Passed",
        detail: "Read-only QA checks routing, canonical, indexability, metadata, CTA signals, and mobile smoke.",
      },
    },
  ];
}

function workAheadRows(): LaunchBreakdown[] {
  const total = launchSnapshot.summary.totalProperties;
  const forwardingPending = launchSnapshot.properties.filter(propertyHasForwardingCleanup).length;
  const dnsPointed = launchSnapshot.properties.filter(propertyDnsPointed).length;
  const primaryPending = launchSnapshot.properties.filter(propertyPrimaryPending).length;
  const contentIssues = launchSnapshot.properties.filter(propertyHasContentIssue).length;
  return [
    { label: "Old forwarding to remove", value: forwardingPending, tone: forwardingPending ? "yellow" : "green" },
    { label: "Primary-domain handoffs", value: primaryPending, tone: primaryPending ? "yellow" : "green" },
    { label: "Content fixes open", value: contentIssues, tone: contentIssues ? "yellow" : "green" },
    { label: "Indexing releases to confirm", value: total - launchSnapshot.properties.filter(propertyIndexingReleased).length, tone: "green" },
    { label: "DNS switches to run", value: total - dnsPointed, tone: total - dnsPointed ? "yellow" : "green" },
    { label: "Vanity QA fixes", value: contentIssues, tone: contentIssues ? "yellow" : "green" },
  ];
}

function Sparkline({ points, tone = "green" }: { points: LaunchTrendPoint[]; tone?: SignalColor }) {
  const values = points.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const spread = Math.max(max - min, 1);
  const path = points
    .map((point, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = 44 - ((point.value - min) / spread) * 36;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className="h-16 w-full overflow-visible" viewBox="0 0 100 48" preserveAspectRatio="none" role="img" aria-label="Trend chart">
      <path d="M 0 44 L 100 44" stroke="#D6D6D2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <path d={path} fill="none" stroke={toneColors[tone]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MiniBars({ points, tone = "green" }: { points: LaunchTrendPoint[]; tone?: SignalColor }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <div className="flex h-16 items-end gap-1">
      {points.map((point) => (
        <div key={`${point.label}-${point.value}`} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t"
            style={{
              height: `${Math.max(8, (point.value / max) * 56)}px`,
              background: toneColors[tone],
            }}
          />
        </div>
      ))}
    </div>
  );
}

function BreakdownBars({ title, icon: Icon, rows }: { title: string; icon: React.ElementType; rows: LaunchBreakdown[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="rounded-lg border border-[#D6D6D2] bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#3D66B9]" />
        <p className="text-sm font-black text-[#15284B]">{title}</p>
      </div>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black text-[#15284B]">
              <span>{row.label}</span>
              <span>{row.value}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#E8E8E4]">
              <div
                className="h-full rounded-full"
                style={{ width: `${(row.value / max) * 100}%`, background: toneColors[row.tone] }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommandSummary() {
  const kinstaMobile = averageScore(1, "mobileScore");
  const kinstaDesktop = averageScore(1, "desktopScore");
  const total = launchSnapshot.summary.totalProperties;
  const dnsPointed = launchSnapshot.properties.filter(propertyDnsPointed).length;
  const primaryPending = launchSnapshot.properties.filter(propertyPrimaryPending).length;
  const primaryComplete = launchSnapshot.properties.filter(propertyPrimaryComplete).length;
  const indexingReleased = launchSnapshot.properties.filter(propertyIndexingReleased).length;
  const vanityQaPassed = launchSnapshot.summary.vanityQaGreen;
  const vanityQaOpen = launchSnapshot.summary.vanityQaYellow + launchSnapshot.summary.vanityQaRed;
  const corePagesClean = Math.max(0, launchSnapshot.summary.vanityQaCorePagesChecked - launchSnapshot.summary.vanityQaCorePageIssues);

  const rows = [
    { label: "DNS", value: `${dnsPointed}/${total}`, tone: "green" as SignalColor, detail: "Pointed" },
    { label: "Primary", value: `${primaryComplete}/${total}`, tone: primaryComplete === total ? "green" as SignalColor : "yellow" as SignalColor, detail: primaryPending ? `${primaryPending} open` : "Complete" },
    { label: "Indexing", value: `${indexingReleased}/${total}`, tone: indexingReleased === total ? "green" as SignalColor : "yellow" as SignalColor, detail: "Index/follow" },
    { label: "Vanity QA", value: `${vanityQaPassed}/${launchSnapshot.summary.vanityQaTotal}`, tone: vanityQaOpen ? "yellow" as SignalColor : "green" as SignalColor, detail: vanityQaOpen ? `${vanityQaOpen} open` : "Passed" },
    { label: "Core Pages", value: `${corePagesClean}/${launchSnapshot.summary.vanityQaCorePagesChecked}`, tone: launchSnapshot.summary.vanityQaCorePageIssues ? "yellow" as SignalColor : "green" as SignalColor, detail: launchSnapshot.summary.vanityQaCorePageIssues ? `${launchSnapshot.summary.vanityQaCorePageIssues} page item` : "Clean" },
    { label: "Red Issues", value: String(launchSnapshot.summary.vanityQaRed), tone: launchSnapshot.summary.vanityQaRed ? "red" as SignalColor : "green" as SignalColor, detail: launchSnapshot.summary.vanityQaRed ? "Needs review" : "None" },
    { label: "Public Moves", value: `${launchSnapshot.summary.publicMovesCompleted}/${total}`, tone: "green" as SignalColor, detail: "Redirects active" },
    { label: "Promo Bars", value: "Watch", tone: "yellow" as SignalColor, detail: "Follow-up open" },
  ];

  return (
    <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_320px]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-[#D6D6D2] bg-[#F6F6F5] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase text-[#9B9B96]">{row.label}</p>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: toneColors[row.tone] }} />
            </div>
            <p className="mt-2 text-2xl font-black text-[#15284B]">{row.value}</p>
            <p className="mt-1 text-xs font-bold text-[#15284B]/70">{row.detail}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-[#D6D6D2] bg-[#15284B] p-4 text-white">
        <p className="text-xs font-black uppercase text-[#7DCAC2]">Benchmark Snapshot</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-[#15284B]">Kinsta M {kinstaMobile ?? "-"}</span>
          <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-[#15284B]">Kinsta D {kinstaDesktop ?? "-"}</span>
          <span className="rounded-full bg-[#7DCAC2] px-3 py-1.5 text-sm font-black text-[#15284B]">{launchSnapshot.summary.vanityQaRed} red QA issues</span>
          <span className="rounded-full bg-[#F5C542] px-3 py-1.5 text-sm font-black text-[#15284B]">{launchSnapshot.summary.vanityQaCorePageIssues} core page item</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-white/76">
          Latest QA ran {launchSnapshot.summary.vanityQaLatestDate || "today"}; optimization work can now compare against the current live benchmark.
        </p>
      </div>
    </div>
  );
}

function PhaseCard({ phase, index }: { phase: LaunchPhase; index: number }) {
  return (
    <div className="relative rounded-lg border border-[#D6D6D2] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black text-white" style={{ background: toneColors[phase.status.color] }}>
          {index + 1}
        </div>
        <SignalBadge signal={phase.status} compact />
      </div>
      <div className="mt-4">
        <p className="text-sm font-black text-[#15284B]">{phase.label}</p>
        <p className="mt-1 text-2xl font-black text-[#15284B]">{phase.value}</p>
        <p className="mt-2 min-h-[40px] text-xs leading-5 text-[#15284B]/70">{phase.status.detail}</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E8E8E4]">
        <div className="h-full rounded-full" style={{ width: `${Math.max(4, phase.percent)}%`, background: toneColors[phase.status.color] }} />
      </div>
    </div>
  );
}

function PortfolioPipeline() {
  const total = launchSnapshot.summary.totalProperties;
  const vanityQaPassed = launchSnapshot.summary.vanityQaGreen;
  const openQaItems = launchSnapshot.summary.vanityQaYellow + launchSnapshot.summary.vanityQaRed;

  return (
    <section className="mb-4 rounded-lg border border-[#D6D6D2] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#3D66B9]" />
            <p className="text-sm font-black text-[#15284B]">Launch Progression</p>
          </div>
          <p className="mt-1 text-sm leading-6 text-[#15284B]/76">
            The batch has cleared live vanity routing, root indexing, legacy redirects, and mobile smoke checks. Expanded page-shape QA has one yellow item.
          </p>
        </div>
        <SignalBadge
          signal={{
            color: openQaItems ? "yellow" : "green",
            label: openQaItems ? `Vanity QA ${vanityQaPassed}/${total}` : "Vanity QA Passed",
            detail: "",
          }}
        />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {portfolioPhases().map((phase, index) => (
          <PhaseCard key={phase.label} phase={phase} index={index} />
        ))}
      </div>
    </section>
  );
}

function BenchmarkSummary() {
  const legacyMobile = averageScore(0, "mobileScore");
  const legacyDesktop = averageScore(0, "desktopScore");
  const kinstaMobile = averageScore(1, "mobileScore");
  const kinstaDesktop = averageScore(1, "desktopScore");
  const vanityMobile = averageScore(2, "mobileScore");
  const vanityDesktop = averageScore(2, "desktopScore");
  const total = launchSnapshot.summary.totalProperties;
  const legacyMeasured = measuredTargets(0);
  const kinstaMeasured = measuredTargets(1);
  const vanityMeasured = measuredTargets(2);

  return (
    <section className="mb-4 rounded-lg border border-[#D6D6D2] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[#3D66B9]" />
          <p className="text-sm font-black text-[#15284B]">Performance Progression</p>
        </div>
        <span className="rounded-full border border-[#D6D6D2] bg-[#F6F6F5] px-3 py-1 text-xs font-black text-[#15284B]">
          Live vanity PSI {vanityMeasured}/{total}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StageAverageCard
          eyebrow="Starting Point"
          title="Legacy"
          mobile={legacyMobile}
          desktop={legacyDesktop}
          measured={`${legacyMeasured}/${total}`}
          helper="Original Venterra pages before the move."
        />
        <StageAverageCard
          eyebrow="Pre-Launch"
          title="Staging"
          mobile={kinstaMobile}
          desktop={kinstaDesktop}
          measured={`${kinstaMeasured}/${total}`}
          helper="Kinsta staging scores for the new launch sites."
        />
        <StageAverageCard
          eyebrow="Current Site"
          title="Live Vanity"
          mobile={vanityMobile}
          desktop={vanityDesktop}
          measured={`${vanityMeasured}/${total}`}
          helper={vanityMeasured ? "Live vanity scores captured after the move." : "Live vanity domains are moved; PSI capture is next."}
        />
        <StageAverageCard
          eyebrow="Future State"
          title="Optimized"
          mobile="90+"
          desktop="95+"
          measured="Target"
          helper="Post-optimization target lane for governed proof."
          target
        />
      </div>
    </section>
  );
}

function PropertyPhaseGrid({ property }: { property: LaunchProperty }) {
  const displayProgress = propertyDisplayProgress(property);

  return (
    <div className="rounded-lg border border-[#D6D6D2] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#3D66B9]" />
          <p className="text-sm font-black text-[#15284B]">Property Progression</p>
        </div>
        <span className="rounded-full border border-[#D6D6D2] bg-[#F6F6F5] px-3 py-1 text-xs font-black text-[#15284B]">
          {displayProgress}% prepared
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {propertyPhases(property).map((phase, index) => (
          <div key={phase.label} className="rounded-lg bg-[#F6F6F5] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-black text-white" style={{ background: toneColors[phase.status.color] }}>
                {index + 1}
              </span>
              <SignalBadge signal={phase.status} compact />
            </div>
            <p className="mt-3 text-xs font-black uppercase text-[#9B9B96]">{phase.label}</p>
            <p className="mt-1 text-lg font-black text-[#15284B]">{phase.value}</p>
            <p className="mt-1 text-xs leading-5 text-[#15284B]/70">{phase.status.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScrutinyOverview() {
  const { summary } = launchSnapshot;
  const organicTone: SignalColor = (summary.organicSessionChangePercent ?? 0) >= 0 ? "green" : "yellow";

  return (
    <section className="mb-4 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-lg border border-[#D6D6D2] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#3D66B9]" />
              <p className="text-sm font-black text-[#15284B]">Organic Search History</p>
            </div>
            <p className="mt-2 text-3xl font-black text-[#15284B]">{summary.organicT30Sessions.toLocaleString()}</p>
            <p className="text-xs font-bold text-[#15284B]/70">latest 30-day Organic Search sessions through {summary.organicLatestDate}</p>
          </div>
          <div className="grid min-w-[210px] gap-2">
            <SignalBadge signal={{ color: organicTone, label: `${formatDelta(summary.organicSessionChangePercent)} vs prior T30`, detail: "" }} />
            <span className="rounded-full border border-[#D6D6D2] bg-[#F6F6F5] px-3 py-1.5 text-sm font-black text-[#15284B]">
              {summary.organicSharePercent ?? "n/a"}% of sessions
            </span>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-[#F6F6F5] p-3">
            <p className="text-xs font-black uppercase text-[#9B9B96]">Prior T30</p>
            <p className="mt-1 text-xl font-black text-[#15284B]">{summary.organicPriorT30Sessions.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-[#F6F6F5] p-3">
            <p className="text-xs font-black uppercase text-[#9B9B96]">Properties</p>
            <p className="mt-1 text-xl font-black text-[#15284B]">{summary.totalProperties}</p>
          </div>
          <div className="rounded-lg bg-[#F6F6F5] p-3">
            <p className="text-xs font-black uppercase text-[#9B9B96]">Homes</p>
            <p className="mt-1 text-xl font-black text-[#15284B]">{summary.totalHomes.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#D6D6D2] bg-white p-4">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[#3D66B9]" />
          <p className="text-sm font-black text-[#15284B]">PSI History</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Dial
            label="Legacy Mobile Avg"
            value={summary.psiMobileAverage === null ? "n/a" : String(summary.psiMobileAverage)}
            helper={`Daily history through ${summary.psiLatestDate}`}
            percent={summary.psiMobileAverage ?? 0}
            tone={(summary.psiMobileAverage ?? 0) >= 75 ? "green" : "yellow"}
            size="small"
          />
          <Dial
            label="Live Vanity PSI"
            value={`${measuredTargets(2)}/${summary.totalProperties}`}
            helper={measuredTargets(2) ? `Captured through ${summary.freshPsiLatestDate || "n/a"}` : "Capture before optimization work begins"}
            percent={Math.round((measuredTargets(2) / summary.totalProperties) * 100)}
            tone={measuredTargets(2) === summary.totalProperties ? "green" : "yellow"}
            size="small"
          />
        </div>
        <p className="mt-3 text-sm leading-6 text-[#15284B]/76">
          Legacy and staging scores are captured; live vanity scores become the before-optimization benchmark.
        </p>
      </div>
    </section>
  );
}

function MetricStrip({ metrics }: { metrics: LaunchMetric[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => (
        <Dial
          key={metric.label}
          label={metric.label}
          value={metric.value}
          helper={metric.helper}
          percent={metric.percent}
          tone={metric.tone}
          size="small"
        />
      ))}
    </div>
  );
}

type ScoreValue = number | string | null;

function scoreValueTone(score: ScoreValue, target = false): SignalColor {
  if (target) return "gray";
  return typeof score === "number" ? scoreTone(score) : "gray";
}

function ScorePill({ label, score, target = false }: { label: string; score: ScoreValue; target?: boolean }) {
  const tone = scoreValueTone(score, target);

  return (
    <span className="inline-flex min-w-[92px] items-center justify-between gap-2 rounded-full border border-[#D6D6D2] bg-white px-2.5 py-1 text-xs font-black text-[#15284B]">
      <span>{label}</span>
      <span className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-white" style={{ background: toneColors[tone] }}>
        {score ?? "-"}
      </span>
    </span>
  );
}

type PerformanceStage = {
  title: string;
  eyebrow: string;
  url: string;
  signal: LaunchSignal;
  mobileScore: ScoreValue;
  desktopScore: ScoreValue;
  note: string;
  target?: boolean;
};

function StageAverageCard({
  title,
  eyebrow,
  mobile,
  desktop,
  measured,
  helper,
  target = false,
}: {
  title: string;
  eyebrow: string;
  mobile: ScoreValue;
  desktop: ScoreValue;
  measured: string;
  helper: string;
  target?: boolean;
}) {
  return (
    <div className="rounded-lg bg-[#F6F6F5] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase text-[#9B9B96]">{eyebrow}</p>
          <p className="mt-1 text-lg font-black text-[#15284B]">{title}</p>
        </div>
        <span className="rounded-full border border-[#D6D6D2] bg-white px-2.5 py-1 text-xs font-black text-[#15284B]">{measured}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ScorePill label="Mobile" score={mobile} target={target} />
        <ScorePill label="Desktop" score={desktop} target={target} />
      </div>
      <p className="mt-3 text-xs leading-5 text-[#15284B]/70">{helper}</p>
    </div>
  );
}

function StageScoreBlock({ label, score, target = false }: { label: string; score: ScoreValue; target?: boolean }) {
  const tone = scoreValueTone(score, target);
  const display = score === null ? "Pending" : score;

  return (
    <div className="min-w-[116px] rounded-lg border border-[#D6D6D2] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase text-[#9B9B96]">{label}</p>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: toneColors[tone] }} />
      </div>
      <p className={cn("mt-2 text-2xl font-black", target ? "text-[#9B9B96]" : "text-[#15284B]")}>{display}</p>
    </div>
  );
}

function MoveStageCard({ stage, index }: { stage: PerformanceStage; index: number }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#D6D6D2] bg-[#F6F6F5] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black text-white" style={{ background: toneColors[stage.signal.color] }}>
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase text-[#9B9B96]">{stage.eyebrow}</p>
            <p className="mt-1 text-lg font-black text-[#15284B]">{stage.title}</p>
          </div>
        </div>
        <SignalBadge signal={stage.signal} compact />
      </div>
      <div className="mt-3 min-h-[34px]">
        <ExternalUrl label={stage.url.replace("https://", "")} url={stage.url} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <StageScoreBlock label="Mobile PSI" score={stage.mobileScore} target={stage.target} />
        <StageScoreBlock label="Desktop PSI" score={stage.desktopScore} target={stage.target} />
      </div>
      <p className="mt-3 text-xs leading-5 text-[#15284B]/70">{stage.note}</p>
    </div>
  );
}

function liveVanityStage(property: LaunchProperty, vanity: PsiLaunchTarget): PerformanceStage {
  const captured = typeof vanity.mobileScore === "number" || typeof vanity.desktopScore === "number";
  return {
    title: "Live Vanity",
    eyebrow: "Current Site",
    url: property.newUrl.url,
    signal: captured
      ? { color: "green", label: "Captured", detail: vanity.note }
      : { color: "yellow", label: "PSI Pending", detail: "The vanity site is live; final PSI capture is the next benchmark." },
    mobileScore: vanity.mobileScore,
    desktopScore: vanity.desktopScore,
    note: captured ? vanity.note : "Live site is confirmed; capture this score before optimization work begins.",
  };
}

function performanceStages(property: LaunchProperty): PerformanceStage[] {
  const [legacy, kinsta, vanity] = property.psiLaunchTargets;

  return [
    {
      title: "Legacy",
      eyebrow: "Starting Point",
      url: legacy.url,
      signal: { color: legacy.status === "captured" ? "green" : "yellow", label: legacy.status === "captured" ? "Captured" : "Pending", detail: legacy.note },
      mobileScore: legacy.mobileScore,
      desktopScore: legacy.desktopScore,
      note: "Original Venterra page baseline before the public move.",
    },
    {
      title: "Staging",
      eyebrow: "Pre-Launch",
      url: kinsta.url,
      signal: { color: kinsta.status === "captured" ? "green" : "yellow", label: kinsta.status === "captured" ? "Captured" : "Pending", detail: kinsta.note },
      mobileScore: kinsta.mobileScore,
      desktopScore: kinsta.desktopScore,
      note: "Kinsta staging benchmark for the new experience before vanity launch.",
    },
    liveVanityStage(property, vanity),
    {
      title: "Optimized",
      eyebrow: "Future State",
      url: property.newUrl.url,
      signal: { color: "gray", label: "Queued", detail: "Optimization begins after post-launch issues and promo rendering are stable." },
      mobileScore: "90+",
      desktopScore: "95+",
      note: "Target lane for the governed optimization package and post-work proof.",
      target: true,
    },
  ];
}

function MoveInfoRow({ property }: { property: LaunchProperty }) {
  const stages = performanceStages(property);

  return (
    <div className="rounded-lg border border-[#D6D6D2] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-[#3D66B9]" />
          <p className="text-sm font-black text-[#15284B]">Performance Journey</p>
        </div>
        <span className="rounded-full border border-[#D6D6D2] bg-[#F6F6F5] px-3 py-1 text-xs font-black text-[#15284B]">
          Legacy to optimized proof path
        </span>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] xl:items-stretch">
        {stages.map((stage, index) => (
          <React.Fragment key={stage.title}>
            <MoveStageCard stage={stage} index={index} />
            {index < stages.length - 1 ? (
              <div className="hidden items-center justify-center xl:flex">
                <ArrowRight className="h-5 w-5 text-[#3D66B9]" />
              </div>
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function StepRail({ property }: { property: LaunchProperty }) {
  return (
    <div className="rounded-lg border border-[#D6D6D2] bg-white p-4">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-[#3D66B9]" />
        <p className="text-sm font-black text-[#15284B]">Launch Steps</p>
      </div>
      <div className="mt-4 grid gap-0">
        {property.steps.map((step, index) => {
          const isLast = index === property.steps.length - 1;
          return (
            <div key={step.number} className="grid grid-cols-[32px_1fr] gap-3">
              <div className="relative flex justify-center">
                <span
                  className="z-10 grid h-8 w-8 place-items-center rounded-full text-xs font-black text-white"
                  style={{ background: toneColors[step.status.color] }}
                >
                  {step.number}
                </span>
                {!isLast ? <span className="absolute top-8 h-full w-px bg-[#D6D6D2]" /> : null}
              </div>
              <div className={cn("pb-4", isLast && "pb-0")}>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F6F6F5] p-3">
                  <div>
                    <p className="font-black text-[#15284B]">{step.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#15284B]/70">{step.status.detail}</p>
                  </div>
                  <SignalBadge signal={step.status} compact />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FactRows({ property }: { property: LaunchProperty }) {
  const iconByLabel: Record<string, React.ElementType> = {
    "Domain status": Globe2,
    "Public routing": Link2,
    "Indexing condition": Search,
    "Analytics history": TrendingUp,
    "Performance baseline": Gauge,
    "Launch prep": ShieldCheck,
  };

  return (
    <div className="rounded-lg border border-[#D6D6D2] bg-white p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[#3D66B9]" />
        <p className="text-sm font-black text-[#15284B]">Monitoring Details</p>
      </div>
      <div className="mt-4 divide-y divide-[#D6D6D2]">
        {property.facts.map((fact) => {
          const Icon = iconByLabel[fact.label] ?? CheckCircle2;
          return (
            <div key={fact.label} className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[220px_1fr_auto] md:items-center">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[#294782]" />
                <p className="font-black text-[#15284B]">{fact.label}</p>
              </div>
              <p className="text-sm font-bold text-[#15284B]/76">{fact.value}</p>
              <SignalBadge signal={fact.signal} compact />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PropertyTrendPanels({ property }: { property: LaunchProperty }) {
  const organicTone: SignalColor = (property.organic.sessionChangePercent ?? 0) >= 0 ? "green" : "yellow";
  const mobileTone: SignalColor = (property.psi.mobileScore ?? 0) >= 75 ? "green" : "yellow";
  const desktopTone: SignalColor = (property.psi.desktopScore ?? 0) >= 75 ? "green" : "yellow";

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-lg border border-[#D6D6D2] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#3D66B9]" />
              <p className="text-sm font-black text-[#15284B]">Organic Search Trend</p>
            </div>
            <p className="mt-2 text-2xl font-black text-[#15284B]">{property.organic.t30Sessions.toLocaleString()}</p>
            <p className="text-xs font-bold text-[#15284B]/70">latest 30 days through {property.organic.latestDate || "n/a"}</p>
          </div>
          <SignalBadge signal={{ color: organicTone, label: `${formatDelta(property.organic.sessionChangePercent)} vs prior T30`, detail: "" }} compact />
        </div>
        <div className="mt-3">
          <Sparkline points={property.organic.trend} tone={organicTone} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-[#F6F6F5] p-2">
            <p className="text-[11px] font-black uppercase text-[#9B9B96]">Share</p>
            <p className="mt-1 text-sm font-black text-[#15284B]">{property.organic.organicSharePercent ?? "n/a"}%</p>
          </div>
          <div className="rounded-lg bg-[#F6F6F5] p-2">
            <p className="text-[11px] font-black uppercase text-[#9B9B96]">Users</p>
            <p className="mt-1 text-sm font-black text-[#15284B]">{property.organic.t30Users.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-[#F6F6F5] p-2">
            <p className="text-[11px] font-black uppercase text-[#9B9B96]">Conversions</p>
            <p className="mt-1 text-sm font-black text-[#15284B]">{property.organic.t30Conversions.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#D6D6D2] bg-white p-4">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[#3D66B9]" />
          <p className="text-sm font-black text-[#15284B]">PSI Trend</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-[#F6F6F5] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase text-[#9B9B96]">Mobile</p>
              <SignalBadge signal={{ color: mobileTone, label: property.psi.mobileScore === null ? "Open" : String(property.psi.mobileScore), detail: "" }} compact />
            </div>
            <div className="mt-3">
              <MiniBars points={property.psi.mobileTrend} tone={mobileTone} />
            </div>
            <p className="mt-2 text-xs font-bold text-[#15284B]/70">LCP {property.psi.mobileLcp ?? "n/a"}s | CLS {property.psi.mobileCls ?? "n/a"}</p>
          </div>
          <div className="rounded-lg bg-[#F6F6F5] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase text-[#9B9B96]">Desktop</p>
              <SignalBadge signal={{ color: desktopTone, label: property.psi.desktopScore === null ? "Open" : String(property.psi.desktopScore), detail: "" }} compact />
            </div>
            <div className="mt-3">
              <MiniBars points={property.psi.desktopTrend} tone={desktopTone} />
            </div>
            <p className="mt-2 text-xs font-bold text-[#15284B]/70">LCP {property.psi.desktopLcp ?? "n/a"}s | CLS {property.psi.desktopCls ?? "n/a"}</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#15284B]/76">Existing current-site history and live vanity benchmarks are ready for comparison before optimization begins.</p>
      </div>
    </div>
  );
}

function PropertyDrawer({ property }: { property: LaunchProperty }) {
  const displaySignal = propertyDisplaySignal(property);
  const displayNextStep = propertyDisplayNextStep(property);

  return (
    <details className="group rounded-lg border border-[#D6D6D2] bg-white shadow-[0_10px_28px_rgba(21,40,75,0.07)]">
      <summary className="grid cursor-pointer list-none gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-[#15284B]">{property.propertyName}</h2>
            <span className="rounded-full border border-[#D6D6D2] bg-[#F6F6F5] px-2.5 py-1 text-xs font-black text-[#294782]">
              {property.propertyCode}
            </span>
          </div>
          <p className="mt-1 text-sm font-bold text-[#294782]">
            {property.market} | {property.units.toLocaleString()} homes
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SignalBadge signal={displaySignal} compact />
            <span className="inline-flex items-center gap-2 rounded-full border border-[#D6D6D2] bg-[#F6F6F5] px-2.5 py-1 text-xs font-black text-[#15284B]">
              <CalendarDays className="h-3.5 w-3.5 text-[#3D66B9]" />
              {property.launchDate}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#D6D6D2] bg-[#F6F6F5] px-2.5 py-1 text-xs font-black text-[#15284B]">
              <Gauge className="h-3.5 w-3.5 text-[#F5C542]" />
              Benchmarks captured
            </span>
          </div>
        </div>
        <div className="flex items-start justify-between gap-4 lg:justify-end">
          <div className="hidden min-w-[240px] rounded-lg bg-[#F6F6F5] p-3 md:block">
            <p className="text-xs font-black uppercase text-[#9B9B96]">Next action</p>
            <p className="mt-1 text-sm font-black text-[#15284B]">{displayNextStep}</p>
          </div>
          <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-[#3D66B9] transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t border-[#D6D6D2] px-4 pb-5 sm:px-5">
        <div className="grid gap-4 py-5">
          <MoveInfoRow property={property} />
          <PropertyPhaseGrid property={property} />
          <MetricStrip metrics={property.metrics} />
          <PropertyTrendPanels property={property} />
          <StepRail property={property} />
          <FactRows property={property} />
          <div className="rounded-lg border border-[#D6D6D2] bg-[#15284B] p-4 text-white">
            <p className="text-sm font-black text-[#7DCAC2]">Bottom Line</p>
            <p className="mt-2 text-sm leading-6 text-white/86">{property.historyNote}</p>
            <p className="mt-3 text-sm font-black">{displayNextStep}</p>
          </div>
        </div>
      </div>
    </details>
  );
}

export function LaunchDashboardClient() {
  const { summary } = launchSnapshot;
  const qaOpen = summary.vanityQaYellow + summary.vanityQaRed;
  const corePagesClean = Math.max(0, summary.vanityQaCorePagesChecked - summary.vanityQaCorePageIssues);

  return (
    <div className="min-h-screen bg-[#F6F6F5] text-[#15284B]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-[#D6D6D2] bg-white p-5 shadow-[0_16px_44px_rgba(21,40,75,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black text-[#3D66B9]">Resi Edge Portfolio Launch</p>
              <h1 className="mt-1 text-3xl font-black text-[#15284B]">Property Move Monitor</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#15284B]/76">
                A read-only launch room for the first 20 property moves, showing what is live, what passed QA, and what still needs a decision.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#D6D6D2] bg-[#F6F6F5] px-3 py-1.5 text-sm font-black text-[#15284B]">
              <LockKeyhole className="h-4 w-4 text-[#3B9189]" />
              Read-only
            </span>
          </div>

          <CommandSummary />
        </header>

        <main className="mt-5 rounded-lg border border-[#D6D6D2] bg-[#F6F6F5] p-3 shadow-[0_16px_44px_rgba(21,40,75,0.08)] sm:p-4">
          <div className="mb-4 rounded-lg bg-[#15284B] p-4 text-white">
            <div className="grid gap-3">
              <div>
                <p className="text-sm font-black text-[#7DCAC2]">Current Portfolio Truth</p>
                <p className="mt-1 max-w-5xl text-xl font-black leading-8">
                  Expanded vanity QA: {summary.vanityQaGreen} green, {summary.vanityQaYellow} yellow, {summary.vanityQaRed} red. Root routing, canonical, indexability, mobile smoke, and legacy redirects are green; one core page needs cleanup.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <TruthChip tone="green" label="20 live domains" />
                <TruthChip tone="green" label="60 redirects active" />
                <TruthChip tone={summary.vanityQaCorePageIssues ? "yellow" : "green"} label={`${corePagesClean}/${summary.vanityQaCorePagesChecked} core pages clean`} />
                <TruthChip tone={summary.vanityQaRed ? "red" : "green"} label={`${summary.vanityQaRed} red issues`} />
                <TruthChip tone={qaOpen ? "yellow" : "green"} label={`${qaOpen} QA open`} />
                <TruthChip tone="yellow" label="Promo bars watching" />
              </div>
            </div>
          </div>

          <PortfolioPipeline />
          <BenchmarkSummary />
          <ScrutinyOverview />

          <section className="mb-4 grid gap-3 lg:grid-cols-2">
            <BreakdownBars title="Work Ahead" icon={BarChart3} rows={workAheadRows()} />
            <BreakdownBars title="Market Mix" icon={Globe2} rows={launchSnapshot.marketBreakdown} />
          </section>

          <div className="grid grid-cols-1 gap-3">
            {launchSnapshot.properties.map((property) => (
              <PropertyDrawer key={property.propertyCode} property={property} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
