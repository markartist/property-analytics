"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCommunities, type Community } from "@/lib/api";
import { FileText, Loader2 } from "lucide-react";

export default function AnalysisPibBuilderPage() {
  const router = useRouter();
  const [scope, setScope] = React.useState<"portfolio" | "property">("portfolio");
  const [communityId, setCommunityId] = React.useState("");
  const [communities, setCommunities] = React.useState<Community[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getCommunities()
      .then((rows) => setCommunities(rows.filter((c) => c.status !== "inactive")))
      .catch(() => setError("Failed to load communities"))
      .finally(() => setLoading(false));
  }, []);

  const openPib = () => {
    if (scope === "portfolio") {
      router.push("/pib");
      return;
    }
    if (!communityId) {
      setError("Select a property first.");
      return;
    }
    router.push(`/pib/property?id=${encodeURIComponent(communityId)}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8 md:px-12">
      <div className="mx-auto max-w-[960px] space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#15284B]">PIB Builder</h1>
          <p className="mt-2 text-slate-600">Route to canonical PIB views without changing PIB rendering logic.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Build Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading properties...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">PIB Scope</label>
                    <div className="mt-2 flex items-center gap-6 text-sm">
                      <label className="flex items-center gap-2">
                        <input type="radio" checked={scope === "portfolio"} onChange={() => setScope("portfolio")} />
                        Portfolio
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" checked={scope === "property"} onChange={() => setScope("property")} />
                        Single Property
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Property</label>
                    <select
                      disabled={scope !== "property"}
                      value={communityId}
                      onChange={(e) => setCommunityId(e.target.value)}
                      className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">Select a property</option>
                      {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button onClick={openPib}>
                    <FileText className="mr-2 h-4 w-4" />
                    Open PIB
                  </Button>
                  <p className="text-xs text-slate-500">Uses canonical PIB pages at `/pib` and `/pib/property`.</p>
                </div>
              </>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
