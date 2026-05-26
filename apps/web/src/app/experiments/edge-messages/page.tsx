"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { canPerformOfferingAction, getOfferingActionRole, getRoleTitle } from "@/lib/permissions";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  Gauge,
  Megaphone,
  MousePointer2,
  Palette,
  PauseCircle,
  RotateCcw,
  Rocket,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  X,
} from "lucide-react";

type MessageShape = "modal_notice" | "anchored_coachmark" | "top_banner" | "bottom_toast" | "inline_callout";
type TriggerMode = "page_idle" | "element_in_view" | "scroll_depth";
type Placement = "center" | "target_above" | "top" | "bottom_right" | "inline_after";

type EdgeMessageDraft = {
  id: string;
  name: string;
  status: "active_testing" | "draft" | "paused";
  shape: MessageShape;
  propertyName: string;
  propertyCode: string;
  communityId: string;
  hostname: string;
  path: string;
  targetText: string;
  title: string;
  body: string;
  disclaimer: string;
  brandColor: string;
  accentColor: string;
  titleColor: string;
  bodyColor: string;
  disclaimerColor: string;
  surfaceTextColor: string;
  propertyNameFontSize: number;
  titleFontSize: number;
  bodyFontSize: number;
  disclaimerFontSize: number;
  countdownFontSize: number;
  placement: Placement;
  triggerMode: TriggerMode;
  scrollDepth: number;
  showDelayMs: number;
  durationMs: number;
  fadeMs: number;
  frequencyCapSeconds: number;
  ignoreFrequencyCap: boolean;
  decoration: "none" | "badge" | "pulse_badge";
  benchmark: string;
};

const LIVE_MESSAGES: EdgeMessageDraft[] = [
  {
    id: "edge_transparent_pricing_intro_homepage_v1",
    name: "Transparent Pricing Homepage Intro",
    status: "active_testing",
    shape: "modal_notice",
    propertyName: "Apex West Midtown",
    propertyCode: "GA4AX",
    communityId: "eed3da54-7b7a-4dae-984b-a203113fc2f3",
    hostname: "pilot.venterradev.com",
    path: "/",
    targetText: "",
    title: "Say hello to clearer\nmonthly pricing",
    body: "See base rent plus required monthly fees together, so your estimated monthly cost is easier to understand.",
    disclaimer: "Required monthly fees exclude variable fees and optional services.",
    brandColor: "#15284B",
    accentColor: "#7DCAC2",
    titleColor: "#000000",
    bodyColor: "#294782",
    disclaimerColor: "#9B9B96",
    surfaceTextColor: "#FFFFFF",
    propertyNameFontSize: 18,
    titleFontSize: 44,
    bodyFontSize: 24,
    disclaimerFontSize: 16,
    countdownFontSize: 20,
    placement: "center",
    triggerMode: "page_idle",
    scrollDepth: 0,
    showDelayMs: 800,
    durationMs: 7000,
    fadeMs: 360,
    frequencyCapSeconds: 86400,
    ignoreFrequencyCap: true,
    decoration: "none",
    benchmark: "+4.2 KB transfer, no external requests",
  },
  {
    id: "edge_message_all_in_pricing_coachmark_v1",
    name: "All-In Pricing Button Coach Mark",
    status: "active_testing",
    shape: "anchored_coachmark",
    propertyName: "Apex West Midtown",
    propertyCode: "GA4AX",
    communityId: "eed3da54-7b7a-4dae-984b-a203113fc2f3",
    hostname: "pilot.venterradev.com",
    path: "/apartments/",
    targetText: "All-In Price & Details",
    title: "All-in pricing",
    body: "See rent plus required monthly fees together before you choose a home.",
    disclaimer: "",
    brandColor: "#3D66B9",
    accentColor: "#7DCAC2",
    titleColor: "#FFFFFF",
    bodyColor: "#FFFFFF",
    disclaimerColor: "#F6F6F5",
    surfaceTextColor: "#FFFFFF",
    propertyNameFontSize: 14,
    titleFontSize: 14,
    bodyFontSize: 13,
    disclaimerFontSize: 13,
    countdownFontSize: 14,
    placement: "target_above",
    triggerMode: "element_in_view",
    scrollDepth: 0,
    showDelayMs: 300,
    durationMs: 9000,
    fadeMs: 260,
    frequencyCapSeconds: 86400,
    ignoreFrequencyCap: true,
    decoration: "pulse_badge",
    benchmark: "47 visible unit rows retained",
  },
];

