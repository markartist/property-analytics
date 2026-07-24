"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  API_BASE_URL,
  createPibBuilderConfig,
  createPibBuilderGenerationJob,
  createPibBuilderSchedule,
  getPibBuilderGenerationJob,
  getCommunities,
  getPibBuilderState,
  runPibBuilderScheduleNow,
  updatePibBuilderConfig,
  updatePibBuilderSchedule,
  type Community,
  type PibBuilderConfig,
  type PibBuilderGenerationJob,
  type PibBuilderSchedule,
  type PibBuilderRun,
} from "@/lib/api";
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Mail,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";

type BuilderTab = "home" | "create" | "library" | "scheduled" | "links";
type BuilderStep = 1 | 2 | 3;
type Scope = "portfolio" | "property";
type Cadence = "one_time" | "weekly" | "monthly" | "quarterly";
type DeliveryMode = "email_now" | "open" | null;
type BuilderAction = "email" | "generate" | "save" | "schedule";
type BuildProgressStep = "queued" | "building" | "publishing" | "sending" | "opening" | "complete";
type BuildProgress = {
  step: BuildProgressStep;
  percent: number;
  title: string;
  detail: string;
};

type PibSection = {
  id: string;
  label: string;
  group: "Foundation" | "Performance" | "Search and Market" | "Leasing" | "Reputation";
  selectable: boolean;
  defaultInFullPib: boolean;
  sourceAuthority: string;
};

type PibPreset = {
  id: string;
  label: string;
  sectionIds: string[];
};

type SavedBuilderConfig = {
  id: string;
  recordType: "config" | "schedule" | "link";
  configId: string;
  scheduleId?: string;
  reportName: string;
  scope: Scope;
  communityId: string;
  communityName: string;
  dateRange: string;
  presetLabel: string;
  selectedSectionIds: string[];
  cadence: Cadence;
  dayOfWeek: string;
  dayOfMonth: string;
  deliveryTime: string;
  recipients: string;
  linkPath: string;
  createdAt: string;
  nextRunAt?: string | null;
  lastRunStatus?: string | null;
  scheduleStatus?: "draft" | "active" | "paused" | "archived";
  status: "saved" | "scheduled" | "link";
};

const PIB_SECTIONS: PibSection[] = [
  {
    id: "report_identity",
    label: "Report Identity",
    group: "Foundation",
    selectable: false,
    defaultInFullPib: true,
    sourceAuthority: "PIB generator metadata",
  },
  {
    id: "source_coverage_freshness",
    label: "Source Coverage and Freshness",
    group: "Foundation",
    selectable: false,
    defaultInFullPib: true,
    sourceAuthority: "Data Pond collection metadata",
  },
  {
    id: "executive_kpi_overview",
    label: "Executive KPI Overview",
    group: "Performance",
    selectable: true,
    defaultInFullPib: true,
    sourceAuthority: "Data Pond source-of-truth metrics",
  },
  {
    id: "pib_site_evaluation",
    label: "PIB Site Evaluation",
    group: "Performance",
    selectable: true,
    defaultInFullPib: true,
    sourceAuthority: "Data Pond, DataForSEO, BI workbooks, GSC, PageSpeed, availability, reviews",
  },
  {
    id: "traffic_engagement",
    label: "Traffic and Engagement",
    group: "Performance",
    selectable: true,
    defaultInFullPib: true,
    sourceAuthority: "GA4 / Data Pond",
  },
  {
    id: "conversion_intent",
    label: "Conversion Intent",
    group: "Performance",
    selectable: true,
    defaultInFullPib: true,
    sourceAuthority: "GA4 events / Data Pond",
  },
  {
    id: "search_performance",
    label: "Search Performance",
    group: "Search and Market",
    selectable: true,
    defaultInFullPib: true,
    sourceAuthority: "GSC / Data Pond",
  },
  {
    id: "dataforseo_search_visibility",
    label: "Search Market Visibility",
    group: "Search and Market",
    selectable: true,
    defaultInFullPib: true,
    sourceAuthority: "DataForSEO API rows stored in Pond",
  },
  {
    id: "paid_media",
    label: "Paid Media",
    group: "Search and Market",
    selectable: true,
    defaultInFullPib: true,
    sourceAuthority: "Google Ads API with BI fallback where explicitly stated",
  },
  {
    id: "competitor_intelligence",
    label: "Competitor Intelligence",
    group: "Search and Market",
    selectable: true,
    defaultInFullPib: true,
    sourceAuthority: "Competitor evidence ledger and governed market sources",
  },
  {
    id: "apartmentiq_market_enrichment",
    label: "ApartmentIQ Market Enrichment",
    group: "Search and Market",
    selectable: true,
    defaultInFullPib: true,
    sourceAuthority: "ApartmentIQ API rows stored in Pond",
  },
  {
    id: "availability_inventory",
    label: "Availability and Inventory",
    group: "Leasing",
    selectable: true,
    defaultInFullPib: true,
    sourceAuthority: "Pond / unit availability feed",
  },
  {
    id: "guest_cards_leasing",
    label: "Guest Cards and Leasing",
    group: "Leasing",
    selectable: true,
    defaultInFullPib: true,
    sourceAuthority: "Guest card and BI source rows",
  },
  {
    id: "sightmap_signals",
    label: "SightMap Signals",
    group: "Leasing",
    selectable: true,
    defaultInFullPib: true,
    sourceAuthority: "GA4 supplemental SightMap events",
  },
  {
    id: "local_presence",
    label: "Local Presence",
    group: "Reputation",
    selectable: true,
    defaultInFullPib: true,
    sourceAuthority: "GBP / Data Pond",
  },
  {
    id: "reviews_reputation",
    label: "Reviews and Reputation",
    group: "Reputation",
    selectable: true,
    defaultInFullPib: true,
    sourceAuthority: "GBP reviews, GBP sentiment, Reputation.com where available",
  },
  {
    id: "methodology_source_authority",
    label: "Methodology and Source Authority",
    group: "Foundation",
    selectable: false,
    defaultInFullPib: true,
    sourceAuthority: "PIB report contract",
  },
];

