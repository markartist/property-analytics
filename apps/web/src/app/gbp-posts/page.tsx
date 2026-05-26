"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  approveGbpDraft,
  generateGbpDrafts,
  getCommunities,
  getGbpDraftDetail,
  getGbpPostPolicy,
  getGbpPostQueue,
  getGbpPostSuggestions,
  recordGbpManualPublicationProof,
  rejectGbpDraft,
  upsertGbpPostPolicy,
  type Community,
  type GbpDraftDetail,
  type GbpDraftQueueItem,
  type GbpPostPolicy,
  type GbpPostSuggestion,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { canPerformOfferingAction, getRoleTitle } from "@/lib/permissions";
import { RestrictedSurfaceCard } from "@/components/shared/restricted-surface-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DraftFormState = {
  availability_summary: string;
  concession_summary: string;
  concession_expires_on: string;
  amenity_highlights: string;
  feature_highlights: string;
  cta_url: string;
  source_label: string;
  notes: string;
  draft_count: string;
  use_captain_context: boolean;
};

type PublicationProofForm = {
  publish_status: "published" | "failed";
  google_post_name: string;
  proof_url: string;
  notes: string;
  published_at: string;
};

const EMPTY_FORM: DraftFormState = {
  availability_summary: "",
  concession_summary: "",
  concession_expires_on: "",
  amenity_highlights: "",
  feature_highlights: "",
  cta_url: "",
  source_label: "",
  notes: "",
  draft_count: "3",
  use_captain_context: true,
};

const EMPTY_PROOF_FORM: PublicationProofForm = {
  publish_status: "published",
  google_post_name: "",
  proof_url: "",
  notes: "",
  published_at: "",
};