const SHAPE_OPTIONS: Array<{ value: MessageShape; label: string; icon: React.ElementType }> = [
  { value: "modal_notice", label: "Modal notice", icon: Megaphone },
  { value: "anchored_coachmark", label: "Coach mark", icon: MousePointer2 },
  { value: "top_banner", label: "Top banner", icon: Bell },
  { value: "bottom_toast", label: "Bottom toast", icon: Sparkles },
  { value: "inline_callout", label: "Inline callout", icon: SlidersHorizontal },
];

const DELIVERY_OPTIONS: Array<{ value: TriggerMode; label: string }> = [
  { value: "page_idle", label: "Page idle" },
  { value: "element_in_view", label: "Element in view" },
  { value: "scroll_depth", label: "Scroll depth" },
];

const PLACEMENT_OPTIONS: Array<{ value: Placement; label: string }> = [
  { value: "center", label: "Center" },
  { value: "target_above", label: "Target above" },
  { value: "top", label: "Top" },
  { value: "bottom_right", label: "Bottom right" },
  { value: "inline_after", label: "Inline after" },
];

const CORPORATE_COLOR_SWATCHES = [
  { label: "Venterra Navy", value: "#15284B" },
  { label: "San Marino", value: "#3D66B9" },
  { label: "Bay", value: "#294782" },
  { label: "Indigo", value: "#5A81CF" },
  { label: "Monte Carlo", value: "#7DCAC2" },
  { label: "Pink", value: "#E02472" },
  { label: "White Smoke", value: "#F6F6F5" },
  { label: "Terra Cotta", value: "#BD4830" },
  { label: "Quill Gray", value: "#D6D6D2" },
  { label: "Blue Chill", value: "#3B9189" },
  { label: "Delta", value: "#9B9B96" },
  { label: "Black", value: "#000000" },
  { label: "White", value: "#FFFFFF" },
];

const DRAFT_STORAGE_PREFIX = "edge_message_admin_draft:";
const PREVIEW_HERO_IMAGE = "https://dam.getresi.co/18515/conversions/Home-Hero-full.jpg";
const APARTMENTS_PREVIEW_IMAGE = "/edge-message-apartments-preview.png";

function draftStorageKey(id: string): string {
  return `${DRAFT_STORAGE_PREFIX}${id}`;
}

function draftFingerprint(draft: EdgeMessageDraft): string {
  return JSON.stringify(draft);
}

function clampNumber(value: unknown, min: number, max: number): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeDraft(draft: EdgeMessageDraft): EdgeMessageDraft {
  if (draft.shape !== "anchored_coachmark") return draft;
  return {
    ...draft,
    titleFontSize: clampNumber(draft.titleFontSize, 12, 26),
    bodyFontSize: clampNumber(draft.bodyFontSize, 12, 26),
  };
}

function hydrateSavedDraft(message: EdgeMessageDraft): EdgeMessageDraft {
  try {
    const savedDraft = window.localStorage.getItem(draftStorageKey(message.id));
    if (!savedDraft) return message;
    const parsed = JSON.parse(savedDraft) as Partial<EdgeMessageDraft>;
    return normalizeDraft({ ...message, ...parsed, id: message.id });
  } catch {
    return message;
  }
}

function formatShape(shape: MessageShape): string {
  return SHAPE_OPTIONS.find((option) => option.value === shape)?.label ?? shape;
}

function statusTone(status: EdgeMessageDraft["status"]): string {
  if (status === "active_testing") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "paused") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function seconds(ms: number): string {
  return `${Math.round(ms / 100) / 10}s`;
}