const PIB_PRESETS: PibPreset[] = [
  {
    id: "full_pib",
    label: "Full PIB",
    sectionIds: [
      "executive_kpi_overview",
      "pib_site_evaluation",
      "traffic_engagement",
      "conversion_intent",
      "search_performance",
      "dataforseo_search_visibility",
      "paid_media",
      "local_presence",
      "reviews_reputation",
      "availability_inventory",
      "guest_cards_leasing",
      "competitor_intelligence",
      "sightmap_signals",
      "apartmentiq_market_enrichment",
    ],
  },
  {
    id: "website_funnel_review",
    label: "Website / Funnel Review",
    sectionIds: [
      "pib_site_evaluation",
      "traffic_engagement",
      "conversion_intent",
      "search_performance",
      "dataforseo_search_visibility",
      "paid_media",
      "local_presence",
      "reviews_reputation",
    ],
  },
  {
    id: "leasing_inventory_review",
    label: "Leasing / Inventory Review",
    sectionIds: ["availability_inventory", "guest_cards_leasing", "conversion_intent", "sightmap_signals"],
  },
  {
    id: "market_context",
    label: "Market Context",
    sectionIds: [
      "competitor_intelligence",
      "dataforseo_search_visibility",
      "apartmentiq_market_enrichment",
      "availability_inventory",
    ],
  },
  {
    id: "reputation_local_presence",
    label: "Reputation / Local Presence",
    sectionIds: ["reviews_reputation", "local_presence", "dataforseo_search_visibility", "search_performance"],
  },
];

const SECTION_GROUPS: PibSection["group"][] = [
  "Foundation",
  "Performance",
  "Search and Market",
  "Leasing",
  "Reputation",
];

const DATE_RANGES = ["Latest PIB Window", "Last 30 Days", "Last 60 Days", "Last 90 Days", "Month to Date", "Quarter to Date"];
const WEEKDAY_OPTIONS = [
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
];
const MONTH_DAYS = [
  { label: "1", value: "1" },
  { label: "5", value: "5" },
  { label: "10", value: "10" },
  { label: "15", value: "15" },
  { label: "20", value: "20" },
  { label: "25", value: "25" },
  { label: "Last business day", value: "last_business_day" },
];

const requiredSectionIds = PIB_SECTIONS.filter((section) => !section.selectable).map((section) => section.id);
const fullPibPreset = PIB_PRESETS[0];

function selectedWithRequired(sectionIds: string[]) {
  return Array.from(new Set([...requiredSectionIds, ...sectionIds]));
}

function sectionCount(sectionIds: string[]) {
  return sectionIds.filter((id) => PIB_SECTIONS.find((section) => section.id === id)?.selectable).length;
}

function formatCadence(config: SavedBuilderConfig) {
  if (config.cadence === "weekly") return `Weekly on ${config.dayOfWeek} at ${config.deliveryTime}`;
  const dayLabel = MONTH_DAYS.find((day) => day.value === config.dayOfMonth)?.label ?? config.dayOfMonth;
  if (config.cadence === "monthly") return `Monthly on ${dayLabel} at ${config.deliveryTime}`;
  if (config.cadence === "quarterly") return `Quarterly on ${dayLabel} at ${config.deliveryTime}`;
  return "One-time";
}

