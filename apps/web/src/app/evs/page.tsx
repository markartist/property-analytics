"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createEvsRequest,
  getEvsProperties,
  getEvsRequests,
  getPondLandscape,
  recordEvsRequestHandoff,
  type EvsExecutionPlan,
  type EvsProperty,
  type EvsRequestRuntimeView,
  type PondLandscapeResponse,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { canPerformOfferingAction, getOfferingActionRole, getRoleTitle } from "@/lib/permissions";
import {
  ArrowRight,
  Compass,
  Loader2,
  Orbit,
  ScanSearch,
  Shield,
  Workflow,
  Activity,
  CheckCircle2,
} from "lucide-react";

const PROFILE_OPTIONS = [
  {
    id: "broad_experiential_homepage",
    label: "Broad Experiential Homepage",
  },
  {
    id: "critical_cta_smoke",
    label: "Critical CTA Smoke",
  },
  {
    id: "header_navigation_integrity",
    label: "Header Navigation Integrity",
  },
  {
    id: "portfolio_functionality_regression",
    label: "Portfolio Functionality Regression",
  },
  {
    id: "apartments_pricing_deep_journey",
    label: "Apartments & Pricing Deep Journey",
  },
  {
    id: "apartments_pricing_mobile_journey",
    label: "Apartments & Pricing Mobile Journey",
  },
  {
    id: "contact_form_checks",
    label: "Contact Form Checks",
  },
  {
    id: "lead_attribution_e2e",
    label: "Lead Attribution E2E",
  },
] as const;

const DEVICE_OPTIONS = [
  { id: "iphone_safari", label: "iPhone Safari" },
  { id: "desktop_chrome", label: "Desktop Chrome" },
] as const;

