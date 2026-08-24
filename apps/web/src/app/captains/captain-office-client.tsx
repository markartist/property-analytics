"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSearch,
  GitBranch,
  History,
  KeyRound,
  Loader2,
  LockKeyhole,
  NotebookPen,
  Route,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { RestrictedSurfaceCard } from "@/components/shared/restricted-surface-card";
import {
  createAwarenessCommitment,
  createAwarenessSelfNote,
  getAwarenessMemoryPosture,
  getCaptainOfficeState,
  getCommunities,
  getExpertRead,
  getExpertReadsForProperty,
  requestExpertRead,
  submitCaptainRuntimeInteraction,
  type AwarenessMemoryPosture,
  type CaptainEvidencePacketRead,
  type CaptainMemoryCandidateRead,
  type CaptainOfficeHistoryItem,
  type CaptainOfficeState,
  type Community,
  type ExpertLaneId,
  type ExpertReadRead,
} from "@/lib/api";
import { canPerformOfferingAction } from "@/lib/permissions";

type OfficeSection = "office" | "history" | "watchlist" | "memory" | "quarters" | "expert-reads";
type WorkspaceTab = "runtime" | "watch" | "memory" | "expert" | "lineage";

const DEFAULT_PROPERTY = "AR4PB";
const RUNTIME_MODES = ["monitoring", "lightweight", "standard", "escalated", "executive", "simulation"] as const;
const INTERACTION_FOCUS = [
  "operational update",
  "content suggestion",
  "recommendation request",
  "correction",
  "question",
  "escalation",
  "reputation concern",
  "website concern",
  "amenity update",
  "event update",
  "resident issue",
  "pricing concern",
];

const EXPERT_LANES: Array<{ id: ExpertLaneId; label: string; purpose: string }> = [
  { id: "quartermaster", label: "Quartermaster", purpose: "source confidence, freshness, and blocking controls" },
  { id: "leasing_performance_advisor", label: "Leasing Performance Advisor", purpose: "funnel leakage and conversion action" },
  { id: "signals_officer", label: "Signals Officer", purpose: "channel quality and spend posture" },
  { id: "navigator", label: "Navigator", purpose: "website, copy, metadata, GBP, and local content" },
  { id: "revenue_advisor", label: "Revenue Advisor", purpose: "pricing, concessions, exposure, and recovery math" },
  { id: "market_scout", label: "Market Scout", purpose: "competitor rent, specials, and visible market pressure" },
  { id: "product_readiness_officer", label: "Product Readiness Officer", purpose: "available product, readiness, and blockers" },
  { id: "reputation_officer", label: "Reputation Officer", purpose: "review voice, sentiment, and complaint themes" },
  { id: "resident_experience_officer", label: "Resident Experience Officer", purpose: "resident friction, tickets, and service blockers" },
  { id: "engineer", label: "Engineer", purpose: "website technical health, PSI/CWV, and broken paths" },
  { id: "trust_and_proof_advisor", label: "Trust And Proof Advisor", purpose: "credible claims, proof gaps, and USP risk" },
  { id: "unit_type_fit_advisor", label: "Unit-Type Fit Advisor", purpose: "demand-to-available-unit fit by unit type" },
  { id: "seasonality_demand_timing_advisor", label: "Seasonality And Demand Timing Advisor", purpose: "demand timing and market timing risk" },
  { id: "market_elasticity_advisor", label: "Market Elasticity Advisor", purpose: "rent, concession, value-copy, and comp sensitivity" },
  { id: "operational_capacity_advisor", label: "Operational Capacity Advisor", purpose: "team capacity and execution feasibility" },
  { id: "peer_borrowing_advisor", label: "Peer Borrowing Advisor", purpose: "borrowable peer tactics across region and portfolio" },
];

const WORKSPACES: Array<{ id: WorkspaceTab; label: string; description: string; icon: React.ElementType }> = [
  { id: "runtime", label: "Runtime", description: "Submit updates and inspect the governed response.", icon: Send },
  { id: "watch", label: "Watch & Actions", description: "Review active alerts, tickets, and follow-through.", icon: AlertTriangle },
  { id: "memory", label: "Quarters", description: "Capture working memory without promoting it to truth.", icon: Brain },
  { id: "expert", label: "Expert Reads", description: "Request and review specialist guidance.", icon: FileSearch },
  { id: "lineage", label: "Lineage", description: "Audit prior runs, hashes, and evidence trail.", icon: GitBranch },
];

function workspaceForSection(section: OfficeSection): WorkspaceTab {
  if (section === "history") return "lineage";
  if (section === "watchlist") return "watch";
  if (section === "memory" || section === "quarters") return "memory";
  if (section === "expert-reads") return "expert";
  return "runtime";
}

function formatDate(value: unknown): string {
  if (!value || typeof value !== "string") return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${month}/${day}/${year}` : value;
}

function shortHash(value: unknown): string {
  const text = String(value ?? "");
  return text ? `${text.slice(0, 10)}...${text.slice(-6)}` : "-";
}

function label(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replace(/_/g, " ");
}

function numericPercent(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return `${Math.round(parsed * 100)}%`;
}

function expertLaneLabel(value: ExpertLaneId | string): string {
  return EXPERT_LANES.find((lane) => lane.id === value)?.label ?? label(value);
}

function statusClasses(value: unknown): string {
  const text = String(value ?? "").toLowerCase();
  if (["pass", "verified", "canonical", "current", "internal_only"].includes(text)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["warn", "claim", "needs_verification", "stale", "unknown", "pending", "candidate"].includes(text)) return "border-amber-200 bg-amber-50 text-amber-800";
  if (["block", "blocked", "conflicting", "conflict", "escalated"].includes(text)) return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function Badge({ children, value }: { children?: React.ReactNode; value?: unknown }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusClasses(value ?? children)}`}>
      {children ?? label(value)}
    </span>
  );
}