export default function EdgeMessagesPage() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = React.useState(LIVE_MESSAGES[0].id);
  const [draft, setDraft] = React.useState<EdgeMessageDraft>(LIVE_MESSAGES[0]);
  const [savedFingerprint, setSavedFingerprint] = React.useState(draftFingerprint(LIVE_MESSAGES[0]));
  const [saveState, setSaveState] = React.useState<"idle" | "publishing" | "published" | "error">("idle");
  const canAdminister = canPerformOfferingAction(user?.role, "experiments", "administer");
  const administerRoleTitle = getRoleTitle(getOfferingActionRole("experiments", "administer"));

  React.useEffect(() => {
    const selectedMessage = LIVE_MESSAGES.find((message) => message.id === selectedId) ?? LIVE_MESSAGES[0];
    const savedDraft = hydrateSavedDraft(selectedMessage);
    setDraft(savedDraft);
    setSavedFingerprint(draftFingerprint(savedDraft));
    setSaveState("idle");
  }, [selectedId]);

  function selectMessage(message: EdgeMessageDraft) {
    setSelectedId(message.id);
  }

  function update<K extends keyof EdgeMessageDraft>(key: K, value: EdgeMessageDraft[K]) {
    setSaveState("idle");
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveDraft() {
    setSaveState("publishing");
    try {
      const fingerprint = draftFingerprint(draft);
      window.localStorage.setItem(draftStorageKey(draft.id), fingerprint);
      const response = await apiFetch(`/v1/experiments/edge-messages/${draft.id}/live-config`, {
        method: "POST",
        body: fingerprint,
      });
      if (!response.ok) throw new Error(`Publish failed with ${response.status}`);
      setSavedFingerprint(fingerprint);
      setSaveState("published");
    } catch {
      setSaveState("error");
    }
  }

  function restoreDefaultDraft() {
    const selectedMessage = LIVE_MESSAGES.find((message) => message.id === selectedId) ?? LIVE_MESSAGES[0];
    try {
      window.localStorage.removeItem(draftStorageKey(selectedMessage.id));
    } catch {
      setSaveState("error");
    }
    setDraft(selectedMessage);
    setSavedFingerprint(draftFingerprint(selectedMessage));
    setSaveState("idle");
  }

  const activeMessage = LIVE_MESSAGES.find((message) => message.id === selectedId) ?? LIVE_MESSAGES[0];
  const hasUnsavedChanges = draftFingerprint(draft) !== savedFingerprint;
  const shapeIcon = SHAPE_OPTIONS.find((option) => option.value === draft.shape)?.icon ?? Megaphone;
  const ShapeIcon = shapeIcon;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/experiments" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#15284B] hover:text-[#0f1e39]">
              <ArrowLeft className="h-4 w-4" />
              Experiment Lab
            </Link>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#15284B] text-white">
                <Megaphone className="h-4 w-4" />
              </span>
              <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-800">Edge Message Toolkit</Badge>
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Config-driven beta</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950">Edge Messages</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Govern lightweight site messages from the Pond, including modal notices, coach marks, banners, toasts, and inline callouts. Saving now publishes active config to the live Worker through the governed D1 registry.
            </p>
          </div>
          <div className="space-y-3 lg:min-w-[430px]">
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button type="button" onClick={saveDraft} disabled={!canAdminister || saveState === "publishing"}>
                <Save className="mr-2 h-4 w-4" />
                {saveState === "publishing" ? "Publishing" : "Save & Publish"}
              </Button>
              <Button type="button" variant="outline" onClick={restoreDefaultDraft} disabled={!canAdminister}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Badge
                variant="outline"
                className={
                  saveState === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : saveState === "published"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : hasUnsavedChanges
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }
              >
                {saveState === "error" ? "Publish failed" : saveState === "publishing" ? "Publishing live" : saveState === "published" ? "Published live" : hasUnsavedChanges ? "Unsaved changes" : "Live draft saved"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricTile label="Live proofs" value={LIVE_MESSAGES.length} />
              <MetricTile label="Routes" value={2} />
              <MetricTile label="External JS" value={0} />
              <MetricTile label="Errors" value={0} />
            </div>
          </div>
        </div>

        {!canAdminister && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Editing and launch controls require {administerRoleTitle}. Preview remains visible for review.
          </div>
        )}

        <section className="mb-6 grid gap-4 lg:grid-cols-2">
          {LIVE_MESSAGES.map((message) => {
            const Icon = SHAPE_OPTIONS.find((option) => option.value === message.shape)?.icon ?? Megaphone;
            const selected = message.id === selectedId;
            return (
              <button
                key={message.id}
                type="button"
                onClick={() => selectMessage(message)}
                className={`rounded-lg border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  selected ? "border-[#15284B] ring-2 ring-[#15284B]/12" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#15284B] text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  <Badge variant="outline" className={statusTone(message.status)}>
                    {message.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <h2 className="mt-4 text-base font-semibold text-slate-950">{message.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{message.hostname}{message.path}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                  <span className="rounded-md bg-slate-100 px-2 py-1">{formatShape(message.shape)}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-1">{message.ignoreFrequencyCap ? "Every reload" : "Frequency capped"}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-1">{message.benchmark}</span>
                </div>
              </button>
            );
          })}
        </section>

        <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
          <section className="space-y-5">
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-950">Message Content</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{draft.propertyName} / {draft.propertyCode}</p>
                  </div>
                  <ShapeIcon className="h-5 w-5 text-[#15284B]" />
                </div>
                <div className="space-y-4">
                  <Field label="Name">
                    <Input value={draft.name} onChange={(event) => update("name", event.target.value)} disabled={!canAdminister} />
                  </Field>
                  <Field label="Title">
                    <Textarea value={draft.title} onChange={(event) => update("title", event.target.value)} disabled={!canAdminister} rows={3} />
                  </Field>
                  <Field label="Body">
                    <Textarea value={draft.body} onChange={(event) => update("body", event.target.value)} disabled={!canAdminister} rows={4} />
                  </Field>
                  <Field label="Disclaimer">
                    <Textarea value={draft.disclaimer} onChange={(event) => update("disclaimer", event.target.value)} disabled={!canAdminister} rows={2} />
                  </Field>
                  <Field label="Target text">
                    <Input value={draft.targetText} onChange={(event) => update("targetText", event.target.value)} disabled={!canAdminister} placeholder="Button or anchor text" />
                  </Field>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Palette className="h-4 w-4 text-[#15284B]" />
                  <h2 className="text-base font-semibold text-slate-950">Style</h2>
                </div>
                <div className="space-y-4">
                  <Field label="Shape">
                    <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900" value={draft.shape} onChange={(event) => update("shape", event.target.value as MessageShape)} disabled={!canAdminister}>
                      {SHAPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Brand color">
                      <ColorInput value={draft.brandColor} onChange={(value) => update("brandColor", value)} disabled={!canAdminister} />
                    </Field>
                    <Field label="Accent color">
                      <ColorInput value={draft.accentColor} onChange={(value) => update("accentColor", value)} disabled={!canAdminister} />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Title text">
                      <ColorInput value={draft.titleColor} onChange={(value) => update("titleColor", value)} disabled={!canAdminister} />
                    </Field>
                    <Field label="Body text">
                      <ColorInput value={draft.bodyColor} onChange={(value) => update("bodyColor", value)} disabled={!canAdminister} />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Fine print">
                      <ColorInput value={draft.disclaimerColor} onChange={(value) => update("disclaimerColor", value)} disabled={!canAdminister} />
                    </Field>
                    <Field label="On-color text">
                      <ColorInput value={draft.surfaceTextColor} onChange={(value) => update("surfaceTextColor", value)} disabled={!canAdminister} />
                    </Field>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Type size</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FontSizeStepper label="Property" value={draft.propertyNameFontSize} min={10} max={30} disabled={!canAdminister} onChange={(value) => update("propertyNameFontSize", value)} />
                      <FontSizeStepper label="Title" value={draft.titleFontSize} min={12} max={draft.shape === "anchored_coachmark" ? 26 : 64} disabled={!canAdminister} onChange={(value) => update("titleFontSize", value)} />
                      <FontSizeStepper label="Body" value={draft.bodyFontSize} min={12} max={draft.shape === "anchored_coachmark" ? 26 : 36} disabled={!canAdminister} onChange={(value) => update("bodyFontSize", value)} />
                      <FontSizeStepper label="Fine print" value={draft.disclaimerFontSize} min={10} max={24} disabled={!canAdminister} onChange={(value) => update("disclaimerFontSize", value)} />
                      <FontSizeStepper label="Countdown" value={draft.countdownFontSize} min={10} max={30} disabled={!canAdminister} onChange={(value) => update("countdownFontSize", value)} />
                    </div>
                  </div>
                  <Field label="Decoration">
                    <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900" value={draft.decoration} onChange={(event) => update("decoration", event.target.value as EdgeMessageDraft["decoration"])} disabled={!canAdminister}>
                      <option value="none">None</option>
                      <option value="badge">Badge</option>
                      <option value="pulse_badge">Pulse badge</option>
                    </select>
                  </Field>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-5">
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-950">Preview</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{draft.hostname}{draft.path}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Publishes to Worker</Badge>
                    <Badge variant="outline" className={draft.ignoreFrequencyCap ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}>
                      {draft.ignoreFrequencyCap ? "Every reload" : "Frequency capped"}
                    </Badge>
                  </div>
                </div>
                <MessagePreview draft={draft} />
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-[#15284B]" />
                    <h2 className="text-base font-semibold text-slate-950">Delivery</h2>
                  </div>
                  <div className="space-y-4">
                    <Field label="Trigger">
                      <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900" value={draft.triggerMode} onChange={(event) => update("triggerMode", event.target.value as TriggerMode)} disabled={!canAdminister}>
                        {DELIVERY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={`Scroll depth ${draft.scrollDepth}%`}>
                      <input className="w-full accent-[#15284B]" type="range" min={0} max={100} step={5} value={draft.scrollDepth} onChange={(event) => update("scrollDepth", Number(event.target.value))} disabled={!canAdminister || draft.triggerMode !== "scroll_depth"} />
                    </Field>
                    <Field label="Placement">
                      <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900" value={draft.placement} onChange={(event) => update("placement", event.target.value as Placement)} disabled={!canAdminister}>
                        {PLACEMENT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </Field>
                    <div className="grid grid-cols-3 gap-3">
                      <NumberField label="Delay" value={draft.showDelayMs} suffix="ms" disabled={!canAdminister} onChange={(value) => update("showDelayMs", value)} />
                      <NumberField label="Duration" value={draft.durationMs} suffix="ms" disabled={!canAdminister} onChange={(value) => update("durationMs", value)} />
                      <NumberField label="Fade" value={draft.fadeMs} suffix="ms" disabled={!canAdminister} onChange={(value) => update("fadeMs", value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#15284B]" />
                    <h2 className="text-base font-semibold text-slate-950">Guardrails</h2>
                  </div>
                  <div className="space-y-3">
                    <GuardrailRow icon={CheckCircle2} label="Clean route targeting" value={activeMessage.path} />
                    <GuardrailRow icon={Gauge} label="Benchmark" value={activeMessage.benchmark} />
                    <GuardrailRow icon={Eye} label="Visual QA" value="Browser proof passed" />
                    <GuardrailRow icon={TimerReset} label="Frequency mode" value={draft.ignoreFrequencyCap ? "Testing every reload" : `${draft.frequencyCapSeconds / 3600}h cap`} />
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <Button type="button" variant="outline" disabled>
                      <PauseCircle className="mr-2 h-4 w-4" />
                      Pause
                    </Button>
                    <Button type="button" variant="outline" disabled>
                      <Rocket className="mr-2 h-4 w-4" />
                      Launch
                    </Button>
                    <Button type="button" variant="outline" disabled>
                      <X className="mr-2 h-4 w-4" />
                      Rollback
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function ColorInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-10 w-12 rounded-md border border-slate-200 bg-white p-1 disabled:opacity-60" />
        <Input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CORPORATE_COLOR_SWATCHES.map((swatch) => {
          const selected = value.toLowerCase() === swatch.value.toLowerCase();
          return (
            <button
              key={swatch.value}
              type="button"
              aria-label={swatch.label}
              title={`${swatch.label} ${swatch.value}`}
              disabled={disabled}
              onClick={() => onChange(swatch.value)}
              className={`h-6 w-6 rounded-full border shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                selected ? "border-slate-950 ring-2 ring-[#15284B]/20" : "border-slate-300 hover:-translate-y-0.5"
              }`}
              style={{ backgroundColor: swatch.value }}
            />
          );
        })}
      </div>
    </div>
  );
}

function FontSizeStepper({ label, value, min, max, disabled, onChange }: { label: string; value: number; min: number; max: number; disabled: boolean; onChange: (value: number) => void }) {
  function adjust(delta: number) {
    onChange(Math.min(max, Math.max(min, value + delta)));
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}px</p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" className="h-8 w-8 p-0" disabled={disabled || value <= min} aria-label={`Decrease ${label} font size`} onClick={() => adjust(-1)}>
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" className="h-8 w-8 p-0" disabled={disabled || value >= max} aria-label={`Increase ${label} font size`} onClick={() => adjust(1)}>
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, suffix, disabled, onChange }: { label: string; value: number; suffix: string; disabled: boolean; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <div className="relative">
        <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled} className="pr-9" />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">{suffix}</span>
      </div>
    </Field>
  );
}

function GuardrailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 text-[#15284B]" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function MessagePreview({ draft }: { draft: EdgeMessageDraft }) {
  const showCoach = draft.shape === "anchored_coachmark";
  const showBanner = draft.shape === "top_banner";
  const showToast = draft.shape === "bottom_toast";
  const showInline = draft.shape === "inline_callout";
  const showModal = draft.shape === "modal_notice";

  if (showCoach) {
    return (
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-slate-200 bg-white">
        <img src={APARTMENTS_PREVIEW_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
        <div className="absolute right-[5%] top-[17%] z-20 w-[360px] max-w-[42%] rounded-[18px] px-4 py-3 pr-10 shadow-2xl" style={{ backgroundColor: draft.brandColor, color: draft.surfaceTextColor }}>
          <button className="absolute right-3 top-2 text-xl opacity-90" type="button" aria-label="Close preview">x</button>
          <p className="flex items-center gap-2 font-black" style={{ fontSize: draft.titleFontSize }}>
            {draft.decoration !== "none" && (
              <span className={`grid h-6 w-6 place-items-center rounded-full text-sm font-black text-[#15284B] ${draft.decoration === "pulse_badge" ? "animate-pulse" : ""}`} style={{ backgroundColor: draft.accentColor }}>
                !
              </span>
            )}
            {draft.title}
          </p>
          <p className="mt-1 leading-5 opacity-90" style={{ fontSize: draft.bodyFontSize }}>{draft.body}</p>
          <span className="absolute -bottom-2 right-[14%] h-4 w-4 rotate-45 rounded-sm" style={{ backgroundColor: draft.brandColor }} />
        </div>
        <div className="absolute bottom-4 left-5 z-10 rounded-md border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
          {formatShape(draft.shape)} / {draft.triggerMode.replace(/_/g, " ")} / {seconds(draft.fadeMs)} fade
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-[#15284B]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${PREVIEW_HERO_IMAGE})`,
          backgroundPosition: "center center",
          backgroundSize: "cover",
        }}
      />
      <div className="absolute inset-0 bg-[#15284B]/35" />
      <div className="relative z-0 border-b border-slate-200 bg-white/90 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/velo-current.svg" alt="" width={42} height={24} />
            <span className="text-sm font-black uppercase tracking-[0.28em]" style={{ color: draft.brandColor }}>Venterra</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Apply Now</span>
            <span>Schedule A Tour</span>
          </div>
        </div>
      </div>

      <div className="relative z-0 flex min-h-[456px] flex-col justify-end px-8 pb-9 pt-10 text-white">
        <div className="max-w-xl">
          <p className="text-sm font-black uppercase tracking-[0.28em] opacity-90">{draft.propertyName}</p>
          <h3 className="mt-3 max-w-lg text-4xl font-black leading-tight">Apartments in Atlanta, GA</h3>
          <p className="mt-4 max-w-lg text-base font-semibold leading-7 text-white/90">
            Find your next home at Apex West Midtown.
          </p>
        </div>
        <div className="mt-7 flex items-center gap-4">
          <button className="relative h-12 rounded-full bg-white/92 px-7 text-sm font-black tracking-[0.12em] text-[#15284B] shadow-lg">
            Find Your Home <span aria-hidden="true">-&gt;</span>
          </button>
        </div>
        {showInline && (
          <div className="mt-5 rounded-lg border-l-4 bg-slate-50 px-4 py-3" style={{ borderColor: draft.brandColor }}>
            <p className="font-bold" style={{ color: draft.titleColor, fontSize: draft.titleFontSize }}>{draft.title}</p>
            <p className="mt-1 leading-5" style={{ color: draft.bodyColor, fontSize: draft.bodyFontSize }}>{draft.body}</p>
          </div>
        )}
      </div>

      {showBanner && (
        <div className="absolute left-0 right-0 top-0 z-20 px-5 py-3 font-semibold" style={{ backgroundColor: draft.brandColor, color: draft.surfaceTextColor, fontSize: draft.titleFontSize }}>
          {draft.title.replace(/\n/g, " ")}
        </div>
      )}

      {showToast && (
        <div className="absolute bottom-5 right-5 z-20 max-w-sm rounded-lg p-4 shadow-2xl" style={{ backgroundColor: draft.brandColor, color: draft.surfaceTextColor }}>
          <p className="font-bold" style={{ fontSize: draft.titleFontSize }}>{draft.title.replace(/\n/g, " ")}</p>
          <p className="mt-1 leading-5 opacity-90" style={{ fontSize: draft.bodyFontSize }}>{draft.body}</p>
        </div>
      )}

      {showCoach && (
        <div className="absolute right-16 top-52 z-20 max-w-xs rounded-[18px] px-4 py-3 pr-10 shadow-2xl" style={{ backgroundColor: draft.brandColor, color: draft.surfaceTextColor }}>
          <button className="absolute right-2 top-1.5 text-xl opacity-90" type="button" aria-label="Close preview">x</button>
          <p className="flex items-center gap-2 text-sm font-black">
            {draft.decoration !== "none" && (
              <span className={`grid h-6 w-6 place-items-center rounded-full text-sm font-black text-[#15284B] ${draft.decoration === "pulse_badge" ? "animate-pulse" : ""}`} style={{ backgroundColor: draft.accentColor }}>
                !
              </span>
            )}
            {draft.title}
          </p>
          <p className="mt-1 text-sm leading-5 opacity-90">{draft.body}</p>
          <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 rounded-sm" style={{ backgroundColor: draft.brandColor }} />
        </div>
      )}

      {showModal && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/28 px-5">
          <div className="relative w-full max-w-[560px] origin-center scale-[0.82] rounded-[18px] bg-white px-10 py-7 text-center shadow-2xl">
            <button className="absolute right-5 top-4 text-3xl leading-none text-slate-500" type="button" aria-label="Close preview">x</button>
            <p className="mx-12 font-extrabold leading-tight" style={{ color: draft.bodyColor, fontSize: draft.propertyNameFontSize }}>{draft.propertyName}</p>
            <h3 className="mx-auto mt-7 max-w-[470px] whitespace-pre-line font-black leading-[1.16]" style={{ color: draft.titleColor, fontSize: draft.titleFontSize }}>{draft.title}</h3>
            <p className="mx-auto mt-7 max-w-[455px] leading-[1.52]" style={{ color: draft.bodyColor, fontSize: draft.bodyFontSize }}>{draft.body}</p>
            {draft.disclaimer && <p className="mx-auto mt-5 max-w-[420px] font-extrabold leading-7" style={{ color: draft.disclaimerColor, fontSize: draft.disclaimerFontSize }}>{draft.disclaimer}</p>}
            <p className="mt-7 font-black" style={{ color: draft.bodyColor, fontSize: draft.countdownFontSize }}>Closing in {Math.ceil(draft.durationMs / 1000)} seconds</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full" style={{ width: "78%", backgroundColor: draft.brandColor }} />
            </div>
            <div className="mt-6 flex justify-center">
              <Image src="/velo-current.svg" alt="" width={68} height={38} />
              <span className="ml-2 self-center text-xl font-black uppercase tracking-[0.22em]" style={{ color: draft.brandColor }}>Venterra</span>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-5 z-10 rounded-md border border-white/70 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
        {formatShape(draft.shape)} / {draft.triggerMode.replace(/_/g, " ")} / {seconds(draft.fadeMs)} fade
      </div>
    </div>
  );
}