function toneClasses(alignment: "aligned" | "transitional" | "review"): string {
  if (alignment === "aligned") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (alignment === "transitional") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function trustModeLabel(mode: PondLandscapeResponse["product_surfaces"][number]["evidence"]["expected_zero_trust_mode"]): string {
  switch (mode) {
    case "machine_access":
      return "Machine access";
    case "mixed_access":
      return "Mixed access";
    case "human_access":
      return "Human access";
    case "external_governed":
      return "External governed";
    default:
      return "Local only";
  }
}

function dispatchTone(dispatchState: EvsRequestRuntimeView["dispatch_state"]): string {
  switch (dispatchState) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "executing":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "handoff_recorded":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "cancelled":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function formatDispatchLabel(dispatchState: EvsRequestRuntimeView["dispatch_state"]): string {
  return dispatchState.replace(/_/g, " ");
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export default function EvsPage() {
  const { user } = useAuth();
  const [landscape, setLandscape] = React.useState<PondLandscapeResponse | null>(null);
  const [properties, setProperties] = React.useState<EvsProperty[]>([]);
  const [requests, setRequests] = React.useState<EvsRequestRuntimeView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [handoffingId, setHandoffingId] = React.useState<string | null>(null);
  const [latestPlan, setLatestPlan] = React.useState<EvsExecutionPlan | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [handoffRefs, setHandoffRefs] = React.useState<Record<string, string>>({});
  const [form, setForm] = React.useState({
    property_id: "",
    reason: "",
    priority: "high" as "low" | "normal" | "high" | "urgent",
    execution_mode: "manual" as "manual" | "post_deploy" | "scheduled",
    requested_by: "",
    validation_profiles: ["broad_experiential_homepage"] as Array<(typeof PROFILE_OPTIONS)[number]["id"]>,
    device_profiles: ["iphone_safari", "desktop_chrome"] as Array<(typeof DEVICE_OPTIONS)[number]["id"]>,
  });

  const loadWorkspace = React.useCallback(async () => {
    const [landscapePayload, propertiesPayload, requestsPayload] = await Promise.all([
      getPondLandscape(),
      getEvsProperties(),
      getEvsRequests(),
    ]);
    setLandscape(landscapePayload);
    setProperties(propertiesPayload);
    setRequests(requestsPayload);
    setForm((current) => ({
      ...current,
      property_id: current.property_id || propertiesPayload[0]?.property_id || "",
    }));
  }, []);

  React.useEffect(() => {
    loadWorkspace()
      .then(() => {
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load EVS workspace");
      })
      .finally(() => setLoading(false));
  }, [loadWorkspace]);

  const evs = landscape?.product_surfaces.find((item) => item.id === "evs") ?? null;
  const selectedProperty = properties.find((property) => property.property_id === form.property_id) ?? null;
  const awaitingHandoff = requests.filter((request) => request.dispatch_state === "awaiting_handoff").length;
  const executingCount = requests.filter((request) => request.dispatch_state === "executing").length;
  const canDraftRequests = canPerformOfferingAction(user?.role, "evs", "draft");
  const canRecordHandoff = canPerformOfferingAction(user?.role, "evs", "handoff");
  const draftRoleTitle = getRoleTitle(getOfferingActionRole("evs", "draft"));
  const handoffRoleTitle = getRoleTitle(getOfferingActionRole("evs", "handoff"));

  const handleProfileToggle = (profileId: (typeof PROFILE_OPTIONS)[number]["id"]) => {
    setForm((current) => {
      const exists = current.validation_profiles.includes(profileId);
      if (exists && current.validation_profiles.length === 1) return current;
      return {
        ...current,
        validation_profiles: exists
          ? current.validation_profiles.filter((item) => item !== profileId)
          : [...current.validation_profiles, profileId],
      };
    });
  };

  const handleDeviceToggle = (deviceId: (typeof DEVICE_OPTIONS)[number]["id"]) => {
    setForm((current) => {
      const exists = current.device_profiles.includes(deviceId);
      if (exists && current.device_profiles.length === 1) return current;
      return {
        ...current,
        device_profiles: exists
          ? current.device_profiles.filter((item) => item !== deviceId)
          : [...current.device_profiles, deviceId],
      };
    });
  };

  const handleCreateRequest = async () => {
    if (!selectedProperty || !form.reason.trim()) {
      setStatusMessage("Select a pilot property and enter a concrete validation reason.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = await createEvsRequest({
        source_consumer: "operator",
        property_id: selectedProperty.property_id,
        environment: "staging",
        reason: form.reason.trim(),
        priority: form.priority,
        target_pages: [selectedProperty.staging_url],
        validation_profiles: form.validation_profiles,
        device_profiles: form.device_profiles,
        execution_mode: form.execution_mode,
        trigger_metadata: {
          initiated_from: "evs_bridge",
          governed_bridge: true,
        },
        ...(form.requested_by.trim() ? { requested_by: form.requested_by.trim() } : {}),
      });
      setRequests((current) => [payload.request, ...current]);
      setLatestPlan(payload.execution_plan);
      setStatusMessage(payload.note);
      setForm((current) => ({
        ...current,
        reason: "",
        requested_by: "",
      }));
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to create EVS request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordHandoff = async (requestId: string) => {
    const orchestratorRef = handoffRefs[requestId]?.trim();
    if (!orchestratorRef) {
      setStatusMessage("Add an orchestrator reference before recording EVS handoff.");
      return;
    }

    setHandoffingId(requestId);
    try {
      const payload = await recordEvsRequestHandoff(requestId, {
        orchestrator_ref: orchestratorRef,
        status: "running",
      });
      setRequests((current) =>
        current.map((request) => (request.request_id === requestId ? payload.request : request)),
      );
      setLatestPlan(payload.execution_plan);
      setStatusMessage(payload.note);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to record EVS handoff");
    } finally {
      setHandoffingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!evs) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-slate-900">EVS workspace unavailable</p>
            <p className="mt-1 text-sm text-slate-600">{error ?? "No EVS landscape payload was returned."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8 md:px-10">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-[#15284B] via-[#20314f] to-[#0D5E6D] p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-cyan-200">
              <Compass className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.24em]">Pond Toolbox</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">EVS Workspace</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 md:text-base">
              EVS is now more than a posture bridge. This workspace keeps the mixed human-and-machine validation lane visible,
              lets operators create governed validation requests, and records external orchestration handoff without pretending
              the API already dispatches BrowserStack workflows directly.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Badge className="border-white/15 bg-white/10 text-white">{evs.status}</Badge>
              <Badge className="border-white/15 bg-white/10 text-white">{trustModeLabel(evs.evidence.expected_zero_trust_mode)}</Badge>
              <Badge className="border-white/15 bg-white/10 text-white">{awaitingHandoff} awaiting handoff</Badge>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard icon={Shield} label="Trust Alignment" value={evs.evidence.trust_alignment} />
            <MetricCard icon={Orbit} label="Observed Trust" value={evs.evidence.observed_zero_trust_posture.replace(/_/g, " ")} />
            <MetricCard icon={Workflow} label="Lane Shape" value={trustModeLabel(evs.evidence.expected_zero_trust_mode)} />
            <MetricCard icon={Activity} label="Executing" value={String(executingCount)} />
          </div>
        </div>
      </div>

      {statusMessage ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-slate-700">
          {statusMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Governed request launch</p>
                <p className="mt-1 text-sm text-slate-600">
                  Create a staging-first EVS request here, then hand it off to the external orchestrator with an explicit
                  reference when the runner has accepted it.
                </p>
              </div>
              <Badge variant="outline" className={toneClasses(evs.evidence.trust_alignment)}>
                {evs.evidence.trust_alignment}
              </Badge>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Pilot property</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.property_id}
                  onChange={(e) => setForm((current) => ({ ...current, property_id: e.target.value }))}
                >
                  <option value="">Select property</option>
                  {properties.map((property) => (
                    <option key={property.property_id} value={property.property_id}>
                      {property.property_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Priority</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.priority}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      priority: e.target.value as typeof current.priority,
                    }))
                  }
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Execution mode</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.execution_mode}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      execution_mode: e.target.value as typeof current.execution_mode,
                    }))
                  }
                >
                  <option value="manual">Manual</option>
                  <option value="post_deploy">Post deploy</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Requested by</span>
                <Input
                  placeholder="operator@venterra.com"
                  value={form.requested_by}
                  onChange={(e) => setForm((current) => ({ ...current, requested_by: e.target.value }))}
                />
              </label>
            </div>

            <label className="mt-4 block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Validation reason</span>
              <Textarea
                rows={4}
                placeholder="Describe what changed, what should be validated, and why this request matters."
                value={form.reason}
                onChange={(e) => setForm((current) => ({ ...current, reason: e.target.value }))}
              />
            </label>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Profiles</p>
                <div className="mt-3 space-y-2">
                  {PROFILE_OPTIONS.map((profile) => {
                    const selected = form.validation_profiles.includes(profile.id);
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => handleProfileToggle(profile.id)}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                          selected
                            ? "border-[#0D5E6D] bg-white text-slate-900"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {profile.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Devices</p>
                <div className="mt-3 space-y-2">
                  {DEVICE_OPTIONS.map((device) => {
                    const selected = form.device_profiles.includes(device.id);
                    return (
                      <button
                        key={device.id}
                        type="button"
                        onClick={() => handleDeviceToggle(device.id)}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                          selected
                            ? "border-[#0D5E6D] bg-white text-slate-900"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {device.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedProperty ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">{selectedProperty.property_name}</p>
                <p className="mt-1">Staging target: {selectedProperty.staging_url}</p>
                {selectedProperty.legacy_url ? <p className="mt-1 text-slate-500">Legacy/live reference: {selectedProperty.legacy_url}</p> : null}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={handleCreateRequest} disabled={submitting || !form.property_id || !canDraftRequests}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create EVS Request
              </Button>
              <Button variant="outline" onClick={() => loadWorkspace().catch(() => {})}>
                Refresh Workspace
              </Button>
            </div>
            {!canDraftRequests ? (
              <p className="mt-3 text-sm text-amber-700">
                {draftRoleTitle} access is required to create governed EVS requests. Your current lane is{" "}
                <span className="font-semibold text-slate-900">{getRoleTitle(user?.role ?? "viewer")}</span>.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-slate-900">Execution plan preview</p>
            <p className="mt-1 text-sm text-slate-600">
              The Pond still does not dispatch BrowserStack directly. This panel shows the governed handoff payload the
              external orchestrator should accept.
            </p>

            {latestPlan ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Workflow</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{latestPlan.workflow_name}</p>
                  <p className="mt-1 text-sm text-slate-600">{latestPlan.property.property_name}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Inputs</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    {Object.entries(latestPlan.workflow_inputs).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-3 border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
                        <span className="font-medium text-slate-900">{key}</span>
                        <span className="text-right text-slate-600">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Create a request or record handoff to preview the current governed execution plan.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Request lifecycle board</p>
              <p className="mt-1 text-sm text-slate-600">
                This keeps the lane honest: requested, handed off, executing, or completed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge className="border-amber-200 bg-amber-50 text-amber-700">{awaitingHandoff} awaiting handoff</Badge>
              <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                {requests.filter((request) => request.dispatch_state === "handoff_recorded").length} handoff recorded
              </Badge>
              <Badge className="border-sky-200 bg-sky-50 text-sky-700">{executingCount} executing</Badge>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                {requests.filter((request) => request.dispatch_state === "completed").length} completed
              </Badge>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {requests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                No EVS requests yet. Launch one above to start the governed lifecycle.
              </div>
            ) : (
              requests.map((request) => (
                <div key={request.request_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{properties.find((item) => item.property_id === request.property_id)?.property_name ?? request.property_id}</p>
                        <Badge className={dispatchTone(request.dispatch_state)}>{formatDispatchLabel(request.dispatch_state)}</Badge>
                        <Badge variant="outline" className="border-slate-200 text-slate-600">{request.priority}</Badge>
                        <Badge variant="outline" className="border-slate-200 text-slate-600">{request.execution_mode.replace(/_/g, " ")}</Badge>
                      </div>
                      <p className="text-sm leading-6 text-slate-700">{request.reason}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>Requested {formatDate(request.created_at)}</span>
                        <span>•</span>
                        <span>Status {request.status}</span>
                        {request.orchestrator_ref ? (
                          <>
                            <span>•</span>
                            <span>{request.orchestrator_ref}</span>
                          </>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {request.validation_profiles.map((profile) => (
                          <Badge key={profile} variant="outline" className="border-slate-200 text-slate-600">
                            {profile.replace(/_/g, " ")}
                          </Badge>
                        ))}
                        {request.device_profiles.map((device) => (
                          <Badge key={device} variant="outline" className="border-slate-200 text-slate-600">
                            {device.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {request.dispatch_state === "awaiting_handoff" ? (
                      <div className="w-full max-w-md space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Record orchestrator handoff</p>
                        <Input
                          placeholder="github:evs-browserstack-experiential.yml#42"
                          value={handoffRefs[request.request_id] ?? ""}
                          onChange={(e) =>
                            setHandoffRefs((current) => ({
                              ...current,
                              [request.request_id]: e.target.value,
                            }))
                          }
                        />
                        <Button
                          className="w-full"
                          onClick={() => handleRecordHandoff(request.request_id)}
                          disabled={handoffingId === request.request_id || !canRecordHandoff}
                        >
                          {handoffingId === request.request_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                          Record Handoff
                        </Button>
                        {!canRecordHandoff ? (
                          <p className="text-xs leading-5 text-amber-800">
                            {handoffRoleTitle} access is required to record orchestrator handoff from this workspace.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <p className="font-medium text-slate-900">Lifecycle state</p>
                        <p className="mt-1">
                          {request.dispatch_state === "executing"
                            ? "External orchestrator has been recorded and execution is in progress."
                            : request.dispatch_state === "completed"
                              ? "This request has completed and should now be evaluated from its normalized result."
                              : request.dispatch_state === "failed"
                                ? "Execution reached a terminal failed state."
                                : request.dispatch_state === "handoff_recorded"
                                  ? "Handoff is recorded; execution start is still pending."
                                  : "This request is no longer active."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-slate-900">Trust and remediation</p>
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="outline" className={toneClasses(evs.evidence.trust_alignment)}>
                {evs.evidence.trust_alignment}
              </Badge>
              <span className="text-sm text-slate-600">{evs.evidence.remediation_track.label}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{evs.evidence.remediation_track.status_detail}</p>
            <div className="mt-4 space-y-2">
              {evs.evidence.remediation_track.completion_criteria.map((criterion) => (
                <div key={criterion.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-700">{criterion.label}</p>
                    <Badge className={criterion.met ? "border-0 bg-emerald-100 text-emerald-700" : "border-0 bg-rose-100 text-rose-700"}>
                      {criterion.met ? "Met" : "Open"}
                    </Badge>
                  </div>
                  {criterion.detail ? <p className="mt-1 text-xs text-slate-500">{criterion.detail}</p> : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-slate-900">Operator guidance</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Mixed-lane truth</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Human-authenticated request surfaces and machine-ingest execution are both canonical parts of EVS. This
                  workspace is meant to keep that whole lane visible without flattening specialized BrowserStack work.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Current priority</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{evs.evidence.next_action.detail}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/watchtower" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-[#0D5E6D] hover:text-[#0D5E6D]">
                  Open Watchtower <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/system" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-[#0D5E6D] hover:text-[#0D5E6D]">
                  Open Control Plane <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/vacs" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-[#0D5E6D] hover:text-[#0D5E6D]">
                  Open VACS Bridge <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <p className="text-sm font-semibold text-slate-900">What makes this lane complete enough</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <FutureTile
              icon={ScanSearch}
              title="Request visibility"
              detail="Operators can now create governed requests and see where they sit in the lane."
            />
            <FutureTile
              icon={Workflow}
              title="Honest handoff"
              detail="The Pond records external orchestration explicitly instead of pretending the API already dispatches workflows."
            />
            <FutureTile
              icon={Shield}
              title="Governed posture"
              detail="Trust, bridge inclusion, and mixed-boundary interpretation all stay visible beside the real work."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 text-white">
      <div className="flex items-center gap-2 text-cyan-200">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-[0.22em]">{label}</span>
      </div>
      <p className="mt-3 text-lg font-semibold capitalize">{value}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function FutureTile({ icon: Icon, title, detail }: { icon: React.ElementType; title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-[#0D5E6D]">
        <Icon className="h-4 w-4" />
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}
