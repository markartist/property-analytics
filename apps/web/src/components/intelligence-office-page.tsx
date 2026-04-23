"use client";

import React from "react";
import {
  createCaptainLogEntry,
  createIntelligenceClaim,
  createIntelligenceEvidence,
  linkIntelligenceClaimEvidence,
  createFleetBriefCandidate,
  createIntelligenceAdvocatePrompt,
  createIntelligenceDirective,
  createLedgerCandidate,
  getFleetBrief,
  getFleetBriefs,
  getGovernedMemoryProperties,
  getGovernedMemoryPropertyLog,
  getIntelligenceOffice,
  getLedgerContext,
  updateIntelligenceClaim,
  updateIntelligenceEvidence,
  promoteMemoryCandidate,
  updateIntelligenceDirective,
  updateIntelligenceOffice,
  updateIntelligenceProperty,
  type GovernedMemoryCandidate,
  type GovernedMemoryEntryWithEvidence,
  type GovernedMemoryFleetContext,
  type GovernedMemoryFleetSummary,
  type GovernedMemoryLedgerContext,
  type GovernedMemoryProperty,
  type GovernedMemoryPropertyContext,
  type IntelligenceAdvocatePrompt,
  type BriefReadiness,
  type IntelligenceClaim,
  type IntelligenceEvidence,
  type IntelligenceClaimEvidence,
  type IntelligenceDirective,
  type IntelligenceOfficeProfile,
  type IntelligencePilotProperty,
  type IntelligenceSource,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BookOpenText, CheckCircle2, Loader2, Plus, ShipWheel, XCircle } from "lucide-react";

type Flash = { type: "success" | "error"; text: string } | null;

function formatStamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function parseEvidenceInput(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [evidenceType = "", evidenceSource = "", evidenceRef = "", evidenceExcerpt = ""] = line.split("|").map((part) => part.trim());
      return { evidenceType, evidenceSource, evidenceRef, evidenceExcerpt: evidenceExcerpt || null };
    });
}

function parseStructuredPayload(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed) as Record<string, unknown>;
}

const CAPTAINS_BRIEF_TEMPLATE = `{
  "core_story": "",
  "target_renter_intent": "",
  "proof_points": [],
  "messaging_priorities": [],
  "messaging_guardrails": [],
  "cta_guidance": ""
}`;

const CAPTAINS_BRIEF_FIELDS = [
  { key: "core_story", label: "Core story" },
  { key: "target_renter_intent", label: "Target renter + intent" },
  { key: "proof_points", label: "Proof points" },
  { key: "messaging_priorities", label: "Messaging priorities" },
  { key: "messaging_guardrails", label: "Messaging guardrails" },
  { key: "cta_guidance", label: "CTA guidance" },
];