function recipientList(value: string) {
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dayOfWeekLabel(value: number | null | undefined) {
  return WEEKDAY_OPTIONS.find((day) => day.value === value)?.label ?? "Monday";
}

function toSavedConfigEntry(config: PibBuilderConfig, status: "saved" | "link"): SavedBuilderConfig {
  return {
    id: `${status}-${config.id}`,
    recordType: status === "link" ? "link" : "config",
    configId: config.id,
    reportName: config.report_name,
    scope: config.scope,
    communityId: config.community_id ?? "",
    communityName: config.community_name ?? (config.scope === "portfolio" ? "Portfolio" : "Selected property"),
    dateRange: config.date_range,
    presetLabel: config.preset_label,
    selectedSectionIds: config.section_ids,
    cadence: "one_time",
    dayOfWeek: "Monday",
    dayOfMonth: "1",
    deliveryTime: "08:00",
    recipients: "",
    linkPath: config.canonical_path,
    createdAt: config.created_at,
    status,
  };
}

function toSavedScheduleEntry(config: PibBuilderConfig, schedule: PibBuilderSchedule): SavedBuilderConfig {
  return {
    id: `schedule-${schedule.id}`,
    recordType: "schedule",
    configId: config.id,
    scheduleId: schedule.id,
    reportName: config.report_name,
    scope: config.scope,
    communityId: config.community_id ?? "",
    communityName: config.community_name ?? (config.scope === "portfolio" ? "Portfolio" : "Selected property"),
    dateRange: config.date_range,
    presetLabel: config.preset_label,
    selectedSectionIds: config.section_ids,
    cadence: schedule.cadence,
    dayOfWeek: dayOfWeekLabel(schedule.day_of_week),
    dayOfMonth: schedule.day_of_month ?? "1",
    deliveryTime: schedule.send_time,
    recipients: schedule.recipients.join(", "),
    linkPath: config.canonical_path,
    createdAt: schedule.created_at,
    nextRunAt: schedule.next_run_at,
    lastRunStatus: schedule.last_run_status,
    scheduleStatus: schedule.status,
    status: "scheduled",
  };
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function progressForJob(job: PibBuilderGenerationJob, attempt: number): BuildProgress {
  if (job.status === "succeeded") {
    return {
      step: "publishing",
      percent: 76,
      title: "Report built",
      detail: "Finding the finished PIB HTML artifact.",
    };
  }
  if (job.status === "running") {
    return {
      step: "building",
      percent: Math.min(68, 30 + attempt * 4),
      title: "Building report",
      detail: "The canonical PIB worker is generating the Outlook report.",
    };
  }
  return {
    step: "queued",
    percent: Math.min(28, 12 + attempt * 2),
    title: "Queued",
    detail: "The report request is waiting for the PIB worker.",
  };
}

async function waitForGenerationJob(
  id: string,
  onProgress?: (progress: BuildProgress) => void
): Promise<PibBuilderGenerationJob> {
  let lastJob = await getPibBuilderGenerationJob(id);
  onProgress?.(progressForJob(lastJob, 0));
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (lastJob.status === "succeeded" || lastJob.status === "failed" || lastJob.status === "cancelled") return lastJob;
    await sleep(attempt < 6 ? 2_000 : 5_000);
    lastJob = await getPibBuilderGenerationJob(id);
    onProgress?.(progressForJob(lastJob, attempt + 1));
  }
  return lastJob;
}

export default function AnalysisPibBuilderPage() {
  const [activeTab, setActiveTab] = React.useState<BuilderTab>("home");
  const [builderStep, setBuilderStep] = React.useState<BuilderStep>(1);
  const [scope, setScope] = React.useState<Scope>("property");
  const [communityId, setCommunityId] = React.useState("");
  const [communities, setCommunities] = React.useState<Community[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [reportName, setReportName] = React.useState("");
  const [dateRange, setDateRange] = React.useState(DATE_RANGES[0]);
  const [presetId, setPresetId] = React.useState(fullPibPreset.id);
  const [selectedSectionIds, setSelectedSectionIds] = React.useState<string[]>(selectedWithRequired(fullPibPreset.sectionIds));
  const [deliveryMode, setDeliveryMode] = React.useState<DeliveryMode>(null);
  const [cadence, setCadence] = React.useState<Cadence>("one_time");
  const [dayOfWeek, setDayOfWeek] = React.useState("Monday");
  const [dayOfMonth, setDayOfMonth] = React.useState("1");
  const [deliveryTime, setDeliveryTime] = React.useState("08:00");
  const [recipients, setRecipients] = React.useState("");
  const [configs, setConfigs] = React.useState<PibBuilderConfig[]>([]);
  const [schedules, setSchedules] = React.useState<PibBuilderSchedule[]>([]);
  const [runs, setRuns] = React.useState<PibBuilderRun[]>([]);
  const [builderLoading, setBuilderLoading] = React.useState(true);
  const [saveWithSchedule, setSaveWithSchedule] = React.useState(false);
  const [actionPending, setActionPending] = React.useState<BuilderAction | null>(null);
  const [buildProgress, setBuildProgress] = React.useState<BuildProgress | null>(null);
  const [deliveredConfigId, setDeliveredConfigId] = React.useState<string | null>(null);
  const [deliveredReportUrl, setDeliveredReportUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    getCommunities()
      .then((rows) => setCommunities(rows.filter((c) => c.status !== "inactive")))
      .catch(() => setError("Failed to load communities"))
      .finally(() => setLoading(false));
  }, []);

  const loadBuilderState = React.useCallback(async () => {
    setBuilderLoading(true);
    try {
      const state = await getPibBuilderState();
      setConfigs(state.configs);
      setSchedules(state.schedules);
      setRuns(state.runs);
    } catch {
      setError("Saved PIB Builder records could not be loaded.");
    } finally {
      setBuilderLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadBuilderState();
  }, [loadBuilderState]);

  const selectedCommunity = communities.find((community) => community.id === communityId);
  const canonicalHref = scope === "portfolio" ? "/pib" : `/pib/property?id=${encodeURIComponent(communityId)}`;
  const activePreset = PIB_PRESETS.find((preset) => preset.id === presetId) ?? fullPibPreset;
  const configsById = React.useMemo(() => new Map(configs.map((config) => [config.id, config])), [configs]);
  const savedReports = configs.map((config) => toSavedConfigEntry(config, "saved"));
  const scheduledReports = schedules
    .map((schedule) => {
      const config = configsById.get(schedule.config_id);
      return config ? toSavedScheduleEntry(config, schedule) : null;
    })
    .filter((item): item is SavedBuilderConfig => Boolean(item));
  const reportLinks = configs.map((config) => toSavedConfigEntry(config, "link"));

  const setPreset = (nextPresetId: string) => {
    const preset = PIB_PRESETS.find((item) => item.id === nextPresetId) ?? fullPibPreset;
    setPresetId(preset.id);
    setSelectedSectionIds(selectedWithRequired(preset.sectionIds));
  };

  const toggleSection = (sectionId: string) => {
    const section = PIB_SECTIONS.find((item) => item.id === sectionId);
    if (!section?.selectable) return;
    setPresetId("custom");
    setSelectedSectionIds((current) => {
      if (current.includes(sectionId)) return current.filter((id) => id !== sectionId);
      return [...current, sectionId];
    });
  };

  const startNewReport = () => {
    setError(null);
    setNotice(null);
    setReportName("");
    setScope("property");
    setCommunityId("");
    setDateRange(DATE_RANGES[0]);
    setPreset(fullPibPreset.id);
    setDeliveryMode(null);
    setSaveWithSchedule(false);
    setCadence("one_time");
    setDayOfWeek("Monday");
    setDayOfMonth("1");
    setDeliveryTime("08:00");
    setRecipients("");
    setDeliveredConfigId(null);
    setDeliveredReportUrl(null);
    setBuilderStep(1);
    setActiveTab("create");
  };

  const validateBasics = () => {
    setError(null);
    if (!communityId) {
      setError("Select a property before continuing.");
      return false;
    }
    return true;
  };

  const validateConfig = () => {
    setError(null);
    if (!communityId) {
      setError("Select a property before saving this PIB configuration.");
      return false;
    }
    if (sectionCount(selectedSectionIds) === 0) {
      setError("Select at least one optional PIB area.");
      return false;
    }
    return true;
  };

  const reportDisplayName = () => {
    const propertyName = selectedCommunity?.name ?? "Property";
    return reportName.trim() || `${propertyName} PIB`;
  };

  const artifactUrl = () => {
    const url = new URL("/v1/pib-builder/artifacts/latest", API_BASE_URL);
    url.searchParams.set("scope", "property");
    url.searchParams.set("community_name", selectedCommunity?.name ?? "Selected property");
    return url.toString();
  };

  const buildConfigInput = () => ({
    report_name: reportDisplayName(),
    scope: "property" as const,
    community_id: communityId,
    community_name: selectedCommunity?.name ?? "Selected property",
    date_range: dateRange,
    preset_id: presetId,
    preset_label: presetId === "custom" ? "Custom" : activePreset.label,
    section_ids: selectedSectionIds,
  });

  const saveConfig = async () => {
    if (actionPending) return;
    if (!validateConfig()) return;
    setActionPending("save");
    try {
      const config = await createPibBuilderConfig(buildConfigInput());
      setConfigs((current) => [config, ...current.filter((item) => item.id !== config.id)]);
      setNotice("Report saved to the PIB library.");
      setActiveTab("library");
    } catch {
      setError("Unable to save this PIB configuration.");
    } finally {
      setActionPending(null);
    }
  };

  const saveLink = async () => {
    if (actionPending) return;
    if (!validateConfig()) return;
    setActionPending("save");
    try {
      const config = await createPibBuilderConfig(buildConfigInput());
      setConfigs((current) => [config, ...current.filter((item) => item.id !== config.id)]);
      setNotice("Share link saved to the PIB library.");
      setActiveTab("links");
    } catch {
      setError("Unable to save this PIB report link.");
    } finally {
      setActionPending(null);
    }
  };

  const saveSchedule = async () => {
    if (actionPending) return;
    if (!validateConfig()) return;
    const parsedRecipients = recipientList(recipients);
    if (parsedRecipients.length === 0) {
      setError("Add at least one recipient before staging a scheduled email.");
      return;
    }
    setActionPending("schedule");
    try {
      const config = await createPibBuilderConfig(buildConfigInput());
      const schedule = await createPibBuilderSchedule({
        config_id: config.id,
        cadence,
        timezone: "America/Chicago",
        day_of_week: WEEKDAY_OPTIONS.find((day) => day.label === dayOfWeek)?.value ?? 1,
        day_of_month: dayOfMonth,
        send_time: deliveryTime,
        recipients: parsedRecipients,
        status: "active",
      });
      setConfigs((current) => [config, ...current.filter((item) => item.id !== config.id)]);
      setSchedules((current) => [schedule, ...current.filter((item) => item.id !== schedule.id)]);
      setNotice("Scheduled email saved. Data Pond will send it on the selected cadence.");
      setActiveTab("scheduled");
    } catch {
      setError("Unable to create this PIB email schedule.");
    } finally {
      setActionPending(null);
    }
  };

  const emailNow = async () => {
    if (actionPending) return;
    if (!validateConfig()) return;
    const parsedRecipients = recipientList(recipients);
    if (parsedRecipients.length === 0) {
      setError("Add at least one recipient before emailing this report.");
      return;
    }
    setActionPending("email");
    setBuildProgress(null);
    try {
      const config = await createPibBuilderConfig(buildConfigInput());
      const schedule = await createPibBuilderSchedule({
        config_id: config.id,
        cadence: "one_time",
        timezone: "America/Chicago",
        day_of_week: null,
        day_of_month: null,
        send_time: deliveryTime,
        recipients: parsedRecipients,
        status: "paused",
      });
      let run = await runPibBuilderScheduleNow(schedule.id);
      if (run.delivery_status === "canonical_pib_artifact_missing") {
        setNotice("Preparing the PIB report.");
        setActionPending("generate");
        setBuildProgress({
          step: "queued",
          percent: 10,
          title: "Queued",
          detail: "The report request has been sent to the PIB worker.",
        });
        const job = await createPibBuilderGenerationJob(config.id, {
          requested_action: "email_now",
          recipients: parsedRecipients,
          run_id: run.id,
        });
        const finishedJob = await waitForGenerationJob(job.id, setBuildProgress);
        if (finishedJob.status === "succeeded") {
          setActionPending("email");
          setBuildProgress({
            step: "sending",
            percent: 88,
            title: "Sending email",
            detail: "The finished PIB is being emailed to the selected recipients.",
          });
          run = await runPibBuilderScheduleNow(schedule.id);
        } else if (finishedJob.status === "failed") {
          throw new Error(finishedJob.error_text ?? "PIB report build failed.");
        } else {
          setConfigs((current) => [config, ...current.filter((item) => item.id !== config.id)]);
          setSchedules((current) => [schedule, ...current.filter((item) => item.id !== schedule.id)]);
          setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
          setNotice("The report is still building. You can try Email Now again in a moment.");
          return;
        }
      }
      await updatePibBuilderSchedule(schedule.id, { status: "archived" });
      setConfigs((current) => [config, ...current.filter((item) => item.id !== config.id)]);
      setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      if (run.run_status === "sent") {
        setDeliveredConfigId(config.id);
        setDeliveredReportUrl(artifactUrl());
        setReportName(config.report_name);
        setBuildProgress({
          step: "complete",
          percent: 100,
          title: "Email sent",
          detail: "The PIB was sent successfully.",
        });
        setNotice("PIB email sent.");
      } else if (run.run_status === "failed") {
        setError(run.delivery_error ? `PIB email failed: ${run.delivery_error}` : "PIB email failed.");
      } else {
        setNotice(run.delivery_error ? `PIB email queued but blocked: ${run.delivery_error}` : "PIB email request recorded.");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to send this PIB email.");
    } finally {
      setActionPending(null);
      window.setTimeout(() => setBuildProgress(null), 3_000);
    }
  };

  const actionButtonText = actionPending === "email"
    ? "Sending..."
    : actionPending === "generate"
      ? "Building report..."
    : actionPending === "schedule"
      ? "Scheduling..."
      : actionPending === "save"
        ? "Saving..."
        : deliveryMode === "open"
          ? "Open Report Now"
          : deliveryMode === "email_now"
            ? "Email Now"
            : "Choose Output";

  const saveDeliveredReportName = async () => {
    if (!deliveredConfigId || actionPending) return;
    setActionPending("save");
    try {
      const config = await updatePibBuilderConfig(deliveredConfigId, { report_name: reportDisplayName() });
      setConfigs((current) => [config, ...current.filter((item) => item.id !== config.id)]);
      setNotice("Report name saved.");
    } catch {
      setError("Unable to save this report name.");
    } finally {
      setActionPending(null);
    }
  };

  const scheduleDeliveredReport = async () => {
    if (!deliveredConfigId || actionPending) return;
    const parsedRecipients = recipientList(recipients);
    if (parsedRecipients.length === 0) {
      setError("Add at least one recipient before scheduling this report.");
      return;
    }
    setActionPending("schedule");
    try {
      const schedule = await createPibBuilderSchedule({
        config_id: deliveredConfigId,
        cadence: cadence === "one_time" ? "weekly" : cadence,
        timezone: "America/Chicago",
        day_of_week: WEEKDAY_OPTIONS.find((day) => day.label === dayOfWeek)?.value ?? 1,
        day_of_month: dayOfMonth,
        send_time: deliveryTime,
        recipients: parsedRecipients,
        status: "active",
      });
      setSchedules((current) => [schedule, ...current.filter((item) => item.id !== schedule.id)]);
      setNotice("Email schedule saved.");
      setActiveTab("scheduled");
    } catch {
      setError("Unable to schedule this PIB report.");
    } finally {
      setActionPending(null);
    }
  };

  const openPib = async () => {
    if (actionPending) return;
    setError(null);
    if (!validateConfig()) return;
    if (!communityId || !selectedCommunity?.name) {
      setError("Select a property before opening the PIB report.");
      return;
    }
    const url = artifactUrl();
    setActionPending("generate");
    setBuildProgress(null);
    try {
      const config = await createPibBuilderConfig(buildConfigInput());
      setConfigs((current) => [config, ...current.filter((item) => item.id !== config.id)]);
      const probe = await fetch(url, { credentials: "include" });
      if (!probe.ok) {
        setNotice("Preparing the PIB report.");
        setBuildProgress({
          step: "queued",
          percent: 10,
          title: "Queued",
          detail: "The report request has been sent to the PIB worker.",
        });
        const job = await createPibBuilderGenerationJob(config.id, { requested_action: "open" });
        const finishedJob = await waitForGenerationJob(job.id, setBuildProgress);
        if (finishedJob.status !== "succeeded") {
          setNotice("The report is still building. Try Open Report Now again in a moment.");
          setActiveTab("library");
          return;
        }
      }
      setBuildProgress({
        step: "opening",
        percent: 90,
        title: "Opening report",
        detail: "The finished PIB is opening in a new tab.",
      });
      setDeliveredConfigId(config.id);
      setDeliveredReportUrl(url);
      setReportName(config.report_name);
      window.open(url, "_blank", "noopener,noreferrer");
      setBuildProgress({
        step: "complete",
        percent: 100,
        title: "Report opened",
        detail: "The PIB is ready.",
      });
      setNotice("PIB report opened.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to open the PIB report.");
    } finally {
      setActionPending(null);
      window.setTimeout(() => setBuildProgress(null), 3_000);
    }
  };

  const copyPath = async (path: string) => {
    await navigator.clipboard.writeText(path);
    setNotice("PIB path copied.");
  };

  const editRecord = (entry: SavedBuilderConfig) => {
    setReportName(entry.reportName);
    setScope(entry.scope);
    setCommunityId(entry.communityId);
    setDateRange(entry.dateRange);
    setPresetId(entry.presetLabel === "Custom" ? "custom" : PIB_PRESETS.find((preset) => preset.label === entry.presetLabel)?.id ?? "custom");
    setSelectedSectionIds(entry.selectedSectionIds);
    setDeliveryMode(null);
    setSaveWithSchedule(entry.recordType === "schedule");
    setCadence(entry.cadence);
    setDayOfWeek(entry.dayOfWeek);
    setDayOfMonth(entry.dayOfMonth);
    setDeliveryTime(entry.deliveryTime);
    setRecipients(entry.recipients);
    setBuilderStep(1);
    setActiveTab("create");
    setNotice(`Loaded ${entry.reportName} for editing.`);
  };

  const archiveRecord = async (entry: SavedBuilderConfig) => {
    try {
      if (entry.recordType === "schedule" && entry.scheduleId) {
        await updatePibBuilderSchedule(entry.scheduleId, { status: "archived" });
        setSchedules((current) => current.filter((schedule) => schedule.id !== entry.scheduleId));
      } else {
        await updatePibBuilderConfig(entry.configId, { status: "archived" });
        setConfigs((current) => current.filter((config) => config.id !== entry.configId));
        setSchedules((current) => current.filter((schedule) => schedule.config_id !== entry.configId));
      }
      setNotice("PIB Builder record archived.");
    } catch {
      setError("Unable to archive this PIB Builder record.");
    }
  };

  const toggleScheduleStatus = async (entry: SavedBuilderConfig) => {
    if (!entry.scheduleId || !entry.scheduleStatus) return;
    const nextStatus = entry.scheduleStatus === "active" ? "paused" : "active";
    try {
      const schedule = await updatePibBuilderSchedule(entry.scheduleId, { status: nextStatus });
      setSchedules((current) => [schedule, ...current.filter((item) => item.id !== schedule.id)]);
      setNotice(nextStatus === "active" ? "PIB schedule resumed." : "PIB schedule paused.");
    } catch {
      setError("Unable to update this PIB schedule.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F6F5] px-4 py-6 text-[#15284B] md:px-10">
      <div className="mx-auto max-w-[1280px] space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#D6D6D2] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#3B9189]">Reports</p>
            <h1 className="mt-2 text-3xl font-bold">PIB Report Builder</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#294782]">
              Build a property PIB, send it, then save the report name or schedule recurring delivery.
            </p>
          </div>

          {activeTab !== "home" && (
            <div className="flex w-fit flex-wrap rounded-lg border border-[#D6D6D2] bg-white p-1 shadow-sm">
              {[
                ["home", "Start"],
                ["create", "Build"],
                ["library", "Library"],
                ["scheduled", "Emails"],
                ["links", "Links"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id as BuilderTab)}
                  className={`h-9 cursor-pointer rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D66B9] focus-visible:ring-offset-2 ${
                    activeTab === id ? "bg-[#15284B] text-white" : "text-[#294782] hover:bg-[#F6F6F5] hover:text-[#15284B]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </header>

        {notice && (
          <div className="flex items-center gap-2 rounded-md border border-[#7DCAC2] bg-white px-4 py-3 text-sm text-[#15284B]">
            <CheckCircle2 className="h-4 w-4 text-[#3B9189]" />
            {notice}
          </div>
        )}

        {buildProgress && (
          <div className="rounded-md border border-[#D6D6D2] bg-white px-4 py-4 text-sm text-[#15284B] shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {buildProgress.step === "complete" ? (
                  <CheckCircle2 className="h-4 w-4 text-[#3B9189]" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-[#3B9189]" />
                )}
                <div>
                  <div className="font-semibold">{buildProgress.title}</div>
                  <div className="text-xs text-[#294782]">{buildProgress.detail}</div>
                </div>
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[#294782]">
                {buildProgress.percent}%
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F6F6F5]">
              <div
                className="h-full rounded-full bg-[#3B9189] transition-all duration-500"
                style={{ width: `${buildProgress.percent}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#9B9B96] md:grid-cols-5">
              {[
                ["queued", "Queued"],
                ["building", "Building"],
                ["publishing", "Publishing"],
                [deliveryMode === "open" ? "opening" : "sending", deliveryMode === "open" ? "Opening" : "Sending"],
                ["complete", "Complete"],
              ].map(([step, label]) => (
                <span
                  key={step}
                  className={buildProgress.step === step ? "text-[#15284B]" : undefined}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-[#E02472]/30 bg-white px-4 py-3 text-sm text-[#E02472]">{error}</div>
        )}

        {activeTab === "home" && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="border-[#D6D6D2] shadow-sm">
              <CardHeader className="border-b border-[#D6D6D2]">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-[#3B9189]" />
                  Create a Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <p className="text-sm leading-6 text-[#294782]">
                  Start with the basics, then choose what to include and how to use it.
                </p>
                <Button onClick={startNewReport} className="h-11 w-full bg-[#15284B] text-white hover:bg-[#294782]">
                  <FileText className="mr-2 h-4 w-4" />
                  Create New Report
                </Button>
                <div className="grid grid-cols-1 gap-2 border-t border-[#D6D6D2] pt-4 text-sm">
                  <button
                    type="button"
                    onClick={() => setActiveTab("scheduled")}
                    className="cursor-pointer rounded-md border border-[#D6D6D2] bg-white px-3 py-2 text-left font-semibold text-[#294782] transition-colors hover:border-[#3D66B9] hover:bg-[#F6F6F5] hover:text-[#15284B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D66B9] focus-visible:ring-offset-2"
                  >
                    View scheduled emails
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("links")}
                    className="cursor-pointer rounded-md border border-[#D6D6D2] bg-white px-3 py-2 text-left font-semibold text-[#294782] transition-colors hover:border-[#3D66B9] hover:bg-[#F6F6F5] hover:text-[#15284B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D66B9] focus-visible:ring-offset-2"
                  >
                    View saved links
                  </button>
                </div>
              </CardContent>
            </Card>

            <StartReportList
              configs={savedReports}
              loading={builderLoading}
              onCreate={startNewReport}
              onSelect={editRecord}
              onViewAll={() => setActiveTab("library")}
            />
          </div>
        )}

        {activeTab === "create" && (
          <div>
            <Card className="border-[#D6D6D2] shadow-sm">
              <CardHeader className="border-b border-[#D6D6D2]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-5 w-5 text-[#3B9189]" />
                    {builderStep === 1 && "What do you want?"}
                    {builderStep === 2 && "What should be included?"}
                    {builderStep === 3 && "How do you want it?"}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {[
                      [1, "Report"],
                      [2, "Includes"],
                      [3, "Output"],
                    ].map(([step, label]) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => setBuilderStep(step as BuilderStep)}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D66B9] focus-visible:ring-offset-2 ${
                          builderStep === step
                            ? "border-[#15284B] bg-[#15284B] text-white"
                            : "border-[#D6D6D2] bg-white text-[#294782] hover:border-[#3D66B9] hover:bg-[#F6F6F5] hover:text-[#15284B]"
                        }`}
                      >
                        {step}. {label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-5">
                {loading ? (
                  <div className="flex items-center gap-2 text-[#294782]">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading properties...
                  </div>
                ) : (
                  <>
                    {builderStep === 1 && (
                      <>
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-[#294782]">Property</label>
                            <select
                              value={communityId}
                              onChange={(event) => setCommunityId(event.target.value)}
                              className="mt-2 h-11 w-full rounded-md border border-[#D6D6D2] bg-white px-3 text-sm text-[#15284B] shadow-sm outline-none focus:border-[#3D66B9]"
                            >
                              <option value="">Select a property</option>
                              {communities.map((community) => (
                                <option key={community.id} value={community.id}>
                                  {community.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-[#294782]">Date Range</label>
                            <select
                              value={dateRange}
                              onChange={(event) => setDateRange(event.target.value)}
                              className="mt-2 h-11 w-full rounded-md border border-[#D6D6D2] bg-white px-3 text-sm text-[#15284B] shadow-sm outline-none focus:border-[#3D66B9]"
                            >
                              {DATE_RANGES.map((range) => (
                                <option key={range} value={range}>
                                  {range}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex justify-end border-t border-[#D6D6D2] pt-5">
                          <Button
                            onClick={() => {
                              if (validateBasics()) setBuilderStep(2);
                            }}
                            className="h-10 cursor-pointer bg-[#15284B] text-white hover:bg-[#294782]"
                          >
                            Choose Included Sections
                          </Button>
                        </div>
                      </>
                    )}

                    {builderStep === 2 && (
                      <>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-[#294782]">Preset</label>
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-5">
                        {PIB_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setPreset(preset.id)}
                            className={`min-h-12 cursor-pointer rounded-md border px-3 py-2 text-left text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D66B9] focus-visible:ring-offset-2 ${
                              presetId === preset.id
                                ? "border-[#15284B] bg-[#15284B] text-white shadow-md"
                                : "border-[#D6D6D2] bg-white text-[#294782] hover:-translate-y-0.5 hover:border-[#3D66B9] hover:shadow-md"
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-base font-bold">Report Areas</h2>
                          <p className="text-xs text-[#294782]">
                            {sectionCount(selectedSectionIds)} optional areas selected; {requiredSectionIds.length} governance
                            areas stay locked on.
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-full border border-[#7DCAC2] bg-white px-3 py-1 text-xs font-semibold text-[#294782]">
                          <ShieldCheck className="h-4 w-4 text-[#3B9189]" />
                          Approved PIB sections
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {SECTION_GROUPS.map((group) => (
                          <section key={group} className="rounded-md border border-[#D6D6D2] bg-white p-4">
                            <h3 className="text-sm font-bold">{group}</h3>
                            <div className="mt-3 space-y-2">
                              {PIB_SECTIONS.filter((section) => section.group === group).map((section) => {
                                const checked = selectedSectionIds.includes(section.id);
                                return (
                                  <label
                                    key={section.id}
                                      className={`flex min-h-12 items-start gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
                                      section.selectable ? "cursor-pointer border-[#D6D6D2] hover:border-[#3D66B9] hover:bg-[#F6F6F5]" : "border-[#7DCAC2] bg-[#F6F6F5]"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={!section.selectable}
                                      onChange={() => toggleSection(section.id)}
                                      className="mt-1 h-4 w-4 accent-[#15284B]"
                                    />
                                    <span className="min-w-0">
                                      <span className="block font-semibold text-[#15284B]">{section.label}</span>
                                      <span className="block text-xs text-[#294782]">{section.sourceAuthority}</span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-between gap-3 border-t border-[#D6D6D2] pt-5">
                      <Button variant="outline" onClick={() => setBuilderStep(1)} className="h-10 cursor-pointer border-[#D6D6D2] hover:border-[#3D66B9] hover:bg-[#F6F6F5]">
                        Back
                      </Button>
                      <Button
                        onClick={() => {
                          setError(null);
                          if (sectionCount(selectedSectionIds) === 0) {
                            setError("Select at least one report area before continuing.");
                            return;
                          }
                          setBuilderStep(3);
                        }}
                        className="h-10 cursor-pointer bg-[#15284B] text-white hover:bg-[#294782]"
                      >
                        Choose Output
                      </Button>
                    </div>
                      </>
                    )}

                    {builderStep === 3 && (
                      <>
                        <div>
                          <h2 className="text-base font-bold">Choose an output</h2>
                          <p className="mt-1 text-xs text-[#294782]">
                            Pick what should happen with this report.
                          </p>
                          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {[
                              { id: "email_now", label: "Email Now", detail: "Send this report by email.", icon: Mail },
                              { id: "open", label: "Open Report Now", detail: "Open this report now.", icon: ExternalLink },
                            ].map((item) => {
                              const Icon = item.icon;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  disabled={Boolean(actionPending)}
                                  onClick={() => {
                                    setDeliveryMode(item.id as DeliveryMode);
                                  }}
                                  className={`min-h-28 cursor-pointer rounded-md border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D66B9] focus-visible:ring-offset-2 ${
                                    deliveryMode === item.id
                                      ? "border-[#15284B] bg-[#15284B] text-white shadow-md"
                                      : "border-[#D6D6D2] bg-white text-[#15284B] hover:-translate-y-0.5 hover:border-[#3D66B9] hover:shadow-md"
                                  } disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                  <Icon className={`h-5 w-5 ${deliveryMode === item.id ? "text-white" : "text-[#3B9189]"}`} />
                                  <span className="mt-3 block text-sm font-bold">{item.label}</span>
                                  <span className={`mt-1 block text-xs ${deliveryMode === item.id ? "text-white/80" : "text-[#294782]"}`}>
                                    {item.detail}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {deliveryMode === "email_now" && (
                          <div className="border-t border-[#D6D6D2] pt-6">
                            <label className="text-xs font-semibold uppercase tracking-wide text-[#294782]">Recipients</label>
                            <input
                              value={recipients}
                              onChange={(event) => setRecipients(event.target.value)}
                              placeholder="name@venterra.com"
                              className="mt-2 h-10 w-full max-w-2xl rounded-md border border-[#D6D6D2] bg-white px-3 text-sm outline-none placeholder:text-[#9B9B96] focus:border-[#3D66B9]"
                            />
                          </div>
                        )}

                        {deliveredReportUrl && deliveredConfigId && (
                          <div className="space-y-5 border-t border-[#D6D6D2] pt-6">
                            <div className="rounded-md border border-[#D6D6D2] bg-white">
                              <div className="border-b border-[#D6D6D2] p-4">
                                <h2 className="text-base font-bold">Report Ready</h2>
                              </div>
                              <div className="space-y-4 p-4">
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                                  <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide text-[#294782]">Report Name</label>
                                    <input
                                      value={reportName}
                                      onChange={(event) => setReportName(event.target.value)}
                                      className="mt-2 h-10 w-full rounded-md border border-[#D6D6D2] bg-white px-3 text-sm text-[#15284B] outline-none focus:border-[#3D66B9]"
                                    />
                                  </div>
                                  <div className="flex items-end gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      disabled={Boolean(actionPending)}
                                      onClick={() => void saveDeliveredReportName()}
                                      className="h-10 cursor-pointer border-[#D6D6D2] hover:border-[#3D66B9] hover:bg-[#F6F6F5]"
                                    >
                                      <Save className="mr-2 h-4 w-4" />
                                      Save Name
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={() => window.open(deliveredReportUrl, "_blank", "noopener,noreferrer")}
                                      className="h-10 cursor-pointer bg-[#3B9189] text-white hover:bg-[#2f746e]"
                                    >
                                      <ExternalLink className="mr-2 h-4 w-4" />
                                      Open
                                    </Button>
                                  </div>
                                </div>

                                <div className="rounded-md border border-[#D6D6D2] p-4">
                                  <h3 className="text-sm font-bold">Schedule Future Emails</h3>
                                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                              <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-[#294782]">Cadence</label>
                                <select
                                  value={cadence}
                                  onChange={(event) => setCadence(event.target.value as Cadence)}
                                  className="mt-2 h-10 w-full rounded-md border border-[#D6D6D2] bg-white px-3 text-sm outline-none focus:border-[#3D66B9]"
                                >
                                  <option value="weekly">Weekly</option>
                                  <option value="monthly">Monthly</option>
                                  <option value="quarterly">Quarterly</option>
                                </select>
                              </div>

                              {cadence === "weekly" ? (
                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wide text-[#294782]">Send Day</label>
                                  <select
                                    value={dayOfWeek}
                                    onChange={(event) => setDayOfWeek(event.target.value)}
                                    className="mt-2 h-10 w-full rounded-md border border-[#D6D6D2] bg-white px-3 text-sm outline-none focus:border-[#3D66B9]"
                                  >
                                    {WEEKDAY_OPTIONS.map((day) => (
                                      <option key={day.value} value={day.label}>
                                        {day.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wide text-[#294782]">Send Date</label>
                                  <select
                                    value={dayOfMonth}
                                    onChange={(event) => setDayOfMonth(event.target.value)}
                                    className="mt-2 h-10 w-full rounded-md border border-[#D6D6D2] bg-white px-3 text-sm outline-none focus:border-[#3D66B9]"
                                  >
                                    {MONTH_DAYS.map((day) => (
                                      <option key={day.value} value={day.value}>
                                        {day.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-[#294782]">Send Time</label>
                                <input
                                  type="time"
                                  value={deliveryTime}
                                  onChange={(event) => setDeliveryTime(event.target.value)}
                                  className="mt-2 h-10 w-full rounded-md border border-[#D6D6D2] bg-white px-3 text-sm outline-none focus:border-[#3D66B9]"
                                />
                              </div>

                              <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-[#294782]">Recipients</label>
                                <input
                                  value={recipients}
                                  onChange={(event) => setRecipients(event.target.value)}
                                  placeholder="name@venterra.com"
                                  className="mt-2 h-10 w-full rounded-md border border-[#D6D6D2] bg-white px-3 text-sm outline-none placeholder:text-[#9B9B96] focus:border-[#3D66B9]"
                                />
                              </div>
                                  </div>
                                  <div className="mt-4 flex justify-end">
                                    <Button
                                      type="button"
                                      disabled={Boolean(actionPending)}
                                      onClick={() => void scheduleDeliveredReport()}
                                      className="h-10 cursor-pointer bg-[#15284B] text-white hover:bg-[#294782] disabled:cursor-not-allowed disabled:bg-[#9B9B96]"
                                    >
                                      <CalendarClock className="mr-2 h-4 w-4" />
                                      Save Schedule
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <iframe
                              title="PIB report preview"
                              src={deliveredReportUrl}
                              className="h-[720px] w-full rounded-md border border-[#D6D6D2] bg-white"
                            />
                          </div>
                        )}

                        <div className="flex flex-wrap justify-between gap-3 border-t border-[#D6D6D2] pt-5">
                          <Button
                            variant="outline"
                            onClick={() => setBuilderStep(2)}
                            disabled={Boolean(actionPending)}
                            className="h-10 cursor-pointer border-[#D6D6D2] hover:border-[#3D66B9] hover:bg-[#F6F6F5]"
                          >
                            Back
                          </Button>
                          <Button
                            disabled={Boolean(actionPending) || !deliveryMode}
                            aria-busy={Boolean(actionPending)}
                            onClick={() => {
                              if (deliveryMode === "open") void openPib();
                              if (deliveryMode === "email_now") void emailNow();
                            }}
                            className="h-10 min-w-44 cursor-pointer bg-[#15284B] text-white hover:bg-[#294782] disabled:cursor-not-allowed disabled:bg-[#9B9B96] disabled:text-white disabled:shadow-none"
                          >
                            {actionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {actionButtonText}
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "library" && (
          <SavedConfigList
            configs={savedReports}
            emptyText="No saved PIB reports yet."
            icon={<FileText className="h-5 w-5 text-[#3B9189]" />}
            onCopy={copyPath}
            onEdit={editRecord}
            onArchive={archiveRecord}
            title="Report Library"
          />
        )}

        {activeTab === "scheduled" && (
          <SavedConfigList
            configs={scheduledReports}
            emptyText="No scheduled PIB emails yet."
            icon={<CalendarClock className="h-5 w-5 text-[#3B9189]" />}
            onCopy={copyPath}
            onEdit={editRecord}
            onArchive={archiveRecord}
            onToggleSchedule={toggleScheduleStatus}
          />
        )}

        {activeTab === "links" && (
          <SavedConfigList
            configs={reportLinks}
            emptyText="No saved PIB links yet."
            icon={<Link2 className="h-5 w-5 text-[#3B9189]" />}
            onCopy={copyPath}
            onEdit={editRecord}
            onArchive={archiveRecord}
          />
        )}

      </div>
    </div>
  );
}

function StartReportList({
  configs,
  loading,
  onCreate,
  onSelect,
  onViewAll,
}: {
  configs: SavedBuilderConfig[];
  loading: boolean;
  onCreate: () => void;
  onSelect: (config: SavedBuilderConfig) => void;
  onViewAll: () => void;
}) {
  const visibleReports = configs.slice(0, 8);

  return (
    <Card className="border-[#D6D6D2] shadow-sm">
      <CardHeader className="border-b border-[#D6D6D2]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Save className="h-5 w-5 text-[#3B9189]" />
            Saved Reports
          </CardTitle>
          {configs.length > 0 && (
            <button type="button" onClick={onViewAll} className="text-sm font-semibold text-[#294782] hover:text-[#15284B]">
              View all
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {loading ? (
          <div className="flex items-center gap-2 rounded-md border border-[#D6D6D2] bg-white p-5 text-sm text-[#294782]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading saved reports...
          </div>
        ) : visibleReports.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#D6D6D2] bg-white p-8 text-center">
            <p className="text-sm font-semibold text-[#15284B]">No saved PIB reports yet.</p>
            <p className="mt-1 text-sm text-[#294782]">Create your first report, then it will appear here.</p>
            <Button onClick={onCreate} className="mt-4 h-10 bg-[#15284B] text-white hover:bg-[#294782]">
              Create New Report
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[#D6D6D2] rounded-md border border-[#D6D6D2] bg-white">
            {visibleReports.map((config) => (
              <button
                key={config.id}
                type="button"
                onClick={() => onSelect(config)}
                className="flex w-full flex-col gap-2 px-4 py-4 text-left transition-colors hover:bg-[#F6F6F5] md:flex-row md:items-center md:justify-between"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[#15284B]">{config.reportName}</span>
                  <span className="mt-1 block text-xs text-[#294782]">
                    {config.communityName} · {config.presetLabel} · {sectionCount(config.selectedSectionIds)} areas
                  </span>
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-[#3B9189]">Open builder</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SavedConfigList({
  configs,
  emptyText,
  icon,
  onCopy,
  onEdit,
  onArchive,
  onToggleSchedule,
  title,
}: {
  configs: SavedBuilderConfig[];
  emptyText: string;
  icon: React.ReactNode;
  onCopy: (path: string) => void;
  onEdit: (config: SavedBuilderConfig) => void;
  onArchive: (config: SavedBuilderConfig) => void;
  onToggleSchedule?: (config: SavedBuilderConfig) => void;
  title?: string;
}) {
  return (
    <Card className="border-[#D6D6D2] shadow-sm">
      <CardHeader className="border-b border-[#D6D6D2]">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title ?? "Saved PIB Requests"}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        {configs.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#D6D6D2] bg-white p-8 text-center text-sm text-[#294782]">
            {emptyText}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {configs.map((config) => (
              <article key={config.id} className="rounded-md border border-[#D6D6D2] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-[#15284B]">{config.reportName}</h2>
                    <p className="mt-1 text-xs text-[#294782]">{config.communityName}</p>
                  </div>
                  <span className="rounded-full border border-[#7DCAC2] px-2 py-1 text-xs font-semibold capitalize text-[#294782]">
                    {config.scheduleStatus ?? config.status}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-[#9B9B96]">Preset</dt>
                    <dd className="mt-1 text-[#15284B]">{config.presetLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-[#9B9B96]">Areas</dt>
                    <dd className="mt-1 text-[#15284B]">{sectionCount(config.selectedSectionIds)} selected</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-[#9B9B96]">Window</dt>
                    <dd className="mt-1 text-[#15284B]">{config.dateRange}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-[#9B9B96]">Cadence</dt>
                    <dd className="mt-1 text-[#15284B]">{formatCadence(config)}</dd>
                  </div>
                </dl>

                {config.nextRunAt && (
                  <p className="mt-3 text-xs text-[#294782]">
                    <CalendarClock className="mr-1 inline h-3.5 w-3.5" />
                    Next run: {new Date(config.nextRunAt).toLocaleString()}
                    {config.lastRunStatus ? ` · Last: ${config.lastRunStatus}` : ""}
                  </p>
                )}

                {config.recipients && (
                  <p className="mt-3 truncate text-xs text-[#294782]">
                    <Mail className="mr-1 inline h-3.5 w-3.5" />
                    {config.recipients}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCopy(config.linkPath)}
                    className="border-[#D6D6D2]"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Path
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(config)}
                    className="border-[#D6D6D2]"
                  >
                    Edit
                  </Button>
                  {config.recordType === "schedule" && onToggleSchedule && config.scheduleStatus !== "archived" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onToggleSchedule(config)}
                      className="border-[#D6D6D2]"
                    >
                      {config.scheduleStatus === "active" ? "Pause" : "Resume"}
                    </Button>
                  )}
                  <a
                    href={config.linkPath}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-[#D6D6D2] bg-white px-3 text-sm font-medium text-[#15284B] shadow-sm transition-colors hover:bg-[#F6F6F5]"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Open
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onArchive(config)}
                    className="border-[#D6D6D2] text-[#BD4830]"
                  >
                    Archive
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
