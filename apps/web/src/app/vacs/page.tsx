"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPondLandscape, type PondLandscapeResponse } from "@/lib/api";
import { Bot, Loader2, Shield, Orbit, FileText, ArrowRight, BrainCircuit } from "lucide-react";

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

export default function VacsPage() {
  const [landscape, setLandscape] = React.useState<PondLandscapeResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getPondLandscape()
      .then((payload) => {
        setLandscape(payload);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load VACS control-plane data");
      })
      .finally(() => setLoading(false));
  }, []);

  const vacs = landscape?.product_surfaces.find((item) => item.id === "vacs") ?? null;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!vacs) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-slate-900">VACS bridge unavailable</p>
            <p className="mt-1 text-sm text-slate-600">{error ?? "No VACS landscape payload was returned."}</p>
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
              <Bot className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.24em]">Pond Toolbox</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">VACS Bridge</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 md:text-base">
              A governed bridge into VACS from The Pond. This is the right place to understand the machine contract,
              shared foundations, trust posture, and where VACS fits in content operations without pretending it is
              already a broad human-facing workspace.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Badge className="border-white/15 bg-white/10 text-white">{vacs.status}</Badge>
              <Badge className="border-white/15 bg-white/10 text-white">{trustModeLabel(vacs.evidence.expected_zero_trust_mode)}</Badge>
              <Badge className="border-white/15 bg-white/10 text-white">{vacs.evidence.api_surface_live ? "API live" : "API pending"}</Badge>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard icon={Shield} label="Trust Alignment" value={vacs.evidence.trust_alignment} />
            <MetricCard icon={Orbit} label="Observed Trust" value={vacs.evidence.observed_zero_trust_posture.replace(/_/g, " ")} />
            <MetricCard icon={BrainCircuit} label="Depends On" value={String(vacs.depends_on.length)} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Why VACS belongs in the toolbox</p>
                <p className="mt-1 text-sm text-slate-600">
                  VACS is already a real platform system. The right Pond inclusion is a governed bridge surface: visible,
                  inspectable, and connected to shared truth, without flattening VACS into just another generic report page.
                </p>
              </div>
              <Badge variant="outline" className={toneClasses(vacs.evidence.trust_alignment)}>
                {vacs.evidence.trust_alignment}
              </Badge>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <InfoTile label="Pond role" value="Governed bridge surface" />
              <InfoTile label="Primary contract" value="/v1/vacs/context/:communityId" />
              <InfoTile label="Visibility target" value={vacs.visibility_target} />
              <InfoTile label="Trust zone" value={vacs.trust_zone.replace(/_/g, " ")} />
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Shared foundations</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {vacs.depends_on.map((dependency) => (
                  <Badge key={dependency} variant="outline" className="border-slate-200 bg-white text-slate-700">
                    {dependency}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-slate-900">Current best use in The Pond</p>
            <div className="mt-4 space-y-3">
              {[
                "Use this bridge to make VACS discoverable and governed from the main platform.",
                "Keep the actual content-generation contract API-first while trust hardening continues.",
                "Read from shared Data Pond, Intelligence Office, and Specs inputs instead of giving VACS private truth.",
                "Only add richer operator controls here once the machine boundary and ownership model are fully settled.",
              ].map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-slate-900">Trust and remediation</p>
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="outline" className={toneClasses(vacs.evidence.trust_alignment)}>
                {vacs.evidence.trust_alignment}
              </Badge>
              <span className="text-sm text-slate-600">{vacs.evidence.remediation_track.label}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{vacs.evidence.remediation_track.status_detail}</p>
            <div className="mt-4 space-y-2">
              {vacs.evidence.remediation_track.completion_criteria.map((criterion) => (
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
            <p className="text-sm font-semibold text-slate-900">Next moves</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Toolbox inclusion</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  VACS should live in the Pond toolbox as a bridge page and Dock card first. That keeps it visible and
                  governed without pretending the human workspace is broader than it really is.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Current priority</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{vacs.evidence.next_action.detail}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/watchtower" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-[#0D5E6D] hover:text-[#0D5E6D]">
                  Open Watchtower <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/system" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-[#0D5E6D] hover:text-[#0D5E6D]">
                  Open Control Plane <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/site-content" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-[#0D5E6D] hover:text-[#0D5E6D]">
                  Open Site Content <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <p className="text-sm font-semibold text-slate-900">What comes next after the bridge</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <FutureTile
              icon={BrainCircuit}
              title="Shared governed inputs"
              detail="Use Intelligence Office, Data Pond, and Specs as shared foundations instead of building private VACS truth."
            />
            <FutureTile
              icon={Shield}
              title="Service-token hardening"
              detail="Finish the Zero Trust service identity cutover so VACS can move from transitional to aligned."
            />
            <FutureTile
              icon={FileText}
              title="Operator controls later"
              detail="Add richer human controls here only after the machine contract and ownership boundaries are fully settled."
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