function Card({ title, icon: Icon, children, action }: { title: string; icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF6F8] text-[#0D5E6D]">
            <Icon className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function CaptainOfficeClient({ initialPropertyId, section = "office" }: { initialPropertyId?: string; section?: OfficeSection }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const canView = canPerformOfferingAction(user?.role, "captainOffice", "view");
  const [communities, setCommunities] = React.useState<Community[]>([]);
  const [propertyId, setPropertyId] = React.useState(initialPropertyId ?? DEFAULT_PROPERTY);
  const [state, setState] = React.useState<CaptainOfficeState | null>(null);
  const [awarenessPosture, setAwarenessPosture] = React.useState<AwarenessMemoryPosture | null>(null);
  const [expertReads, setExpertReads] = React.useState<ExpertReadRead[]>([]);
  const [selectedExpertRead, setSelectedExpertRead] = React.useState<ExpertReadRead | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [expertLoading, setExpertLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [requestingExpert, setRequestingExpert] = React.useState(false);
  const [savingAwareness, setSavingAwareness] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [inputText, setInputText] = React.useState("");
  const [selfNoteText, setSelfNoteText] = React.useState("");
  const [commitmentText, setCommitmentText] = React.useState("");
  const [runtimeMode, setRuntimeMode] = React.useState<(typeof RUNTIME_MODES)[number]>("standard");
  const [focus, setFocus] = React.useState(INTERACTION_FOCUS[0]);
  const [expertLane, setExpertLane] = React.useState<ExpertLaneId>("quartermaster");
  const [expertReason, setExpertReason] = React.useState("Review this property context and return governed specialist guidance.");
  const [activeWorkspace, setActiveWorkspace] = React.useState<WorkspaceTab>(() => workspaceForSection(section));

  React.useEffect(() => {
    if (initialPropertyId && initialPropertyId !== propertyId) setPropertyId(initialPropertyId);
  }, [initialPropertyId, propertyId]);

  const loadOffice = React.useCallback((id: string) => {
    if (!canView) return;
    setLoading(true);
    Promise.all([getCommunities(), getCaptainOfficeState(id), getExpertReadsForProperty(id)])
      .then(([communityRows, office, expertReadRows]) => {
        setCommunities(communityRows);
        setState(office);
        setExpertReads(expertReadRows);
        setSelectedExpertRead((current) => {
          if (!current) return expertReadRows[0] ?? null;
          return expertReadRows.find((read) => read.expert_read_id === current.expert_read_id) ?? expertReadRows[0] ?? null;
        });
        setError(null);
        void getAwarenessMemoryPosture(id)
          .then(setAwarenessPosture)
          .catch(() => setAwarenessPosture(null));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Captain’s Office"))
      .finally(() => setLoading(false));
  }, [canView]);

  React.useEffect(() => {
    if (authLoading || !canView) return;
    loadOffice(propertyId);
  }, [authLoading, canView, loadOffice, propertyId]);

  React.useEffect(() => {
    setActiveWorkspace(workspaceForSection(section));
  }, [section]);

  async function submitInteraction(event: React.FormEvent) {
    event.preventDefault();
    if (!inputText.trim() || !state) return;
    setSubmitting(true);
    try {
      await submitCaptainRuntimeInteraction({
        property_id: state.property.property_code ?? state.property.encasa_property_code ?? propertyId,
        input_text: inputText.trim(),
        runtime_mode: runtimeMode,
        actor: "user",
        input_type: "text",
        report_family: "captain",
        idempotency_key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setInputText("");
      await Promise.resolve(loadOffice(propertyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Captain Runtime rejected the interaction");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPropertyCode = state?.property.property_code ?? state?.property.encasa_property_code ?? propertyId;
  const latest = state?.history[0] ?? null;
  const alertCount = state?.alerts.length ?? 0;
  const watchCount = state?.watch_items.length ?? 0;
  const actionCount = state?.actions.length ?? 0;
  const evidenceCount = state?.evidence_packets[0]?.evidence.length ?? 0;
  const memoryOpenCount = (awarenessPosture?.open_commitments.length ?? 0) + (awarenessPosture?.verification_needed_items.length ?? 0);
  const blockedExpertCount = expertReads.filter((read) => read.read_status === "blocked" || read.publishability === "blocked").length;
  const workspaceMetrics: Record<WorkspaceTab, { value: string; tone: unknown }> = {
    runtime: { value: latest ? formatDate(latest.timestamp) : "No run", tone: latest?.publishability ?? "unknown" },
    watch: { value: `${alertCount + watchCount + actionCount}`, tone: alertCount || actionCount ? "warn" : "pass" },
    memory: { value: `${memoryOpenCount}`, tone: memoryOpenCount ? "warn" : "pass" },
    expert: { value: `${expertReads.length}`, tone: blockedExpertCount ? "blocked" : "current" },
    lineage: { value: `${evidenceCount}`, tone: evidenceCount ? "current" : "unknown" },
  };

  async function selectExpertRead(expertReadId: string) {
    const existing = expertReads.find((read) => read.expert_read_id === expertReadId);
    if (existing) {
      setSelectedExpertRead(existing);
      return;
    }
    setExpertLoading(true);
    try {
      setSelectedExpertRead(await getExpertRead(expertReadId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Expert Read detail");
    } finally {
      setExpertLoading(false);
    }
  }

  async function submitExpertReadRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!state) return;
    const packet = state.evidence_packets[0];
    if (!packet) {
      setError("Expert Reads require a governed Captain evidence packet before a lane can be requested.");
      return;
    }
    setRequestingExpert(true);
    try {
      const result = await requestExpertRead({
        property_id: selectedPropertyCode,
        lane_id: expertLane,
        evidence_packet_id: packet.evidence_packet_id,
        runtime_mode: runtimeMode,
        report_family: "captain",
        reason: expertReason,
        source_runtime_id: latest?.session_id ?? null,
        source_interaction_id: latest?.interaction_id ?? null,
        correlation_id: latest?.correlation_id ?? null,
      });
      const read = (result as { expert_read?: ExpertReadRead }).expert_read;
      await Promise.resolve(loadOffice(propertyId));
      if (read?.expert_read_id) await selectExpertRead(read.expert_read_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Expert Read request was rejected by governance");
    } finally {
      setRequestingExpert(false);
    }
  }

  async function submitSelfNote(event: React.FormEvent) {
    event.preventDefault();
    if (!selfNoteText.trim()) return;
    setSavingAwareness(true);
    try {
      await createAwarenessSelfNote(selectedPropertyCode, {
        note_text: selfNoteText.trim(),
        note_type: "reminder",
        importance: 3,
        visibility: "private_to_agent",
      });
      setSelfNoteText("");
      setAwarenessPosture(await getAwarenessMemoryPosture(selectedPropertyCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Awareness Network rejected the self note");
    } finally {
      setSavingAwareness(false);
    }
  }

  async function submitCommitment(event: React.FormEvent) {
    event.preventDefault();
    if (!commitmentText.trim()) return;
    setSavingAwareness(true);
    try {
      await createAwarenessCommitment(selectedPropertyCode, {
        commitment_type: "follow_up",
        description: commitmentText.trim(),
        owed_by: "Captain",
        owed_to: "Property team",
      });
      setCommitmentText("");
      setAwarenessPosture(await getAwarenessMemoryPosture(selectedPropertyCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Awareness Network rejected the commitment");
    } finally {
      setSavingAwareness(false);
    }
  }

  if (authLoading) return null;
  if (!canView) {
    return (
      <RestrictedSurfaceCard
        title="Captain’s Office is curator-only"
        description="This governed workspace is reserved for users who can operate Captain Runtime interactions and review evidence lineage."
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F8FB]">
      <div className="mx-auto max-w-[1500px] space-y-6 px-5 py-7 md:px-8">
        <header className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[#3B9189]">
                <ClipboardCheck className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-[0.24em]">Captain’s Office</span>
              </div>
              <h1 className="mt-2 truncate text-3xl font-black tracking-normal text-[#15284B] md:text-4xl">
                {state?.property.name ?? "Governed property workspace"}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Evidence-aware runtime workspace for property updates, tickets, recommendations, memory, and lineage.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row xl:items-center">
              <select
                value={selectedPropertyCode}
                onChange={(event) => {
                  setPropertyId(event.target.value);
                  router.push(`/captains/${encodeURIComponent(event.target.value)}`);
                }}
                className="h-11 min-w-[280px] rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
              >
                {communities.length === 0 && <option value={selectedPropertyCode}>{selectedPropertyCode}</option>}
                {communities.map((community) => {
                  const value = community.encasa_property_code ?? community.id;
                  return <option key={community.id} value={value}>{community.name}</option>;
                })}
              </select>
              <Link className="inline-flex h-11 items-center justify-center rounded-md bg-[#15284B] px-4 text-sm font-bold text-white" href={`/captains/${encodeURIComponent(selectedPropertyCode)}/history`}>
                Captain’s Log
              </Link>
              <Link className="inline-flex h-11 items-center justify-center rounded-md border border-[#15284B] bg-white px-4 text-sm font-bold text-[#15284B]" href={`/captains/${encodeURIComponent(selectedPropertyCode)}/quarters`}>
                Captain’s Quarters
              </Link>
              <Link className="inline-flex h-11 items-center justify-center rounded-md border border-[#15284B] bg-white px-4 text-sm font-bold text-[#15284B]" href={`/captains/${encodeURIComponent(selectedPropertyCode)}/expert-reads`}>
                Expert Reads
              </Link>
            </div>
          </div>
          <div className="mt-5 grid gap-2 rounded-lg border border-[#D6D6D2] bg-[#F6F6F5] p-2 md:grid-cols-5">
            <SummaryTile label="Mode" value={state?.runtime_status.latest_runtime_mode ?? "No run"} tone={state?.runtime_status.latest_runtime_mode} />
            <SummaryTile label="Authority" value={state?.runtime_status.latest_authority_level ?? "No state"} tone={state?.runtime_status.latest_authority_level} />
            <SummaryTile label="Confidence" value={numericPercent(state?.runtime_status.latest_confidence)} tone={state?.runtime_status.latest_confidence ? "verified" : "unknown"} />
            <SummaryTile label="Publish" value={state?.runtime_status.latest_publishability ?? "No state"} tone={state?.runtime_status.latest_publishability} />
            <SummaryTile label="Last Run" value={formatDate(state?.runtime_status.last_interaction_at)} tone="current" />
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-slate-200 bg-white">
            <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
          </div>
        ) : (
          <main className="space-y-5">
            <WorkspaceSwitch active={activeWorkspace} onChange={setActiveWorkspace} metrics={workspaceMetrics} />

            {activeWorkspace === "runtime" && (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
                <div className="space-y-5">
                  <InteractionWorkspace
                    focus={focus}
                    setFocus={setFocus}
                    inputText={inputText}
                    setInputText={setInputText}
                    runtimeMode={runtimeMode}
                    setRuntimeMode={setRuntimeMode}
                    submitting={submitting}
                    onSubmit={submitInteraction}
                    latest={latest}
                  />
                  <StructuredResponse latest={latest} />
                </div>
                <EvidenceAuthoritySidebar state={state} />
              </div>
            )}

            {activeWorkspace === "watch" && (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.8fr)]">
                <WatchItemsPanel state={state} propertyCode={selectedPropertyCode} />
                <RoutingPanel latest={latest} actions={state?.actions ?? []} />
              </div>
            )}

            {activeWorkspace === "memory" && (
              <div className="space-y-5">
                <MemoryStewardshipPanel
                  posture={awarenessPosture}
                  selfNoteText={selfNoteText}
                  setSelfNoteText={setSelfNoteText}
                  commitmentText={commitmentText}
                  setCommitmentText={setCommitmentText}
                  saving={savingAwareness}
                  onSelfNote={submitSelfNote}
                  onCommitment={submitCommitment}
                />
                <MemoryCandidatePanel candidates={state?.memory_candidates ?? []} propertyCode={selectedPropertyCode} />
              </div>
            )}

            {activeWorkspace === "expert" && (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.8fr)]">
                <ExpertReadsWorkspace
                  propertyCode={selectedPropertyCode}
                  reads={expertReads}
                  selectedRead={selectedExpertRead}
                  loading={expertLoading}
                  onSelect={selectExpertRead}
                  lane={expertLane}
                  setLane={setExpertLane}
                  reason={expertReason}
                  setReason={setExpertReason}
                  runtimeMode={runtimeMode}
                  latestEvidencePacket={state?.evidence_packets[0] ?? null}
                  requesting={requestingExpert}
                  onRequest={submitExpertReadRequest}
                />
                <ExpertReadAuthorityPanel reads={expertReads} selectedRead={selectedExpertRead} />
              </div>
            )}

            {activeWorkspace === "lineage" && (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.8fr)]">
                <RuntimeHistoryPanel items={state?.history ?? []} propertyCode={selectedPropertyCode} expanded />
                <LineageFooter state={state} />
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  );
}

function WorkspaceSwitch({
  active,
  onChange,
  metrics,
}: {
  active: WorkspaceTab;
  onChange: (value: WorkspaceTab) => void;
  metrics: Record<WorkspaceTab, { value: string; tone: unknown }>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {WORKSPACES.map((workspace) => {
          const Icon = workspace.icon;
          const metric = metrics[workspace.id];
          const selected = active === workspace.id;
          return (
            <button
              key={workspace.id}
              type="button"
              onClick={() => onChange(workspace.id)}
              aria-pressed={selected}
              className={`min-h-[112px] rounded-lg border p-4 text-left transition ${
                selected ? "border-[#15284B] bg-[#15284B] text-white shadow-sm" : "border-[#D6D6D2] bg-[#F6F6F5] text-slate-700 hover:border-[#3D66B9] hover:bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-md ${selected ? "bg-white/15 text-white" : "bg-white text-[#3B9189]"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <Badge value={metric.tone}>{metric.value}</Badge>
              </div>
              <p className="mt-3 text-base font-black">{workspace.label}</p>
              <p className={`mt-1 text-sm leading-5 ${selected ? "text-white/75" : "text-slate-500"}`}>{workspace.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SummaryTile({ label: title, value, tone }: { label: string; value: unknown; tone?: unknown }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{title}</p>
          <p className="mt-1 truncate text-sm font-black capitalize text-slate-950">{label(value)}</p>
        </div>
        <Badge value={tone ?? value} />
      </div>
    </div>
  );
}

function InteractionWorkspace(props: {
  focus: string;
  setFocus: (value: string) => void;
  inputText: string;
  setInputText: (value: string) => void;
  runtimeMode: (typeof RUNTIME_MODES)[number];
  setRuntimeMode: (value: (typeof RUNTIME_MODES)[number]) => void;
  submitting: boolean;
  onSubmit: (event: React.FormEvent) => void;
  latest: CaptainOfficeHistoryItem | null;
}) {
  return (
    <Card title="Runtime Interaction Workspace" icon={Send}>
      <form onSubmit={props.onSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Interaction focus</span>
            <select value={props.focus} onChange={(event) => props.setFocus(event.target.value)} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">
              {INTERACTION_FOCUS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Runtime mode</span>
            <select value={props.runtimeMode} onChange={(event) => props.setRuntimeMode(event.target.value as (typeof RUNTIME_MODES)[number])} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">
              {RUNTIME_MODES.map((mode) => <option key={mode} value={mode}>{label(mode)}</option>)}
            </select>
          </label>
        </div>
        <textarea
          value={props.inputText}
          onChange={(event) => props.setInputText(event.target.value)}
          rows={6}
          placeholder="Submit a property question, operational update, correction, concern, or recommendation request. The Captain Runtime will classify intent and apply governance."
          className="w-full resize-none rounded-lg border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-900 outline-none focus:border-[#0D5E6D] focus:ring-2 focus:ring-[#0D5E6D]/15"
        />
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 md:flex-row md:items-center md:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            The selected focus helps the operator frame the update. Captain Runtime still classifies the actual interaction and resolves directives before reasoning.
          </p>
          <button
            type="submit"
            disabled={props.submitting || !props.inputText.trim()}
            className="inline-flex h-11 items-center justify-center rounded-md bg-[#15284B] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {props.submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Submit To Runtime
          </button>
        </div>
      </form>
      {props.latest && (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Latest accepted interaction</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{props.latest.input_text}</p>
        </div>
      )}
    </Card>
  );
}

function StructuredResponse({ latest }: { latest: CaptainOfficeHistoryItem | null }) {
  const outputs = latest?.structured_outputs ?? {};
  return (
    <Card title="Structured Captain Response" icon={ShieldCheck}>
      {!latest ? (
        <EmptyState message="No runtime response has been generated for this property yet." />
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Captain response</p>
            <p className="mt-2 text-base font-semibold leading-7 text-slate-900">{latest.conversational_response}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Reasoning summary</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{latest.reasoning_summary}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <MiniRead label="Confidence" value={numericPercent(latest.confidence)} tone={latest.confidence ? "verified" : "unknown"} />
            <MiniRead label="Publishability" value={label(latest.publishability)} tone={latest.publishability} />
            <MiniRead label="Escalation" value={latest.escalation_required ? "Required" : "Not required"} tone={latest.escalation_required ? "blocked" : "pass"} />
          </div>
          <StructuredList title="Required follow-ups" items={arrayOfText(outputs.required_followups)} />
          <StructuredList title="Unresolved conflicts" items={arrayOfText(outputs.unresolved_conflicts)} empty="No unresolved conflicts returned by the runtime." />
          <StructuredList title="Escalation needs" items={arrayOfText(outputs.escalation_needs)} empty="No escalation requirements returned by the runtime." />
        </div>
      )}
    </Card>
  );
}

function EvidenceAuthoritySidebar({ state }: { state: CaptainOfficeState | null }) {
  const packet = state?.evidence_packets[0];
  const evidence = packet?.evidence ?? [];
  return (
    <Card title="Evidence / Authority" icon={Database}>
      {!packet ? (
        <EmptyState message="No evidence packet has been generated yet." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <MiniRead label="Packet State" value={label((packet.freshness_state as Record<string, unknown>)?.packet_state)} tone={(packet.freshness_state as Record<string, unknown>)?.packet_state} />
            <MiniRead label="Sources" value={String(packet.included_sources.length)} tone="current" />
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Evidence hash</p>
            <p className="mt-2 font-mono text-xs text-slate-700">{shortHash(packet.evidence_hash)}</p>
          </div>
          <div className="space-y-3">
            {evidence.slice(0, 8).map((item, index) => (
              <details key={`${String(item.evidence_id)}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer text-sm font-black text-slate-900">
                  {label(item.evidence_class)}
                </summary>
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge value={item.authority} />
                    <Badge value={item.freshness} />
                  </div>
                  <p className="text-sm leading-6 text-slate-700">{label(item.summary)}</p>
                  <p className="font-mono text-[11px] text-slate-500">{label(item.source_key)} · {label(item.source_table)}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function RoutingPanel({ latest, actions }: { latest: CaptainOfficeHistoryItem | null; actions: Array<Record<string, unknown>> }) {
  const decisions = arrayOfRecords(latest?.structured_outputs?.routing_decisions);
  return (
    <Card title="Routing / Actions" icon={Route}>
      <div className="space-y-3">
        {decisions.length === 0 ? <EmptyState message="No runtime routing decisions are available yet." /> : decisions.map((decision, index) => (
          <div key={index} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black capitalize text-slate-900">{label(decision.target_lane)}</p>
              <Badge value="pending" />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{label(decision.reason)}</p>
          </div>
        ))}
        {actions.slice(0, 4).map((action, index) => (
          <div key={index} className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <p className="text-sm font-black text-slate-900">{label(action.title ?? action.action)}</p>
            <p className="mt-1 text-sm text-slate-600">{label(action.status)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WatchItemsPanel({ state, propertyCode }: { state: CaptainOfficeState | null; propertyCode: string }) {
  return (
    <Card title="Watch Items / Alerts" icon={AlertTriangle} action={<Link className="text-sm font-bold text-[#0057c2]" href={`/captains/${encodeURIComponent(propertyCode)}/watchlist`}>Open watchlist</Link>}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {(state?.alerts ?? []).length === 0 ? <EmptyState message="No active Captain’s Office alerts." /> : state?.alerts.map((alert, index) => (
            <div key={index} className={`rounded-lg border p-4 ${statusClasses(alert.severity)}`}>
              <p className="font-black">{alert.title}</p>
              <p className="mt-1 text-sm leading-6">{alert.detail}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {(state?.watch_items ?? []).slice(0, 6).map((item, index) => (
            <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-slate-900">{label(item.title ?? item.watch)}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{label(item.current_state ?? item.status)}</p>
            </div>
          ))}
          {(state?.watch_items ?? []).length === 0 && <EmptyState message="No open watch items returned by the Captain source tables." />}
        </div>
      </div>
    </Card>
  );
}

function MemoryStewardshipPanel(props: {
  posture: AwarenessMemoryPosture | null;
  selfNoteText: string;
  setSelfNoteText: (value: string) => void;
  commitmentText: string;
  setCommitmentText: (value: string) => void;
  saving: boolean;
  onSelfNote: (event: React.FormEvent) => void;
  onCommitment: (event: React.FormEvent) => void;
}) {
  const posture = props.posture;
  return (
    <Card title="Captain’s Quarters" icon={Brain}>
      <div className="mb-5 rounded-lg border border-[#B7DFE6] bg-[#EFFAFC] p-4 text-sm font-semibold leading-6 text-[#114C58]">
        Captain’s Quarters is the Captain’s working memory and stewardship space. Self Notes are not canonical truth, human-submitted memory requires verification, and Fleet Scribe remains publication authority.
      </div>

      {!posture ? (
        <EmptyState message="Memory Posture is not available for this property or user scope." />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <MiniRead label="Captain" value={posture.agent_identity?.display_name ?? "Unassigned"} tone={posture.agent_identity?.active_status ?? "unknown"} />
            <MiniRead label="Self Notes" value={String(posture.active_self_notes.length)} tone="candidate" />
            <MiniRead label="Open Loops" value={String(posture.open_commitments.length)} tone={posture.open_commitments.length ? "warn" : "pass"} />
            <MiniRead label="Verify" value={String(posture.verification_needed_items.length)} tone={posture.verification_needed_items.length ? "warn" : "pass"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <TextListPanel title="Memory Posture: Uncertainty" items={posture.uncertainties.slice(0, 5)} empty="No uncertainty has been captured in Memory Posture." />
            <TextListPanel title="Do not recommend without more evidence" items={posture.do_not_recommend_without_more_evidence.slice(0, 5)} empty="No blocked recommendation reminders are active." />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Self Notes</p>
              {posture.active_self_notes.length === 0 ? <p className="mt-2 text-sm text-slate-500">No active self notes.</p> : (
                <div className="mt-3 space-y-3">
                  {posture.active_self_notes.slice(0, 4).map((note) => (
                    <div key={note.note_id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge value={note.note_type} />
                        <Badge value={note.visibility} />
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{note.note_text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Open Commitments</p>
              {posture.open_commitments.length === 0 ? <p className="mt-2 text-sm text-slate-500">No open commitments.</p> : (
                <div className="mt-3 space-y-3">
                  {posture.open_commitments.slice(0, 4).map((commitment) => (
                    <div key={commitment.commitment_id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge value={commitment.status} />
                        <span className="text-xs font-bold text-slate-500">Due {formatDate(commitment.due_at)}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{commitment.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {posture.regional_awareness_summary && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Regional Awareness</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{posture.regional_awareness_summary.pattern_summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge value={posture.regional_awareness_summary.freshness_state} />
                <Badge value={`${posture.regional_awareness_summary.source_property_count} properties`} />
              </div>
            </div>
          )}

          {posture.care_warnings.length > 0 && (
            <TextListPanel title="Care Warnings" items={posture.care_warnings} />
          )}
        </div>
      )}

      <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 lg:grid-cols-2">
        <form onSubmit={props.onSelfNote} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-slate-700">
            <NotebookPen className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.14em]">Add Self Note</p>
          </div>
          <textarea
            value={props.selfNoteText}
            onChange={(event) => props.setSelfNoteText(event.target.value)}
            rows={3}
            placeholder="A bounded reminder for the Captain. Not publishable evidence."
            className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-800"
          />
          <button type="submit" disabled={props.saving || !props.selfNoteText.trim()} className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-[#15284B] px-4 text-sm font-bold text-white disabled:bg-slate-300">
            Save Self Note
          </button>
        </form>
        <form onSubmit={props.onCommitment} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-slate-700">
            <ClipboardCheck className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.14em]">Add Commitment</p>
          </div>
          <textarea
            value={props.commitmentText}
            onChange={(event) => props.setCommitmentText(event.target.value)}
            rows={3}
            placeholder="An open loop to remember without turning it into blame."
            className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-800"
          />
          <button type="submit" disabled={props.saving || !props.commitmentText.trim()} className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-[#15284B] px-4 text-sm font-bold text-white disabled:bg-slate-300">
            Save Commitment
          </button>
        </form>
      </div>
    </Card>
  );
}

function MemoryCandidatePanel({ candidates, propertyCode }: { candidates: CaptainMemoryCandidateRead[]; propertyCode: string }) {
  return (
    <Card title="Captain’s Quarters Candidate Memory" icon={KeyRound} action={<Link className="text-sm font-bold text-[#0057c2]" href={`/captains/${encodeURIComponent(propertyCode)}/memory-candidates`}>Open candidates</Link>}>
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
        Candidate memory is not canonical truth. Promotion is separate and remains governed.
      </div>
      {candidates.length === 0 ? <EmptyState message="No candidate memory has been created for this property yet." /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {candidates.map((candidate) => <MemoryCandidateCard key={candidate.memory_candidate_id} candidate={candidate} />)}
        </div>
      )}
    </Card>
  );
}

function MemoryCandidateCard({ candidate }: { candidate: CaptainMemoryCandidateRead }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black capitalize text-slate-900">{label(candidate.candidate_type)}</p>
        <Badge value={candidate.promotion_state} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <MiniRead label="Confidence" value={numericPercent(candidate.confidence)} tone={candidate.confidence > 0.7 ? "verified" : "claim"} />
        <MiniRead label="Conflict" value={label(candidate.conflict_state)} tone={candidate.conflict_state} />
        <MiniRead label="Expires" value={formatDate(candidate.expires_at)} tone="unknown" />
        <MiniRead label="Verification" value={candidate.verification_required ? "Required" : "Not required"} tone={candidate.verification_required ? "claim" : "verified"} />
      </div>
      <p className="mt-3 font-mono text-[11px] text-slate-500">{shortHash(candidate.source_evidence_hash)}</p>
    </div>
  );
}

function ExpertReadsWorkspace(props: {
  propertyCode: string;
  reads: ExpertReadRead[];
  selectedRead: ExpertReadRead | null;
  loading: boolean;
  onSelect: (expertReadId: string) => void;
  lane: ExpertLaneId;
  setLane: (value: ExpertLaneId) => void;
  reason: string;
  setReason: (value: string) => void;
  runtimeMode: (typeof RUNTIME_MODES)[number];
  latestEvidencePacket: CaptainEvidencePacketRead | null;
  requesting: boolean;
  onRequest: (event: React.FormEvent) => void;
}) {
  return (
    <Card
      title="Expert Reads"
      icon={FileSearch}
      action={<Link className="text-sm font-bold text-[#0057c2]" href={`/captains/${encodeURIComponent(props.propertyCode)}/expert-reads`}>Open Expert Reads</Link>}
    >
      <div className="mb-5 rounded-lg border border-[#B7DFE6] bg-[#EFFAFC] p-4 text-sm font-semibold leading-6 text-[#114C58]">
        Expert Reads are governed specialist contributions from the Consulting Bench. They are not final reports; Fleet Scribe Office remains the publication authority, and Quartermaster source controls remain blocking.
      </div>

      <form onSubmit={props.onRequest} className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Consulting Bench lane</span>
            <select
              value={props.lane}
              onChange={(event) => props.setLane(event.target.value as ExpertLaneId)}
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
            >
              {EXPERT_LANES.map((lane) => <option key={lane.id} value={lane.id}>{lane.label}</option>)}
            </select>
            <p className="text-xs leading-5 text-slate-500">{EXPERT_LANES.find((lane) => lane.id === props.lane)?.purpose}</p>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Governed request reason</span>
            <textarea
              value={props.reason}
              onChange={(event) => props.setReason(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-800"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm leading-6 text-slate-600">
            Uses latest Captain evidence packet <span className="font-mono font-bold">{shortHash(props.latestEvidencePacket?.evidence_hash)}</span> in <span className="font-bold capitalize">{label(props.runtimeMode)}</span> mode.
          </div>
          <button
            type="submit"
            disabled={props.requesting || !props.latestEvidencePacket || !props.reason.trim()}
            className="inline-flex h-11 items-center justify-center rounded-md bg-[#15284B] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {props.requesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Request Expert Read
          </button>
        </div>
      </form>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-3">
          {props.reads.length === 0 ? <EmptyState message="No Expert Reads have been created for this property yet." /> : props.reads.map((read) => (
            <button
              key={read.expert_read_id}
              type="button"
              onClick={() => props.onSelect(read.expert_read_id)}
              className={`w-full rounded-lg border p-4 text-left transition ${props.selectedRead?.expert_read_id === read.expert_read_id ? "border-[#0D5E6D] bg-[#EFFAFC]" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{expertLaneLabel(read.lane_id)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(read.generated_at)} · {label(read.request?.runtime_mode)}</p>
                </div>
                <Badge value={read.read_status} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MiniRead label="Confidence" value={numericPercent(read.confidence)} tone={read.confidence > 0.7 ? "verified" : "warn"} />
                <MiniRead label="Freshness" value={read.freshness_state} tone={read.freshness_state} />
                <MiniRead label="Publication" value={read.publishability} tone={read.publishability} />
              </div>
            </button>
          ))}
        </div>
        <ExpertReadDetail read={props.selectedRead} loading={props.loading} />
      </div>
    </Card>
  );
}

function ExpertReadDetail({ read, loading }: { read: ExpertReadRead | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-slate-200 bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!read) return <EmptyState message="Select an Expert Read to inspect governed findings, recommendations, and lineage." />;
  const hasQuartermasterState = read.lane_id === "quartermaster" || read.read_status === "blocked" || read.publishability === "blocked" || read.freshness_state === "conflicting" || read.conflicts.length > 0;
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Specialist contribution</p>
          <h3 className="mt-1 text-2xl font-black text-[#15284B]">{expertLaneLabel(read.lane_id)}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{read.specialist_summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge value={read.read_status} />
          <Badge value={read.publishability} />
          <Badge value={read.freshness_state} />
        </div>
      </div>

      {hasQuartermasterState && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
          <p className="font-black">Governance visibility</p>
          <p className="mt-1">
            This read contains a blocking, stale, conflicting, or Quartermaster-relevant state. Treat it as governed specialist guidance only; unsupported claims cannot move to Fleet Scribe publication.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <MiniRead label="Confidence" value={numericPercent(read.confidence)} tone={read.confidence > 0.7 ? "verified" : "warn"} />
        <MiniRead label="Escalation" value={read.escalation_required ? "Required" : "Not required"} tone={read.escalation_required ? "blocked" : "pass"} />
        <MiniRead label="Findings" value={String(read.findings.length)} tone="current" />
        <MiniRead label="Recommendations" value={String(read.recommendations.length)} tone={read.recommendations.some((item) => item.publishability === "blocked") ? "blocked" : "current"} />
      </div>

      <GovernedTable
        title="Findings"
        empty="No findings returned by this Expert Read."
        rows={read.findings.map((finding) => ({
          title: `${label(finding.finding_type)} · ${numericPercent(finding.confidence)}`,
          body: finding.statement,
          badges: [finding.freshness, finding.publishability, finding.verification_required ? "verification required" : "verified path"],
          evidence: finding.evidence_refs,
        }))}
      />

      <GovernedTable
        title="Recommendations"
        empty="No recommendations returned by this Expert Read."
        rows={read.recommendations.map((recommendation) => ({
          title: `${label(recommendation.recommendation_type)} · ${label(recommendation.owner_lane)}`,
          body: recommendation.blocked_reason ? `${recommendation.recommendation_text} Blocked reason: ${recommendation.blocked_reason}` : recommendation.recommendation_text,
          badges: [recommendation.publishability, recommendation.proof_metric ? `proof: ${recommendation.proof_metric}` : "proof needed"],
          evidence: recommendation.evidence_refs,
        }))}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <TextListPanel title="Do-not-do guidance" items={read.do_not_do_rules} />
        <TextListPanel title="Conflicts / caveats" items={read.conflicts} empty="No conflicts returned by this Expert Read." />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Evidence and runtime lineage</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <LineageRow label="Evidence packet" value={read.request?.evidence_packet_hash} />
          <LineageRow label="Directive snapshot" value={read.request?.directive_snapshot_hash} />
          <LineageRow label="Expert Read hash" value={read.read_hash} />
          <LineageRow label="Request hash" value={read.request?.request_hash} />
          <LineageRow label="Runtime session" value={read.request?.source_runtime_id} />
          <LineageRow label="Interaction" value={read.request?.source_interaction_id} />
        </div>
      </div>
    </div>
  );
}

function ExpertReadAuthorityPanel({ reads, selectedRead }: { reads: ExpertReadRead[]; selectedRead: ExpertReadRead | null }) {
  const blocked = reads.filter((read) => read.read_status === "blocked" || read.publishability === "blocked").length;
  const stale = reads.filter((read) => read.freshness_state === "stale" || read.freshness_state === "conflicting").length;
  return (
    <Card title="Expert Read Authority" icon={LockKeyhole}>
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          Expert Reads sharpen decisions. They do not publish, mutate Data Pond, or promote memory.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MiniRead label="Total reads" value={String(reads.length)} tone="current" />
          <MiniRead label="Blocked" value={String(blocked)} tone={blocked > 0 ? "blocked" : "pass"} />
          <MiniRead label="Stale/conflict" value={String(stale)} tone={stale > 0 ? "stale" : "pass"} />
          <MiniRead label="Selected lane" value={selectedRead ? expertLaneLabel(selectedRead.lane_id) : "-"} tone={selectedRead?.publishability ?? "unknown"} />
        </div>
        <LineageRow label="Selected read hash" value={selectedRead?.read_hash} />
        <LineageRow label="Evidence hash" value={selectedRead?.request?.evidence_packet_hash} />
      </div>
    </Card>
  );
}

function GovernedTable({ title, rows, empty }: { title: string; rows: Array<{ title: string; body: string; badges: string[]; evidence: string[] }>; empty: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{title}</p>
      {rows.length === 0 ? <p className="mt-2 text-sm text-slate-500">{empty}</p> : (
        <div className="mt-3 space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-black capitalize text-slate-950">{row.title}</p>
                <div className="flex flex-wrap gap-2">{row.badges.map((badge) => <Badge key={badge} value={badge} />)}</div>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{row.body}</p>
              <p className="mt-3 font-mono text-[11px] text-slate-500">Evidence refs: {row.evidence.length > 0 ? row.evidence.join(", ") : "-"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TextListPanel({ title, items, empty = "None returned." }: { title: string; items: string[]; empty?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{title}</p>
      {items.length === 0 ? <p className="mt-2 text-sm text-slate-500">{empty}</p> : (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => <li key={index} className="text-sm font-semibold leading-6 text-slate-700">{item}</li>)}
        </ul>
      )}
    </div>
  );
}

function RuntimeHistoryPanel({ items, propertyCode, expanded }: { items: CaptainOfficeHistoryItem[]; propertyCode: string; expanded?: boolean }) {
  const visible = expanded ? items : items.slice(0, 4);
  return (
    <Card title="Captain’s Log / Runtime Lineage" icon={History} action={!expanded && <Link className="text-sm font-bold text-[#0057c2]" href={`/captains/${encodeURIComponent(propertyCode)}/history`}>Open Captain’s Log</Link>}>
      {visible.length === 0 ? <EmptyState message="No prior runtime interactions are available." /> : (
        <div className="space-y-3">
          {visible.map((item) => (
            <div key={item.interaction_id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black capitalize text-slate-900">{label(item.intent)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(item.timestamp)} · {label(item.runtime_mode)}</p>
                </div>
                <div className="flex gap-2">
                  <Badge value={item.authority_level} />
                  <Badge value={item.publishability} />
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{item.conversational_response ?? item.input_text}</p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <MiniRead label="Directive" value={shortHash((item.directive_snapshot as Record<string, unknown> | null)?.runtime_snapshot_hash)} tone="current" />
                <MiniRead label="Evidence" value={shortHash(item.evidence_packet_hash)} tone="current" />
                <MiniRead label="Response" value={shortHash(item.response_hash)} tone="current" />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function LineageFooter({ state }: { state: CaptainOfficeState | null }) {
  return (
    <Card title="Runtime Lineage" icon={GitBranch}>
      <div className="space-y-3">
        <LineageRow label="Runtime hash" value={state?.runtime_status.runtime_hash} />
        <LineageRow label="Evidence hash" value={state?.runtime_status.evidence_packet_hash} />
        <LineageRow label="Response hash" value={state?.runtime_status.response_hash} />
        <LineageRow label="Directive snapshot" value={(state?.runtime_status.directive_snapshot as Record<string, unknown> | null)?.runtime_snapshot_id} />
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
        This office displays governed runtime lineage. It does not expose raw internal payloads or system prompts.
      </div>
    </Card>
  );
}

function LineageRow({ label: title, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{title}</span>
      <span className="font-mono text-xs text-slate-700">{shortHash(value)}</span>
    </div>
  );
}

function MiniRead({ label: title, value, tone }: { label: string; value: unknown; tone?: unknown }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{title}</p>
      <p className="mt-1 truncate text-sm font-black capitalize text-slate-900">{label(value)}</p>
      <div className="mt-2"><Badge value={tone ?? value} /></div>
    </div>
  );
}

function StructuredList({ title, items, empty = "None returned by the runtime." }: { title: string; items: string[]; empty?: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2 text-sm leading-6 text-slate-700">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-500">
      {message}
    </div>
  );
}

function arrayOfText(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function arrayOfRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];
}