export default function GbpPostsPage() {
  const { user, loading: authLoading } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [queue, setQueue] = useState<GbpDraftQueueItem[]>([]);
  const [suggestions, setSuggestions] = useState<GbpPostSuggestion[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [selectedDraft, setSelectedDraft] = useState<GbpDraftDetail | null>(null);
  const [policy, setPolicy] = useState<GbpPostPolicy | null>(null);
  const [form, setForm] = useState<DraftFormState>(EMPTY_FORM);
  const [proofForm, setProofForm] = useState<PublicationProofForm>(EMPTY_PROOF_FORM);
  const [reviewNotes, setReviewNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("draft");
  const canView = canPerformOfferingAction(user?.role, "gbpPosts", "view");
  const canDraft = canPerformOfferingAction(user?.role, "gbpPosts", "draft");
  const canApprove = canPerformOfferingAction(user?.role, "gbpPosts", "approve");
  const canAdminister = canPerformOfferingAction(user?.role, "gbpPosts", "administer");

  if (authLoading) return null;

  if (!canView) {
    return (
      <RestrictedSurfaceCard
        title="GBP Posts is curator-only"
        description="This governed local-posting lane is intended for curators and stewards handling property posting operations. Observers should use governed reports instead of editing post workflows."
      />
    );
  }

  useEffect(() => {
    async function load() {
      try {
        const [communitiesData, queueData] = await Promise.all([
          getCommunities(),
          getGbpPostQueue({ status: "draft" }),
        ]);
        setCommunities(communitiesData);
        setQueue(queueData);
        const initialCommunity = queueData[0]?.community_id ?? communitiesData[0]?.id ?? "";
        setSelectedCommunityId(initialCommunity);
        setSelectedDraftId(queueData[0]?.id ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load GBP post workspace");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    if (!selectedCommunityId || !canView) return;
    void getGbpPostSuggestions({ community_id: selectedCommunityId, limit: 3 })
      .then((items) => setSuggestions(items))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load suggestions"));
  }, [selectedCommunityId, canView]);

  useEffect(() => {
    if (!selectedCommunityId) return;
    void getGbpPostPolicy(selectedCommunityId)
      .then((next) => setPolicy(next))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load policy"));
  }, [selectedCommunityId]);

  useEffect(() => {
    if (!selectedDraftId) {
      setSelectedDraft(null);
      return;
    }
    void getGbpDraftDetail(selectedDraftId)
      .then((detail) => setSelectedDraft(detail))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load draft detail"));
  }, [selectedDraftId]);

  const filteredQueue = useMemo(
    () => queue.filter((item) => !selectedCommunityId || item.community_id === selectedCommunityId),
    [queue, selectedCommunityId]
  );

  async function refreshQueue(nextStatus = statusFilter) {
    const items = await getGbpPostQueue(nextStatus ? { status: nextStatus } : {});
    setQueue(items);
    if (selectedDraftId && !items.find((item) => item.id === selectedDraftId)) {
      setSelectedDraftId(items[0]?.id ?? "");
    }
  }

  async function handleGenerate() {
    if (!selectedCommunityId) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        availability_summary: form.availability_summary || undefined,
        concession_summary: form.concession_summary || undefined,
        concession_expires_on: form.concession_expires_on || undefined,
        amenity_highlights: splitList(form.amenity_highlights),
        feature_highlights: splitList(form.feature_highlights),
        cta_url: form.cta_url || undefined,
        source_label: form.source_label || undefined,
        notes: form.notes || undefined,
        draft_count: Number(form.draft_count || "3"),
        use_captain_context: form.use_captain_context,
      };
      const result = await generateGbpDrafts(selectedCommunityId, payload);
      await refreshQueue("draft");
      setStatusFilter("draft");
      setSelectedDraftId(result.drafts?.[0]?.id ?? "");
      setReviewNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate drafts");
    } finally {
      setBusy(false);
    }
  }

  async function handlePolicySave() {
    if (!selectedCommunityId || !policy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await upsertGbpPostPolicy(selectedCommunityId, policy);
      setPolicy(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save policy");
    } finally {
      setBusy(false);
    }
  }

  async function handleDecision(action: "approve" | "reject") {
    if (!selectedDraftId) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "approve") {
        await approveGbpDraft(selectedDraftId, reviewNotes || undefined);
      } else {
        await rejectGbpDraft(selectedDraftId, reviewNotes || undefined);
      }
      const detail = await getGbpDraftDetail(selectedDraftId);
      setSelectedDraft(detail);
      await refreshQueue(statusFilter);
      setReviewNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} draft`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRecordProof() {
    if (!selectedDraftId) return;
    setBusy(true);
    setError(null);
    try {
      await recordGbpManualPublicationProof(selectedDraftId, {
        publish_status: proofForm.publish_status,
        google_post_name: proofForm.google_post_name || undefined,
        proof_url: proofForm.proof_url || undefined,
        notes: proofForm.notes || undefined,
        published_at: proofForm.published_at || undefined,
      });
      const detail = await getGbpDraftDetail(selectedDraftId);
      setSelectedDraft(detail);
      await refreshQueue(proofForm.publish_status);
      setStatusFilter(proofForm.publish_status);
      setProofForm(EMPTY_PROOF_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record posting proof");
    } finally {
      setBusy(false);
    }
  }

  function handlePrepareSuggestion(suggestion: GbpPostSuggestion) {
    setSelectedCommunityId(suggestion.community_id);
    setForm((prev) => ({
      ...prev,
      source_label: suggestion.draft_seed.source_label,
      notes: suggestion.draft_seed.notes,
      draft_count: String(suggestion.draft_seed.draft_count),
      use_captain_context: suggestion.draft_seed.use_captain_context,
    }));
  }

  if (loading) {
    return <div className="p-8 text-slate-600">Loading GBP post workspace…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">GBP Posts</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Build property-grounded Google Business Profile drafts from Data Pond signals, live feed inputs, and PIB-derived context without touching locked PIB rendering.
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{getRoleTitle(user?.role ?? "viewer")} lane</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{queue.filter((item) => item.status === "draft").length} drafts</Badge>
          <Badge variant="outline">{queue.filter((item) => item.status === "approved").length} approved</Badge>
          <Badge variant="outline">{queue.filter((item) => item.status === "published").length} published</Badge>
          <Badge variant="outline">{queue.filter((item) => item.status === "rejected").length} rejected</Badge>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-800">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Draft Builder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Property">
                  <select
                    value={selectedCommunityId}
                    onChange={(e) => setSelectedCommunityId(e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  >
                    <option value="">Select a property</option>
                    {communities.map((community) => (
                      <option key={community.id} value={community.id}>
                        {community.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Draft Count">
                  <input
                    value={form.draft_count}
                    onChange={(e) => setForm((prev) => ({ ...prev, draft_count: e.target.value }))}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  />
                </Field>
              </div>

              <label className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold text-emerald-950">Use Captain Context</span>
                  <span className="mt-0.5 block text-xs text-emerald-800">
                    Include active Captain watch items, actions, and latest Brief run in the source snapshot.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.use_captain_context}
                  onChange={(e) => setForm((prev) => ({ ...prev, use_captain_context: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>

              <Field label="Availability Summary">
                <textarea
                  value={form.availability_summary}
                  onChange={(e) => setForm((prev) => ({ ...prev, availability_summary: e.target.value }))}
                  className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Studios and two-bedrooms available now..."
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Concession Summary">
                  <textarea
                    value={form.concession_summary}
                    onChange={(e) => setForm((prev) => ({ ...prev, concession_summary: e.target.value }))}
                    className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Up to one month free on select homes"
                  />
                </Field>
                <Field label="Concession Expires On">
                  <input
                    type="date"
                    value={form.concession_expires_on}
                    onChange={(e) => setForm((prev) => ({ ...prev, concession_expires_on: e.target.value }))}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Amenity Highlights">
                  <textarea
                    value={form.amenity_highlights}
                    onChange={(e) => setForm((prev) => ({ ...prev, amenity_highlights: e.target.value }))}
                    className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="resort-style pool, co-working lounge, fitness center"
                  />
                </Field>
                <Field label="Feature Highlights">
                  <textarea
                    value={form.feature_highlights}
                    onChange={(e) => setForm((prev) => ({ ...prev, feature_highlights: e.target.value }))}
                    className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="studios, one-bedrooms, fenced yards"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="CTA URL">
                  <input
                    value={form.cta_url}
                    onChange={(e) => setForm((prev) => ({ ...prev, cta_url: e.target.value }))}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    placeholder="https://..."
                  />
                </Field>
                <Field label="Source Label">
                  <input
                    value={form.source_label}
                    onChange={(e) => setForm((prev) => ({ ...prev, source_label: e.target.value }))}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    placeholder="Live feed 9 AM sync"
                  />
                </Field>
              </div>

              <Field label="Internal Notes">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Optional reviewer notes or campaign context"
                />
              </Field>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleGenerate} disabled={busy || !selectedCommunityId || !canDraft}>
                  {busy ? "Working…" : "Generate Drafts"}
                </Button>
                <Button variant="outline" onClick={() => setForm(EMPTY_FORM)} disabled={busy}>
                  Reset Form
                </Button>
              </div>
              {!canDraft && <p className="text-sm text-amber-700">Curator access is required to generate governed GBP drafts.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Suggested Posts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {suggestions.length === 0 ? (
                <p className="text-sm text-slate-500">No Captain-backed GBP suggestions for this property yet.</p>
              ) : (
                suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-emerald-200 bg-white text-emerald-800">Priority {suggestion.priority}</Badge>
                      <Badge variant="outline">{suggestion.angle}</Badge>
                      <Badge variant="outline">{suggestion.recommended_channel}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-emerald-950">{suggestion.reason}</p>
                    {suggestion.source_evidence.length > 0 && (
                      <p className="mt-2 text-xs text-emerald-800">{suggestion.source_evidence[0]}</p>
                    )}
                    <Button className="mt-3" variant="outline" onClick={() => handlePrepareSuggestion(suggestion)} disabled={!canDraft}>
                      Prepare Draft
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl">Policy</CardTitle>
                <Button variant="outline" onClick={handlePolicySave} disabled={busy || !policy || !selectedCommunityId || !canAdminister}>
                  Save Policy
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!policy ? (
                <p className="text-sm text-slate-500">Select a property to load policy controls.</p>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ToggleField
                      label="Approval Required"
                      checked={policy.approval_required}
                      onChange={(checked) => setPolicy((prev) => prev ? { ...prev, approval_required: checked } : prev)}
                    />
                    <ToggleField
                      label="Allow Amenity Posts"
                      checked={policy.allow_amenity_posts}
                      onChange={(checked) => setPolicy((prev) => prev ? { ...prev, allow_amenity_posts: checked } : prev)}
                    />
                    <ToggleField
                      label="Allow Offer Posts"
                      checked={policy.allow_offer_posts}
                      onChange={(checked) => setPolicy((prev) => prev ? { ...prev, allow_offer_posts: checked } : prev)}
                    />
                    <ToggleField
                      label="Allow Event Posts"
                      checked={policy.allow_event_posts}
                      onChange={(checked) => setPolicy((prev) => prev ? { ...prev, allow_event_posts: checked } : prev)}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Cooldown Days">
                      <input
                        value={String(policy.cooldown_days)}
                        onChange={(e) => setPolicy((prev) => prev ? { ...prev, cooldown_days: Number(e.target.value || "7") } : prev)}
                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                      />
                    </Field>
                    <Field label="Max Drafts Per Run">
                      <input
                        value={String(policy.max_drafts_per_run)}
                        onChange={(e) => setPolicy((prev) => prev ? { ...prev, max_drafts_per_run: Number(e.target.value || "3") } : prev)}
                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                      />
                    </Field>
                  </div>
                  <Field label="Blocked Terms">
                    <textarea
                      value={policy.blocked_terms.join(", ")}
                      onChange={(e) => setPolicy((prev) => prev ? { ...prev, blocked_terms: splitList(e.target.value) } : prev)}
                      className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="luxury, guaranteed, best"
                    />
                  </Field>
                </>
              )}
              {!canAdminister && <p className="text-sm text-amber-700">Steward access is required to change posting policy.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl">Draft Queue</CardTitle>
                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={async (e) => {
                      const next = e.target.value;
                      setStatusFilter(next);
                      await refreshQueue(next);
                    }}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                    <option value="published">Published</option>
                    <option value="failed">Failed</option>
                    <option value="rejected">Rejected</option>
                    <option value="">All</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredQueue.length === 0 ? (
                <p className="text-sm text-slate-500">No drafts in this queue yet.</p>
              ) : (
                filteredQueue.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedDraftId(item.id)}
                    className={`w-full rounded-lg border p-4 text-left transition ${selectedDraftId === item.id ? "border-[#0D5E6D] bg-[#F0FAFB]" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{item.community_name}</p>
                      <Badge variant="outline">{item.post_type}</Badge>
                      <Badge variant="outline">{item.angle}</Badge>
                      <Badge variant={item.status === "approved" || item.status === "published" ? "default" : item.status === "rejected" || item.status === "failed" ? "destructive" : "secondary"}>
                        {item.status}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-slate-700">{item.rendered_text}</p>
                    {(item.validation?.warnings?.length ?? 0) > 0 && (
                      <p className="mt-2 text-xs text-amber-700">
                        Warning: {item.validation.warnings?.[0]}
                      </p>
                    )}
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Draft Detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedDraft ? (
                <p className="text-sm text-slate-500">Select a draft to review payload, source facts, and approval actions.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{String(selectedDraft.draft.post_type ?? "STANDARD")}</Badge>
                    <Badge variant="outline">{String(selectedDraft.draft.angle ?? "draft")}</Badge>
                    <Badge variant={String(selectedDraft.draft.status) === "approved" || String(selectedDraft.draft.status) === "published" ? "default" : String(selectedDraft.draft.status) === "rejected" || String(selectedDraft.draft.status) === "failed" ? "destructive" : "secondary"}>
                      {String(selectedDraft.draft.status)}
                    </Badge>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm leading-6 text-slate-800">{selectedDraft.draft.rendered_text}</p>
                  </div>

                  <CaptainContextPanel value={selectedDraft.source_snapshot.payload} />

                  <div className="grid gap-4 md:grid-cols-2">
                    <JsonBlock title="Publish Payload" value={selectedDraft.draft.payload} />
                    <JsonBlock title="Source Snapshot" value={selectedDraft.source_snapshot.payload} />
                  </div>

                  <JsonBlock title="Validation" value={selectedDraft.draft.validation} />

                  <Field label="Review Notes">
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Optional approval or rejection note"
                    />
                  </Field>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => void handleDecision("approve")} disabled={busy || String(selectedDraft.draft.status) === "approved" || !canApprove}>
                      Approve Draft
                    </Button>
                    <Button variant="destructive" onClick={() => void handleDecision("reject")} disabled={busy || String(selectedDraft.draft.status) === "rejected" || !canApprove}>
                      Reject Draft
                    </Button>
                  </div>
                  {!canApprove && <p className="text-sm text-amber-700">Curator access is required to approve or reject governed drafts.</p>}

                  <PublicationProofPanel
                    draftStatus={String(selectedDraft.draft.status)}
                    publications={selectedDraft.publications ?? []}
                    proofForm={proofForm}
                    setProofForm={setProofForm}
                    onRecordProof={() => void handleRecordProof()}
                    disabled={busy || !canApprove}
                  />

                  {selectedDraft.reviews.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-slate-700">Review History</h3>
                      {selectedDraft.reviews.map((review) => (
                        <div key={review.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant={review.decision === "approve" ? "default" : "destructive"}>{review.decision}</Badge>
                            <span className="text-slate-500">{new Date(review.created_at).toLocaleString()}</span>
                          </div>
                          {review.notes && <p className="mt-2 text-slate-700">{review.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function PublicationProofPanel({
  draftStatus,
  publications,
  proofForm,
  setProofForm,
  onRecordProof,
  disabled,
}: {
  draftStatus: string;
  publications: GbpDraftDetail["publications"];
  proofForm: PublicationProofForm;
  setProofForm: (next: PublicationProofForm) => void;
  onRecordProof: () => void;
  disabled: boolean;
}) {
  const canRecord = ["approved", "published", "failed"].includes(draftStatus);

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Posting Proof</h3>
          <p className="mt-1 text-sm text-slate-500">Record manual GBP posting proof after approval. Direct Google API publishing can plug into this same ledger later.</p>
        </div>
        <Badge variant={publications.some((item) => item.publish_status === "published") ? "default" : "outline"}>
          {publications.length ? `${publications.length} proof item${publications.length === 1 ? "" : "s"}` : "No proof"}
        </Badge>
      </div>

      {publications.length > 0 && (
        <div className="mt-4 space-y-2">
          {publications.slice(0, 3).map((publication) => {
            const proofUrl = typeof publication.response?.proof_url === "string" ? publication.response.proof_url : null;
            return (
              <div key={publication.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={publication.publish_status === "published" ? "default" : publication.publish_status === "failed" ? "destructive" : "secondary"}>
                    {publication.publish_status}
                  </Badge>
                  <span className="text-slate-500">{new Date(publication.created_at).toLocaleString()}</span>
                </div>
                {publication.google_post_name && <p className="mt-2 text-slate-700">{publication.google_post_name}</p>}
                {proofUrl && (
                  <a href={proofUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-[#0D5E6D] hover:underline">
                    Open proof
                  </a>
                )}
                {publication.error_message && <p className="mt-2 text-sm text-red-700">{publication.error_message}</p>}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {!canRecord && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Approve this draft before recording posting proof.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Proof Status">
            <select
              value={proofForm.publish_status}
              onChange={(e) => setProofForm({ ...proofForm, publish_status: e.target.value as PublicationProofForm["publish_status"] })}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              disabled={!canRecord || disabled}
            >
              <option value="published">Posted Manually</option>
              <option value="failed">Posting Failed</option>
            </select>
          </Field>
          <Field label="Posted At">
            <input
              type="datetime-local"
              value={proofForm.published_at}
              onChange={(e) => setProofForm({ ...proofForm, published_at: e.target.value })}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              disabled={!canRecord || disabled || proofForm.publish_status === "failed"}
            />
          </Field>
        </div>
        <Field label="Google Post Name Or URL">
          <input
            value={proofForm.google_post_name}
            onChange={(e) => setProofForm({ ...proofForm, google_post_name: e.target.value })}
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            placeholder="locations/.../localPosts/... or live post URL"
            disabled={!canRecord || disabled}
          />
        </Field>
        <Field label="Proof URL">
          <input
            value={proofForm.proof_url}
            onChange={(e) => setProofForm({ ...proofForm, proof_url: e.target.value })}
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            placeholder="https://..."
            disabled={!canRecord || disabled}
          />
        </Field>
        <Field label="Proof Notes">
          <textarea
            value={proofForm.notes}
            onChange={(e) => setProofForm({ ...proofForm, notes: e.target.value })}
            className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Where it was posted, who posted it, or why posting failed"
            disabled={!canRecord || disabled}
          />
        </Field>
        <div>
          <Button onClick={onRecordProof} disabled={!canRecord || disabled}>
            Record Posting Proof
          </Button>
        </div>
      </div>
    </div>
  );
}

function CaptainContextPanel({ value }: { value: Record<string, unknown> }) {
  const captain = value.captain as
    | {
        latest_brief_created_at?: string | null;
        active_watch_count?: number;
        active_action_count?: number;
        recommended_angles?: string[];
        primary_directive?: string | null;
        top_actions?: Array<{ title?: string; owner_role?: string | null; due_date?: string | null }>;
        top_watch_items?: Array<{ title?: string; next_move?: string | null }>;
        source_note?: string;
      }
    | undefined;

  if (!captain) return null;

  const hasCaptainSignal = Boolean(
    captain.primary_directive ||
      captain.active_action_count ||
      captain.active_watch_count ||
      captain.recommended_angles?.length
  );

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-emerald-950">Captain Context</p>
        <Badge variant="outline">{captain.active_watch_count ?? 0} watch</Badge>
        <Badge variant="outline">{captain.active_action_count ?? 0} actions</Badge>
        {captain.latest_brief_created_at && (
          <Badge variant="outline">Brief {new Date(captain.latest_brief_created_at).toLocaleDateString()}</Badge>
        )}
      </div>
      {hasCaptainSignal ? (
        <>
          {captain.primary_directive && (
            <p className="mt-3 text-sm leading-6 text-emerald-900">{captain.primary_directive}</p>
          )}
          {(captain.recommended_angles?.length ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {captain.recommended_angles?.map((angle) => (
                <Badge key={angle} className="border-emerald-200 bg-white text-emerald-800">
                  {angle}
                </Badge>
              ))}
            </div>
          )}
          {(captain.top_actions?.length ?? 0) > 0 && (
            <div className="mt-3 space-y-1">
              {captain.top_actions?.slice(0, 2).map((action) => (
                <p key={action.title} className="text-xs text-emerald-800">
                  Action: {action.title}
                  {action.owner_role ? ` · ${action.owner_role}` : ""}
                  {action.due_date ? ` · due ${action.due_date}` : ""}
                </p>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-emerald-800">No active Captain runtime guidance was found for this property.</p>
      )}
      {captain.source_note && <p className="mt-3 text-xs text-emerald-700">{captain.source_note}</p>}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-slate-200">
      <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">{title}</div>
      <pre className="overflow-x-auto p-4 text-xs leading-5 text-slate-700">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