export function IntelligenceOfficePage() {
  const [loading, setLoading] = React.useState(true);
  const [flash, setFlash] = React.useState<Flash>(null);

  const [office, setOffice] = React.useState<IntelligenceOfficeProfile | null>(null);
  const [directives, setDirectives] = React.useState<IntelligenceDirective[]>([]);
  const [sources, setSources] = React.useState<IntelligenceSource[]>([]);
  const [properties, setProperties] = React.useState<IntelligencePilotProperty[]>([]);
  const [advocatePrompts, setAdvocatePrompts] = React.useState<IntelligenceAdvocatePrompt[]>([]);
  const [claims, setClaims] = React.useState<IntelligenceClaim[]>([]);
  const [evidenceItems, setEvidenceItems] = React.useState<IntelligenceEvidence[]>([]);
  const [claimEvidenceLinks, setClaimEvidenceLinks] = React.useState<IntelligenceClaimEvidence[]>([]);
  const [briefReadiness, setBriefReadiness] = React.useState<Record<string, BriefReadiness>>({});

  const [memoryProperties, setMemoryProperties] = React.useState<GovernedMemoryProperty[]>([]);
  const [fleets, setFleets] = React.useState<GovernedMemoryFleetSummary[]>([]);
  const [propertyContext, setPropertyContext] = React.useState<GovernedMemoryPropertyContext | null>(null);
  const [propertyLog, setPropertyLog] = React.useState<GovernedMemoryEntryWithEvidence[]>([]);
  const [fleetContext, setFleetContext] = React.useState<GovernedMemoryFleetContext | null>(null);
  const [ledgerContext, setLedgerContext] = React.useState<GovernedMemoryLedgerContext | null>(null);

  const [selectedPropertyId, setSelectedPropertyId] = React.useState("");
  const [selectedFleetKey, setSelectedFleetKey] = React.useState("");

  const [officeDraft, setOfficeDraft] = React.useState({
    office_name: "",
    office_label: "",
    mission: "",
    source_of_truth: "",
    operating_model: "",
    naming_rationale: "",
  });

  const [newDirective, setNewDirective] = React.useState({
    category: "search-quality",
    title: "",
    directive_text: "",
    rationale: "",
    status: "active" as "active" | "draft" | "archived",
  });

  const [advocateDraft, setAdvocateDraft] = React.useState({
    prompt_text: "",
    desired_outcome: "",
  });

  const [claimDraft, setClaimDraft] = React.useState({
    property_id: "",
    cohort_key: "",
    claim_text: "",
    source: "intelligence_office" as "intelligence_office" | "derived" | "migration" | "other",
    confidence: "0.8",
    applicable_scope: "property" as "property" | "cohort" | "global",
  });

  const [evidenceDraft, setEvidenceDraft] = React.useState({
    evidence_type: "metric",
    source_system: "Data Pond",
    reference: "",
    summary: "",
    timestamp: "",
  });

  const [claimEvidenceDrafts, setClaimEvidenceDrafts] = React.useState<Record<string, string>>({});
  const [migratingProperties, setMigratingProperties] = React.useState<Record<string, boolean>>({});

  const [captainsLogDraft, setCaptainsLogDraft] = React.useState({
    summary: "",
    sourceSystem: "intelligence_office",
    confidence: "0.8",
    structuredPayload: "",
    evidence: "metric | Data Pond | property snapshot | Supporting source-backed observation",
  });

  const [fleetCandidateDrafts, setFleetCandidateDrafts] = React.useState<Record<string, { rationale: string }>>({});
  const [ledgerCandidateDrafts, setLedgerCandidateDrafts] = React.useState<Record<string, { rationale: string }>>({});

  const refreshOffice = React.useCallback(async () => {
    const [officeData, memoryPropertyList, fleetList, ledger] = await Promise.all([
      getIntelligenceOffice(),
      getGovernedMemoryProperties(),
      getFleetBriefs(),
      getLedgerContext(),
    ]);

    setOffice(officeData.office);
    setOfficeDraft({
      office_name: officeData.office.office_name,
      office_label: officeData.office.office_label,
      mission: officeData.office.mission,
      source_of_truth: officeData.office.source_of_truth,
      operating_model: officeData.office.operating_model,
      naming_rationale: officeData.office.naming_rationale,
    });
    setDirectives(officeData.directives);
    setSources(officeData.sources);
    setProperties(officeData.properties);
    setAdvocatePrompts(officeData.advocatePrompts);
    setClaims(officeData.claims);
    setEvidenceItems(officeData.evidence);
    setClaimEvidenceLinks(officeData.claimEvidence);
    setBriefReadiness(officeData.briefReadiness);
    setMemoryProperties(memoryPropertyList);
    setFleets(fleetList);
    setLedgerContext(ledger);

    const nextPropertyId = selectedPropertyId || memoryPropertyList[0]?.propertyId || "";
    if (nextPropertyId) {
      const propertyData = await getGovernedMemoryPropertyLog(nextPropertyId);
      setSelectedPropertyId(nextPropertyId);
      setPropertyLog(propertyData.entries);
      setPropertyContext(propertyData.context);
      const fleetKey = propertyData.context.fleetKey;
      setSelectedFleetKey(fleetKey);
      setFleetContext(await getFleetBrief(fleetKey));
    }
  }, [selectedPropertyId]);

  React.useEffect(() => {
    refreshOffice()
      .catch((err: Error) => setFlash({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, [refreshOffice]);

  async function loadPropertyMemory(propertyId: string) {
    setSelectedPropertyId(propertyId);
    try {
      const propertyData = await getGovernedMemoryPropertyLog(propertyId);
      setPropertyLog(propertyData.entries);
      setPropertyContext(propertyData.context);
      setSelectedFleetKey(propertyData.context.fleetKey);
      setFleetContext(await getFleetBrief(propertyData.context.fleetKey));
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function loadFleet(fleetKey: string) {
    setSelectedFleetKey(fleetKey);
    try {
      setFleetContext(await getFleetBrief(fleetKey));
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  function evaluateCaptainsBriefCompleteness() {
    const status = { complete: 0, total: CAPTAINS_BRIEF_FIELDS.length };
    const hasSummary = captainsLogDraft.summary.trim().length > 0;
    const payload = (() => {
      try {
        return parseStructuredPayload(captainsLogDraft.structuredPayload || "");
      } catch {
        return null;
      }
    })();
    CAPTAINS_BRIEF_FIELDS.forEach((field) => {
      const value = payload?.[field.key];
      const filled =
        typeof value === "string"
          ? value.trim().length > 0
          : Array.isArray(value)
            ? value.length > 0
            : Boolean(value);
      if (filled) status.complete += 1;
    });
    return { ...status, hasSummary };
  }

  async function saveOffice() {
    try {
      const updated = await updateIntelligenceOffice(officeDraft);
      setOffice(updated);
      setFlash({ type: "success", text: "Intelligence Office updated." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function saveDirective(id: string, body: Partial<IntelligenceDirective>) {
    try {
      const updated = await updateIntelligenceDirective(id, body);
      setDirectives((items) => items.map((item) => (item.id === id ? updated : item)));
      setFlash({ type: "success", text: "Directive updated." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function addDirective() {
    try {
      const created = await createIntelligenceDirective(newDirective);
      setDirectives((items) => [...items, created].sort((a, b) => a.sort_order - b.sort_order));
      setNewDirective({ category: "search-quality", title: "", directive_text: "", rationale: "", status: "active" });
      setFlash({ type: "success", text: "Directive added." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function addClaim() {
    try {
      const created = await createIntelligenceClaim({
        property_id: claimDraft.applicable_scope === "property" ? claimDraft.property_id : null,
        cohort_key: claimDraft.applicable_scope === "cohort" ? claimDraft.cohort_key : null,
        claim_text: claimDraft.claim_text,
        source: claimDraft.source,
        confidence: Number(claimDraft.confidence) || 0.8,
        applicable_scope: claimDraft.applicable_scope,
      });
      setClaims((items) => [created, ...items]);
      setClaimDraft({
        property_id: "",
        cohort_key: "",
        claim_text: "",
        source: "intelligence_office",
        confidence: "0.8",
        applicable_scope: "property",
      });
      setFlash({ type: "success", text: "Claim added." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function updateClaim(id: string, body: Partial<IntelligenceClaim>) {
    try {
      const updated = await updateIntelligenceClaim(id, body);
      setClaims((items) => items.map((item) => (item.id === id ? updated : item)));
      setFlash({ type: "success", text: "Claim updated." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function addEvidence() {
    try {
      const created = await createIntelligenceEvidence({
        evidence_type: evidenceDraft.evidence_type,
        source_system: evidenceDraft.source_system,
        reference: evidenceDraft.reference,
        summary: evidenceDraft.summary,
        timestamp: evidenceDraft.timestamp || null,
      });
      setEvidenceItems((items) => [created, ...items]);
      setEvidenceDraft({
        evidence_type: "metric",
        source_system: "Data Pond",
        reference: "",
        summary: "",
        timestamp: "",
      });
      setFlash({ type: "success", text: "Evidence added." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function updateEvidence(id: string, body: Partial<IntelligenceEvidence>) {
    try {
      const updated = await updateIntelligenceEvidence(id, body);
      setEvidenceItems((items) => items.map((item) => (item.id === id ? updated : item)));
      setFlash({ type: "success", text: "Evidence updated." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function linkEvidenceToClaim(claimId: string) {
    const evidenceId = claimEvidenceDrafts[claimId];
    if (!evidenceId) return;
    try {
      const created = await linkIntelligenceClaimEvidence(claimId, evidenceId);
      setClaimEvidenceLinks((items) => [created, ...items]);
      setClaimEvidenceDrafts((state) => ({ ...state, [claimId]: "" }));
      setFlash({ type: "success", text: "Evidence linked to claim." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function migrateLegacyApprovedPoints(propertyId: string) {
    const migrationCandidates = briefReadiness[propertyId]?.migration_candidates ?? [];
    if (!migrationCandidates.length) return;
    setMigratingProperties((state) => ({ ...state, [propertyId]: true }));
    try {
      const existingClaimTexts = new Set(
        claims
          .filter((claim) => claim.property_id === propertyId && claim.status === "active")
          .map((claim) => claim.claim_text.trim().toLowerCase())
      );
      for (const candidate of migrationCandidates) {
        const normalized = candidate.trim().toLowerCase();
        if (!normalized || existingClaimTexts.has(normalized)) continue;
        await createIntelligenceClaim({
          property_id: propertyId,
          claim_text: candidate.trim(),
          source: "migration",
          confidence: 0.6,
          applicable_scope: "property",
        });
      }
      await refreshOffice();
      const createdCount = migrationCandidates.filter((candidate) => {
        const normalized = candidate.trim().toLowerCase();
        return normalized && !existingClaimTexts.has(normalized);
      }).length;
      setFlash({
        type: "success",
        text: createdCount
          ? `Created ${createdCount} migration claim${createdCount === 1 ? "" : "s"}. Link evidence to activate readiness.`
          : "No new migration claims created. Link evidence to activate readiness.",
      });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    } finally {
      setMigratingProperties((state) => ({ ...state, [propertyId]: false }));
    }
  }

  async function saveProperty(propertyId: string, body: Partial<IntelligencePilotProperty>) {
    try {
      const updated = await updateIntelligenceProperty(propertyId, {
        revised_url: body.revised_url ?? "",
        editorial_focus: body.editorial_focus,
        approved_points: body.approved_points,
        open_questions: body.open_questions,
        advocate_prompt: body.advocate_prompt,
      });
      setProperties((items) => items.map((item) => (item.property_id === propertyId ? updated : item)));
      setFlash({ type: "success", text: "Property intelligence updated." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function addAdvocatePrompt() {
    if (!selectedPropertyId) return;
    try {
      const created = await createIntelligenceAdvocatePrompt({
        property_id: selectedPropertyId,
        prompt_text: advocateDraft.prompt_text,
        desired_outcome: advocateDraft.desired_outcome,
      });
      setAdvocatePrompts((items) => [created, ...items]);
      setAdvocateDraft({ prompt_text: "", desired_outcome: "" });
      setFlash({ type: "success", text: "Advocate instruction captured." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function addCaptainLogEntry() {
    if (!selectedPropertyId) return;
    try {
      const created = await createCaptainLogEntry(selectedPropertyId, {
        summary: captainsLogDraft.summary,
        sourceSystem: captainsLogDraft.sourceSystem,
        confidence: Number(captainsLogDraft.confidence),
        structuredPayload: parseStructuredPayload(captainsLogDraft.structuredPayload),
        evidence: parseEvidenceInput(captainsLogDraft.evidence),
      });
      setPropertyLog((items) => [created, ...items]);
      setCaptainsLogDraft((current) => ({
        ...current,
        summary: "",
        structuredPayload: "",
      }));
      await loadPropertyMemory(selectedPropertyId);
      await refreshLedger();
      setFlash({ type: "success", text: "Captain's Log entry created." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function createFleetCandidate(entryId: string) {
    const draft = fleetCandidateDrafts[entryId] ?? { rationale: "" };
    try {
      await createFleetBriefCandidate(entryId, {
        rationale: draft.rationale || "Promote this governed property memory into the relevant Fleet Brief.",
      });
      if (propertyContext?.fleetKey) {
        await loadFleet(propertyContext.fleetKey);
      }
      await refreshFleetSummaries();
      setFlash({ type: "success", text: "Fleet Brief candidate created." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function createLedgerCandidateFromFleet(entryId: string) {
    const draft = ledgerCandidateDrafts[entryId] ?? { rationale: "" };
    try {
      await createLedgerCandidate(entryId, {
        rationale: draft.rationale || "Promote this validated fleet memory into The Ledger for institutional reuse.",
      });
      await refreshLedger();
      if (selectedFleetKey) {
        await loadFleet(selectedFleetKey);
      }
      setFlash({ type: "success", text: "Ledger candidate created." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function approveCandidate(candidate: GovernedMemoryCandidate) {
    try {
      await promoteMemoryCandidate(candidate.id);
      if (selectedPropertyId) {
        await loadPropertyMemory(selectedPropertyId);
      }
      if (selectedFleetKey) {
        await loadFleet(selectedFleetKey);
      }
      await refreshFleetSummaries();
      await refreshLedger();
      setFlash({ type: "success", text: `${candidate.target_scope === "fleet" ? "Fleet Brief" : "Ledger"} promotion recorded.` });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function refreshFleetSummaries() {
    setFleets(await getFleetBriefs());
  }

  async function refreshLedger() {
    setLedgerContext(await getLedgerContext());
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading Intelligence Office…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <BookOpenText className="h-6 w-6 text-[#0D5E6D]" />
            <h1 className="text-2xl font-bold text-slate-900">Intelligence Office</h1>
          </div>
          <p className="max-w-4xl text-sm leading-6 text-slate-600">
            The governed office behind the content engine. This is where directives, evidence, Captain&apos;s Log entries,
            Fleet Brief promotions, and Ledger approvals stay visible before they shape briefs or copy.
          </p>
        </div>
        {office && (
          <Badge className="border-0 bg-[#15284B]/10 px-3 py-1.5 text-[#15284B]">
            Updated {formatStamp(office.updated_at)}
          </Badge>
        )}
      </div>

      {flash && (
        <div
          className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm ${
            flash.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {flash.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {flash.text}
          <button className="ml-auto text-xs font-semibold uppercase tracking-wide" onClick={() => setFlash(null)}>
            Dismiss
          </button>
        </div>
      )}

      <Tabs defaultValue="office">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="office">Office</TabsTrigger>
          <TabsTrigger value="directives">Directives</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="properties">Pilot Properties</TabsTrigger>
          <TabsTrigger value="advocate">Advocate Console</TabsTrigger>
          <TabsTrigger value="captains-log">Captain&apos;s Log</TabsTrigger>
          <TabsTrigger value="fleet-brief">Fleet Brief</TabsTrigger>
          <TabsTrigger value="ledger">The Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="office" className="mt-4">
          <Card>
            <CardContent className="grid gap-5 p-6 md:grid-cols-2">
              <Field label="Office name" value={officeDraft.office_name} onChange={(value) => setOfficeDraft((d) => ({ ...d, office_name: value }))} />
              <Field label="Presented label" value={officeDraft.office_label} onChange={(value) => setOfficeDraft((d) => ({ ...d, office_label: value }))} />
              <LongField label="Mission" value={officeDraft.mission} onChange={(value) => setOfficeDraft((d) => ({ ...d, mission: value }))} />
              <LongField label="Source of truth" value={officeDraft.source_of_truth} onChange={(value) => setOfficeDraft((d) => ({ ...d, source_of_truth: value }))} />
              <LongField label="Operating model" rows={4} value={officeDraft.operating_model} onChange={(value) => setOfficeDraft((d) => ({ ...d, operating_model: value }))} />
              <LongField label="Naming rationale" value={officeDraft.naming_rationale} onChange={(value) => setOfficeDraft((d) => ({ ...d, naming_rationale: value }))} />
              <div className="md:col-span-2">
                <Button onClick={saveOffice}>Save Office</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="directives" className="mt-4 space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <Field label="Category" value={newDirective.category} onChange={(value) => setNewDirective((d) => ({ ...d, category: value }))} />
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={newDirective.status}
                  onChange={(e) => setNewDirective((d) => ({ ...d, status: e.target.value as "active" | "draft" | "archived" }))}
                >
                  <option value="active">active</option>
                  <option value="draft">draft</option>
                  <option value="archived">archived</option>
                </select>
              </div>
              <Field label="Title" value={newDirective.title} onChange={(value) => setNewDirective((d) => ({ ...d, title: value }))} className="md:col-span-2" />
              <LongField label="Directive text" value={newDirective.directive_text} onChange={(value) => setNewDirective((d) => ({ ...d, directive_text: value }))} />
              <LongField label="Rationale" value={newDirective.rationale} onChange={(value) => setNewDirective((d) => ({ ...d, rationale: value }))} />
              <div className="md:col-span-2">
                <Button onClick={addDirective}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Directive
                </Button>
              </div>
            </CardContent>
          </Card>

          {directives.map((directive) => (
            <Card key={directive.id}>
              <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                <Field label="Category" value={directive.category} onChange={(value) => saveDirective(directive.id, { category: value })} />
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={directive.status}
                    onChange={(e) => saveDirective(directive.id, { status: e.target.value as "active" | "draft" | "archived" })}
                  >
                    <option value="active">active</option>
                    <option value="draft">draft</option>
                    <option value="archived">archived</option>
                  </select>
                </div>
                <Field label="Title" value={directive.title} onChange={(value) => saveDirective(directive.id, { title: value })} className="md:col-span-2" />
                <LongField label="Directive text" value={directive.directive_text} onChange={(value) => saveDirective(directive.id, { directive_text: value })} />
                <LongField label="Rationale" value={directive.rationale} onChange={(value) => saveDirective(directive.id, { rationale: value })} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="sources" className="mt-4">
          <div className="grid gap-4">
            {sources.map((source) => (
              <Card key={source.id}>
                <CardContent className="space-y-2 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-slate-900">{source.title}</p>
                    <Badge className="border-0 bg-slate-100 text-slate-700">{source.source_kind}</Badge>
                  </div>
                  <p className="text-sm text-slate-600">{source.relative_path}</p>
                  <p className="text-sm text-slate-700">{source.summary}</p>
                  <p className="text-sm text-slate-500">{source.evidence_excerpt}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="claims" className="mt-4 space-y-4">
          {Object.keys(briefReadiness).length > 0 && (
            <Card>
              <CardContent className="space-y-2 p-6">
                <p className="text-sm text-slate-600">
                  Claims feed into Captain&apos;s Brief readiness. Evidence‑linked claims are required before a brief
                  can be marked ready.
                </p>
              </CardContent>
            </Card>
          )}
          {properties.some((property) => briefReadiness[property.property_id]?.migration_candidates?.length) && (
            <Card>
              <CardContent className="space-y-2 p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Migration candidates</p>
                <p className="text-sm text-slate-600">
                  Legacy approved points are listed below so you can migrate them into structured claims with
                  `source=migration` and linked evidence.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {properties.map((property) => {
                    const migrationCandidates = briefReadiness[property.property_id]?.migration_candidates ?? [];
                    if (!migrationCandidates.length) return null;
                    return (
                      <div key={property.property_id} className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{property.property_name}</p>
                          <div className="flex items-center gap-2">
                            <Badge className="border-0 bg-slate-100 text-slate-700">{migrationCandidates.length} items</Badge>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={Boolean(migratingProperties[property.property_id])}
                              onClick={() => migrateLegacyApprovedPoints(property.property_id)}
                            >
                              {migratingProperties[property.property_id] ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Migrating…
                                </>
                              ) : (
                                "Create migration claims"
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          {migrationCandidates.map((item) => (
                            <p key={item}>{item}</p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Applicable scope</Label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={claimDraft.applicable_scope}
                  onChange={(e) =>
                    setClaimDraft((draft) => ({ ...draft, applicable_scope: e.target.value as "property" | "cohort" | "global" }))
                  }
                >
                  <option value="property">property</option>
                  <option value="cohort">cohort</option>
                  <option value="global">global</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Property</Label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={claimDraft.property_id}
                  onChange={(e) => setClaimDraft((draft) => ({ ...draft, property_id: e.target.value }))}
                  disabled={claimDraft.applicable_scope !== "property"}
                >
                  <option value="">Select property</option>
                  {properties.map((property) => (
                    <option key={property.property_id} value={property.property_id}>
                      {property.property_name}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Cohort key"
                value={claimDraft.cohort_key}
                onChange={(value) => setClaimDraft((draft) => ({ ...draft, cohort_key: value }))}
                disabled={claimDraft.applicable_scope !== "cohort"}
              />
              <div className="space-y-2">
                <Label>Source</Label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={claimDraft.source}
                  onChange={(e) =>
                    setClaimDraft((draft) => ({
                      ...draft,
                      source: e.target.value as "intelligence_office" | "derived" | "migration" | "other",
                    }))
                  }
                >
                  <option value="intelligence_office">intelligence_office</option>
                  <option value="derived">derived</option>
                  <option value="migration">migration</option>
                  <option value="other">other</option>
                </select>
              </div>
              <Field
                label="Confidence"
                value={claimDraft.confidence}
                onChange={(value) => setClaimDraft((draft) => ({ ...draft, confidence: value }))}
              />
              <LongField
                label="Claim text"
                value={claimDraft.claim_text}
                onChange={(value) => setClaimDraft((draft) => ({ ...draft, claim_text: value }))}
              />
              <div className="md:col-span-2">
                <Button onClick={addClaim}>Add Claim</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {claims.map((claim) => {
              const linkedEvidence = claimEvidenceLinks
                .filter((link) => link.claim_id === claim.id)
                .map((link) => evidenceItems.find((item) => item.id === link.evidence_id))
                .filter(Boolean) as IntelligenceEvidence[];
              const hasLinkedEvidence = linkedEvidence.length > 0;
              return (
                <Card key={claim.id}>
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{claim.claim_text}</p>
                        <p className="text-sm text-slate-500">
                          {claim.applicable_scope} · {claim.source} · confidence {claim.confidence.toFixed(2)}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <select
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={claim.status}
                          onChange={(e) => updateClaim(claim.id, { status: e.target.value as "active" | "archived" })}
                        >
                          <option value="active">active</option>
                          <option value="archived">archived</option>
                        </select>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linked evidence</p>
                      <div className="mt-2 space-y-2">
                        {linkedEvidence.length === 0 ? (
                          <p className="text-sm text-slate-600">No evidence linked yet.</p>
                        ) : (
                          linkedEvidence.map((item) => (
                            <p key={item.id} className="text-sm text-slate-700">
                              {item.evidence_type} · {item.source_system} · {item.reference}
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                    {!hasLinkedEvidence && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        This claim will not count toward brief readiness until evidence is linked.
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <div className="space-y-2">
                        <Label>Attach evidence</Label>
                        <select
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={claimEvidenceDrafts[claim.id] ?? ""}
                          onChange={(e) =>
                            setClaimEvidenceDrafts((state) => ({ ...state, [claim.id]: e.target.value }))
                          }
                        >
                          <option value="">Select evidence</option>
                          {evidenceItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.summary}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <Button onClick={() => linkEvidenceToClaim(claim.id)}>Link Evidence</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {claims.length === 0 && <EmptyCard text="No structured claims created yet." />}
          </div>
        </TabsContent>

        <TabsContent value="evidence" className="mt-4 space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <Field
                label="Evidence type"
                value={evidenceDraft.evidence_type}
                onChange={(value) => setEvidenceDraft((draft) => ({ ...draft, evidence_type: value }))}
              />
              <Field
                label="Source system"
                value={evidenceDraft.source_system}
                onChange={(value) => setEvidenceDraft((draft) => ({ ...draft, source_system: value }))}
              />
              <Field
                label="Reference"
                value={evidenceDraft.reference}
                onChange={(value) => setEvidenceDraft((draft) => ({ ...draft, reference: value }))}
              />
              <Field
                label="Timestamp"
                value={evidenceDraft.timestamp}
                onChange={(value) => setEvidenceDraft((draft) => ({ ...draft, timestamp: value }))}
              />
              <LongField
                label="Summary"
                value={evidenceDraft.summary}
                onChange={(value) => setEvidenceDraft((draft) => ({ ...draft, summary: value }))}
              />
              <div className="md:col-span-2">
                <Button onClick={addEvidence}>Add Evidence</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {evidenceItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="space-y-3 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{item.summary}</p>
                      <p className="text-sm text-slate-500">
                        {item.evidence_type} · {item.source_system} · {item.reference}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <select
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={item.status}
                        onChange={(e) => updateEvidence(item.id, { status: e.target.value as "active" | "archived" })}
                      >
                        <option value="active">active</option>
                        <option value="archived">archived</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {evidenceItems.length === 0 && <EmptyCard text="No evidence captured yet." />}
          </div>
        </TabsContent>

        <TabsContent value="properties" className="mt-4">
          <div className="grid gap-4">
            {properties.map((property) => (
              <Card key={property.property_id}>
                <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                  <Field label="Property" value={property.property_name} onChange={() => undefined} disabled />
                  <Field label="Revised URL" value={property.revised_url ?? ""} onChange={(value) => saveProperty(property.property_id, { revised_url: value })} />
                  <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Captain&apos;s Brief readiness</p>
                    {briefReadiness[property.property_id] ? (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border-0 bg-[#15284B]/10 text-[#15284B]">
                            {briefReadiness[property.property_id].completeness_status}
                          </Badge>
                          <span className="text-sm text-slate-700">
                            {briefReadiness[property.property_id].completeness_score}% complete
                          </span>
                          {briefReadiness[property.property_id].migration_candidates?.length ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="ml-auto"
                              disabled={Boolean(migratingProperties[property.property_id])}
                              onClick={() => migrateLegacyApprovedPoints(property.property_id)}
                            >
                              {migratingProperties[property.property_id] ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Migrating…
                                </>
                              ) : (
                                "Create migration claims"
                              )}
                            </Button>
                          ) : null}
                        </div>
                        <p className="text-sm text-slate-600">
                          Missing: {briefReadiness[property.property_id].missing_components.length
                            ? briefReadiness[property.property_id].missing_components.join(", ")
                            : "none"}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">No readiness data available yet.</p>
                    )}
                  </div>
                  <LongField label="Editorial focus" value={property.editorial_focus} onChange={(value) => saveProperty(property.property_id, { editorial_focus: value })} />
                  <LongField
                    label="Legacy approved points (migration only)"
                    value={property.approved_points}
                    onChange={(value) => saveProperty(property.property_id, { approved_points: value })}
                    helpText="Structured claims now live in the Intelligence Office claim registry. Use this only to stage migration text."
                  />
                  <LongField label="Open questions" value={property.open_questions} onChange={(value) => saveProperty(property.property_id, { open_questions: value })} />
                  <LongField label="Advocate prompt" value={property.advocate_prompt} onChange={(value) => saveProperty(property.property_id, { advocate_prompt: value })} />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="advocate" className="mt-4 space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Property</Label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={selectedPropertyId}
                  onChange={(e) => loadPropertyMemory(e.target.value)}
                >
                  {memoryProperties.map((property) => (
                    <option key={property.propertyId} value={property.propertyId}>
                      {property.propertyName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Desired outcome</Label>
                <Input value={advocateDraft.desired_outcome} onChange={(e) => setAdvocateDraft((d) => ({ ...d, desired_outcome: e.target.value }))} />
              </div>
              <LongField label="Prompt text" value={advocateDraft.prompt_text} onChange={(value) => setAdvocateDraft((d) => ({ ...d, prompt_text: value }))} />
              <div className="md:col-span-2">
                <Button onClick={addAdvocatePrompt}>Capture Advocate Instruction</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {advocatePrompts.map((prompt) => (
              <Card key={prompt.id}>
                <CardContent className="space-y-2 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{prompt.property_id}</p>
                    <Badge className="border-0 bg-slate-100 text-slate-700">{formatStamp(prompt.created_at)}</Badge>
                  </div>
                  <p className="text-sm text-slate-700">{prompt.prompt_text}</p>
                  <p className="text-sm text-slate-500">{prompt.desired_outcome}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="captains-log" className="mt-4 space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Property</Label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={selectedPropertyId}
                  onChange={(e) => loadPropertyMemory(e.target.value)}
                >
                  {memoryProperties.map((property) => (
                    <option key={property.propertyId} value={property.propertyId}>
                      {property.propertyName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Captain identity</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{propertyContext?.identity.display_name ?? "—"}</p>
                <p className="text-sm text-slate-500">{propertyContext?.identity.internal_name ?? ""}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 md:col-span-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Captain&apos;s Brief template</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Use this structured payload so every property has the same brief spine. It becomes the lead signal
                      for the property brief and all derived content.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setCaptainsLogDraft((draft) => ({
                        ...draft,
                        structuredPayload: draft.structuredPayload || CAPTAINS_BRIEF_TEMPLATE,
                      }))
                    }
                  >
                    Insert template
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {CAPTAINS_BRIEF_FIELDS.map((field) => (
                    <Badge key={field.key} className="border-0 bg-slate-100 text-slate-700">
                      {field.label}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {(() => {
                    const status = evaluateCaptainsBriefCompleteness();
                    const filled = status.complete;
                    const total = status.total;
                    if (!captainsLogDraft.structuredPayload.trim()) {
                      return "No structured brief yet. Insert the template and fill each section.";
                    }
                    if (!status.hasSummary) {
                      return `Structured brief progress: ${filled}/${total} fields filled. Add a summary for the Captain's Brief entry.`;
                    }
                    return `Structured brief progress: ${filled}/${total} fields filled.`;
                  })()}
                </div>
              </div>
              <LongField label="Summary" value={captainsLogDraft.summary} onChange={(value) => setCaptainsLogDraft((d) => ({ ...d, summary: value }))} />
              <Field label="Source system" value={captainsLogDraft.sourceSystem} onChange={(value) => setCaptainsLogDraft((d) => ({ ...d, sourceSystem: value }))} />
              <Field label="Confidence" value={captainsLogDraft.confidence} onChange={(value) => setCaptainsLogDraft((d) => ({ ...d, confidence: value }))} />
              <LongField
                label="Structured payload (JSON)"
                rows={4}
                value={captainsLogDraft.structuredPayload}
                onChange={(value) => setCaptainsLogDraft((d) => ({ ...d, structuredPayload: value }))}
              />
              <LongField
                label="Evidence lines"
                rows={4}
                value={captainsLogDraft.evidence}
                onChange={(value) => setCaptainsLogDraft((d) => ({ ...d, evidence: value }))}
                helpText="One per line: type | source | ref | excerpt"
              />
              <div className="md:col-span-2">
                <Button onClick={addCaptainLogEntry}>Add Captain&apos;s Log Entry</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {propertyLog.map(({ entry, evidence, lineage }) => {
              const draft = fleetCandidateDrafts[entry.id] ?? { rationale: "" };
              return (
                <Card key={entry.id}>
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{entry.summary}</p>
                        <p className="text-sm text-slate-500">
                          {entry.source_system} · confidence {entry.confidence.toFixed(2)} · {formatStamp(entry.created_at)}
                        </p>
                      </div>
                      <Badge className="border-0 bg-slate-100 text-slate-700">{entry.status}</Badge>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence</p>
                      <div className="mt-2 space-y-2">
                        {evidence.map((item) => (
                          <p key={item.id} className="text-sm text-slate-700">
                            {item.evidence_type} · {item.evidence_source} · {item.evidence_ref}
                            {item.evidence_excerpt ? ` · ${item.evidence_excerpt}` : ""}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Governed Fleet Brief target</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{propertyContext?.fleetKey ?? "—"}</p>
                      <p className="text-sm text-slate-500">This target is derived from the approved property-to-fleet mapping.</p>
                    </div>
                    {lineage.length > 0 && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lineage</p>
                        <p className="mt-2 text-sm text-slate-700">{lineage.length} upstream lineage records attached.</p>
                      </div>
                    )}
                    <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                      <LongField
                        label="Promotion rationale"
                        value={draft.rationale}
                        onChange={(value) =>
                          setFleetCandidateDrafts((state) => ({ ...state, [entry.id]: { rationale: value } }))
                        }
                      />
                      <div className="flex items-end">
                        <Button onClick={() => createFleetCandidate(entry.id)}>
                          <ShipWheel className="mr-2 h-4 w-4" />
                          Queue Fleet Brief Candidate
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="fleet-brief" className="mt-4 space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label>Fleet</Label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={selectedFleetKey}
                  onChange={(e) => loadFleet(e.target.value)}
                >
                  {fleets.map((fleet) => (
                    <option key={fleet.fleetKey} value={fleet.fleetKey}>
                      {fleet.displayName} ({fleet.propertyCount} properties)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Pending candidates: {fleetContext?.pendingCandidates.length ?? 0}
                </div>
              </div>
            </CardContent>
          </Card>

          <SectionTitle title="Pending Fleet Brief candidates" />
          <div className="grid gap-4">
            {(fleetContext?.pendingCandidates ?? []).map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} onPromote={() => approveCandidate(candidate)} />
            ))}
            {(fleetContext?.pendingCandidates.length ?? 0) === 0 && <EmptyCard text="No pending Fleet Brief candidates for this cohort." />}
          </div>

          <SectionTitle title="Approved Fleet Brief memory" />
          <div className="grid gap-4">
            {(fleetContext?.entries ?? []).map(({ entry, evidence, lineage }) => {
              const draft = ledgerCandidateDrafts[entry.id] ?? { rationale: "" };
              return (
                <Card key={entry.id}>
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{entry.summary}</p>
                        <p className="text-sm text-slate-500">
                          confidence {entry.confidence.toFixed(2)} · {formatStamp(entry.created_at)}
                        </p>
                      </div>
                      <Badge className="border-0 bg-slate-100 text-slate-700">{entry.status}</Badge>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provenance</p>
                      <p className="mt-2 text-sm text-slate-700">{evidence.length} evidence refs · {lineage.length} lineage records</p>
                    </div>
                    <LongField
                      label="Ledger promotion rationale"
                      value={draft.rationale}
                      onChange={(value) => setLedgerCandidateDrafts((state) => ({ ...state, [entry.id]: { rationale: value } }))}
                    />
                    <Button onClick={() => createLedgerCandidateFromFleet(entry.id)}>Queue Ledger Candidate</Button>
                  </CardContent>
                </Card>
              );
            })}
            {(fleetContext?.entries.length ?? 0) === 0 && <EmptyCard text="No Fleet Brief entries promoted yet." />}
          </div>
        </TabsContent>

        <TabsContent value="ledger" className="mt-4 space-y-4">
          <SectionTitle title="Pending Ledger candidates" />
          <div className="grid gap-4">
            {(ledgerContext?.pendingCandidates ?? []).map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} onPromote={() => approveCandidate(candidate)} />
            ))}
            {(ledgerContext?.pendingCandidates.length ?? 0) === 0 && <EmptyCard text="No pending Ledger candidates." />}
          </div>

          <SectionTitle title="Approved institutional memory" />
          <div className="grid gap-4">
            {(ledgerContext?.entries ?? []).map(({ entry, evidence, lineage }) => (
              <Card key={entry.id}>
                <CardContent className="space-y-3 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{entry.summary}</p>
                      <p className="text-sm text-slate-500">
                        confidence {entry.confidence.toFixed(2)} · {formatStamp(entry.created_at)}
                      </p>
                    </div>
                    <Badge className="border-0 bg-[#15284B]/10 text-[#15284B]">The Ledger</Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    Status {entry.status} · {lineage.length} lineage records
                  </p>
                  <div className="space-y-2">
                    {evidence.map((item) => (
                      <p key={item.id} className="text-sm text-slate-700">
                        {item.evidence_type} · {item.evidence_source} · {item.evidence_ref}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            {(ledgerContext?.entries.length ?? 0) === 0 && <EmptyCard text="No approved Ledger entries yet." />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      <Input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function LongField({
  label,
  value,
  onChange,
  rows = 3,
  helpText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  helpText?: string;
}) {
  return (
    <div className="space-y-2 md:col-span-2">
      <Label>{label}</Label>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      {helpText && <p className="text-xs text-slate-500">{helpText}</p>}
    </div>
  );
}

function CandidateCard({
  candidate,
  onPromote,
}: {
  candidate: GovernedMemoryCandidate;
  onPromote: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-slate-900">{candidate.proposed_summary}</p>
            <p className="text-sm text-slate-500">
              {candidate.source_scope} → {candidate.target_scope} · requested {formatStamp(candidate.created_at)}
            </p>
          </div>
          <Badge className="border-0 bg-amber-100 text-amber-800">{candidate.status}</Badge>
        </div>
        <p className="text-sm text-slate-700">{candidate.rationale}</p>
        <Button onClick={onPromote}>Approve Promotion</Button>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <p className="text-lg font-semibold text-slate-900">{title}</p>;
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-slate-600">{text}</CardContent>
    </Card>
  );
}
