"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCommunities, generateSearchIntelligenceReport, type Community, type SearchIntelligenceResponse } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { canPerformOfferingAction, getRoleTitle } from "@/lib/permissions";
import { RestrictedSurfaceCard } from "@/components/shared/restricted-surface-card";
import { Download, Loader2, Mail, Search } from "lucide-react";

function downloadBase64File(base64: string, filename: string, mime: string) {
  const byteString = atob(base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SearchIntelligenceBuilderPage() {
  const { user, loading: authLoading } = useAuth();
  const [communities, setCommunities] = React.useState<Community[]>([]);
  const [communityId, setCommunityId] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [data, setData] = React.useState<SearchIntelligenceResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const canView = canPerformOfferingAction(user?.role, "searchIntelligence", "view");
  const canDraft = canPerformOfferingAction(user?.role, "searchIntelligence", "draft");

  if (authLoading) return null;

  if (!canView) {
    return (
      <RestrictedSurfaceCard
        title="Search Intelligence is curator-only"
        description="This governed search brief builder is intended for curators and stewards working directly in search strategy. Observers should use governed reports and the Dock instead."
      />
    );
  }

  React.useEffect(() => {
    getCommunities()
      .then((rows) => setCommunities(rows.filter((c) => c.status !== "inactive")))
      .catch(() => setError("Failed to load communities"))
      .finally(() => setLoading(false));
  }, []);

  async function runReport() {
    if (!communityId) {
      setError("Select a property first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const res = await generateSearchIntelligenceReport({
        community_id: communityId,
        email: email.trim() || undefined,
      });
      setData(res);
      if (email.trim()) {
        setStatus(res.email_sent ? `Report emailed to ${email.trim()} with HTML, Markdown, and JSON attachments.` : (res.email_error || "Report generated, but email failed."));
      } else {
        setStatus("Report generated. Preview is ready and companion downloads are available.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8 md:px-12">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#15284B]">Search Intelligence Builder</h1>
          <p className="mt-2 text-slate-600">Generate a versioned single-property keyword and competitor brief, then preview or email it from Data Pond.</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{getRoleTitle(user?.role ?? "viewer")} lane</p>
        </div>

        <Card>
          <CardContent className="space-y-5 p-6">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading properties...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Property</label>
                    <select
                      value={communityId}
                      onChange={(e) => setCommunityId(e.target.value)}
                      className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                    >
                      <option value="">Select a property</option>
                      {communities.map((community) => (
                        <option key={community.id} value={community.id}>{community.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email Recipient</label>
                    <Input type="email" placeholder="name@venterraliving.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={runReport} disabled={submitting || !canDraft}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Generate and Send
                  </Button>
                  {data && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => downloadBase64File(data.html_base64, data.html_filename, "text/html")}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download HTML
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => downloadBase64File(data.markdown_base64, data.markdown_filename, "text/markdown")}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Markdown
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => downloadBase64File(data.json_base64, data.json_filename, "application/json")}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download JSON
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {status && <p className="text-sm text-emerald-700">{status}</p>}
            {!canDraft && <p className="text-sm text-amber-700">Curator access is required to generate and send governed search briefs.</p>}
          </CardContent>
        </Card>

        {data && (
          <>
            <Card>
              <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Property</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{data.community.name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Version</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">v{data.version}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top Gap</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{data.summary.top_gap ?? "None surfaced"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Competitors Used</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{data.summary.competitors_used}</p>
                </div>
              </CardContent>
            </Card>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Report Preview</h2>
                  <p className="text-xs text-slate-500">HTML preview of the Search Intelligence brief</p>
                </div>
                <Search className="h-5 w-5 text-slate-300" />
              </div>
              <Card>
                <CardContent className="p-0">
                  <iframe
                    title="Search Intelligence Preview"
                    srcDoc={data.report_html}
                    className="min-h-[1400px] w-full rounded-b-lg border-0"
                  />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
