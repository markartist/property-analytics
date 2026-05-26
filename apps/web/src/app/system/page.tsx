"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPondLandscape, type PondLandscapeResponse } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { canAccessSurface } from "@/lib/permissions";
import { RestrictedSurfaceCard } from "@/components/shared/restricted-surface-card";
import { Database, Layers3, Map, Shield, GitBranch, ArrowRightLeft, Loader2, Sparkles, Target, BriefcaseBusiness, ArrowRight } from "lucide-react";

function titleCaseTrustZone(zone: string): string {
  return zone.replace(/_/g, " ");
}

function outcomeStateTone(state: string): string {
  if (state === "canonical" || state === "stable_core_with_execution_growth") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (state === "represented_but_maturing") return "border-sky-200 bg-sky-50 text-sky-800";
  if (state === "active_consolidation_target" || state === "needs_structural_organization") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function readinessTone(readiness: string): string {
  if (readiness === "strong") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (readiness.includes("foundation_strong") || readiness === "medium") return "border-sky-200 bg-sky-50 text-sky-800";
  if (readiness.includes("medium_high_risk")) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function severityTone(severity: "critical" | "high" | "medium"): string {
  if (severity === "critical") return "border-rose-200 bg-rose-50 text-rose-800";
  if (severity === "high") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-sky-200 bg-sky-50 text-sky-800";
}

export default function SystemControlPlanePage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = React.useState<PondLandscapeResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (authLoading) return;
    if (!canAccessSurface(user?.role, "admin")) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }

    getPondLandscape()
      .then((payload) => {
        setData(payload);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load control plane");
      })
      .finally(() => setLoading(false));
  }, [authLoading, user?.role]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!canAccessSurface(user?.role, "admin")) {
    return (
      <RestrictedSurfaceCard
        title="Control Plane is admin-only"
        description="This surface is moving into the toolbox tier for system owners and administrators. Observers and general operators should use their governed product and report surfaces instead."
      />
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-slate-900">Control Plane unavailable</p>
            <p className="mt-1 text-sm text-slate-600">{error ?? "No landscape payload was returned."}</p>
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
              <Map className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.24em]">System Awareness</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Control Plane</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 md:text-base">
              A governed view of the platform landscape: canonical foundations, product surfaces, legacy-but-important systems,
              trust zones, nested repo boundaries, and migration priorities.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/70">
              <Badge className="border-white/15 bg-white/10 text-white">Version {data.version}</Badge>
              <Badge className="border-white/15 bg-white/10 text-white">Updated {data.updated_at}</Badge>
              <Badge className="border-white/15 bg-white/10 text-white">Keeper + Zero Trust posture</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MetricCard icon={Database} label="Foundations" value={data.summary.canonical_foundation_count} />
            <MetricCard icon={Layers3} label="Surfaces" value={data.summary.product_surface_count} />
            <MetricCard icon={ArrowRightLeft} label="Legacy/Special" value={data.summary.legacy_or_specialized_count} />
            <MetricCard icon={Shield} label="Trust Zones" value={data.summary.trust_zone_count} />
            <MetricCard icon={GitBranch} label="Nested Repos" value={data.summary.nested_repo_count} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(13,94,109,0.08),_transparent_45%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-[#15284B] p-3 text-white shadow-lg">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Enterprise Outcome Architecture</p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  The platform is now being organized by outcome, not by folder. This is the anti-duplication layer:
                  one canonical owner per outcome, explicit accepted specializations, and named consolidation targets for
                  anything still overlapping the same business result.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <SecurityDatum label="Outcome map" value={data.outcome_map.version} />
              <SecurityDatum label="Accepted specials" value={String(data.outcome_map.accepted_specializations.length)} />
              <SecurityDatum label="Consolidate now" value={String(data.outcome_map.consolidate_now.length)} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-slate-900">Shared Security Posture</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SecurityDatum label="Secret authority" value={data.shared_security_posture.secret_authority} />
              <SecurityDatum label="Outer trust boundary" value={data.shared_security_posture.outer_trust_boundary} />
              <SecurityDatum label="Business authorization" value={data.shared_security_posture.business_authorization} />
              <SecurityDatum label="Preferred machine identity" value={data.shared_security_posture.preferred_machine_identity} />
            </div>
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Migration debt</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.shared_security_posture.migration_debt.map((item) => (
                  <Badge key={item} variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-slate-900">Immediate Priorities</p>
            <div className="mt-4 space-y-3">
              {data.immediate_priorities.map((priority, index) => (
                <div key={priority} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#15284B] text-xs font-bold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-700">{priority}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(21,40,75,0.08),_transparent_45%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-[#0D5E6D] p-3 text-white shadow-lg">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Enterprise Readiness</p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  {data.enterprise_readiness.readiness_summary.headline}
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <SecurityDatum label="Readiness version" value={data.enterprise_readiness.version} />
              <SecurityDatum label="Priority workstreams" value={String(data.enterprise_readiness.priority_workstreams.length)} />
              <SecurityDatum label="90-day phases" value={String(data.enterprise_readiness.next_90_days.length)} />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Strongest Areas</p>
                <div className="mt-2 space-y-2">
                  {data.enterprise_readiness.readiness_summary.strongest_areas.map((item) => (
                    <div key={item} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Most Critical Gaps</p>
                <div className="mt-2 space-y-2">
                  {data.enterprise_readiness.readiness_summary.most_critical_gaps.map((item) => (
                    <div key={item} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <SectionCard
        title="Readiness Domains"
        subtitle="Enterprise maturity by domain, with the strongest foundations and the biggest remaining structural gaps called out explicitly."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {data.enterprise_readiness.domains.map((domain) => (
            <div key={domain.id} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#f8fafc_0%,#f0f8fb_100%)] px-5 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xl font-semibold text-slate-900">{domain.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{domain.scope}</p>
                  </div>
                  <Badge variant="outline" className={readinessTone(domain.readiness)}>
                    {domain.readiness.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-slate-700">Owner: {domain.owner}</p>
              </div>
              <div className="grid gap-4 px-5 py-5 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Strengths</p>
                  <div className="mt-2 space-y-2">
                    {domain.strengths.map((item) => (
                      <div key={item} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Gaps</p>
                  <div className="mt-2 space-y-2">
                    {domain.gaps.map((item) => (
                      <div key={item} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Next Moves</p>
                  <div className="mt-2 space-y-2">
                    {domain.next_moves.map((item) => (
                      <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Priority Workstreams"
          subtitle="The highest-value enterprise moves to execute next, with owners, target outcomes, and exit criteria."
        >
          <div className="space-y-4">
            {data.enterprise_readiness.priority_workstreams.map((workstream) => (
              <div key={workstream.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{workstream.name}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{workstream.description}</p>
                  </div>
                  <Badge variant="outline" className={severityTone(workstream.severity)}>
                    {workstream.severity}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <SecurityDatum label="Owner" value={workstream.owner} />
                  <SecurityDatum label="Timeframe" value={workstream.timeframe} />
                  <SecurityDatum label="Target outcomes" value={String(workstream.target_outcomes.length)} />
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Exit Criteria</p>
                  <div className="mt-2 space-y-2">
                    {workstream.exit_criteria.map((criterion) => (
                      <div key={criterion} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                        {criterion}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Next 90 Days"
          subtitle="The sequence to move the platform from a strong backbone into a more complete enterprise operating system."
        >
          <div className="space-y-4">
            {data.enterprise_readiness.next_90_days.map((phase, index) => (
              <div key={phase.phase} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#15284B] text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">{phase.phase}</p>
                    <p className="text-sm text-slate-600">{phase.focus}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {phase.moves.map((move) => (
                    <div key={move} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      {move}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Release Governance"
          subtitle="Enterprise-grade promotion rules so the platform ships from coherent, trusted release slices instead of mixed worktree state."
        >
          <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">Canonical Release Path</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{data.release_governance.promotion_model.working_rule}</p>
              </div>
              <Badge variant="outline" className="border-[#15284B]/15 bg-[#15284B]/5 text-[#15284B]">
                {data.release_governance.promotion_model.canonical_release_path}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {data.release_governance.promotion_model.release_principles.map((principle) => (
                <div key={principle} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  {principle}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {data.release_governance.release_gates.map((gate) => (
              <div key={gate.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-base font-semibold text-slate-900">{gate.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{gate.description}</p>
                <div className="mt-4 space-y-2">
                  {gate.required_checks.map((check) => (
                    <div key={check} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {check}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Workstream Release Lanes"
          subtitle="The active compartments that should remain explicit during review, promotion, and follow-up branching."
        >
          <div className="space-y-4">
            {data.release_governance.active_workstream_lanes.map((lane) => (
              <div key={lane.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{lane.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{lane.scope}</p>
                  </div>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                    {lane.recommended_branch}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Anti-Patterns</p>
            <div className="mt-2 space-y-2">
              {data.release_governance.anti_patterns.map((item) => (
                <div key={item} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Next Moves</p>
            <div className="mt-2 space-y-2">
              {data.release_governance.next_moves.map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Canonical Outcomes"
        subtitle="The enterprise-grade ownership model for everything we do to run the web platform."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {data.outcome_map.outcomes.map((outcome) => (
            <div key={outcome.id} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#f8fafc_0%,#eef7f8_100%)] px-5 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[#0D5E6D]">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">{outcome.category}</span>
                    </div>
                    <p className="mt-2 text-xl font-semibold text-slate-900">{outcome.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{outcome.mission}</p>
                  </div>
                  <Badge variant="outline" className={outcomeStateTone(outcome.current_state)}>
                    {outcome.current_state.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
              <div className="space-y-5 px-5 py-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Canonical Owner</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{outcome.canonical_owner}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Canonical Surfaces</p>
                  <div className="mt-2 space-y-2">
                    {outcome.canonical_surfaces.map((surface) => (
                      <p key={surface} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {surface}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Allowed Specialization</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {outcome.allowed_specialized_systems.map((system) => (
                        <Badge key={system} variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                          {system}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Consolidate Now</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {outcome.consolidate_now.map((item) => (
                        <Badge key={item} variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Next Moves</p>
                  <div className="mt-2 space-y-2">
                    {outcome.next_moves.map((move) => (
                      <div key={move} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                        {move}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          title="Consolidate Now"
          subtitle="The true enterprise outliers: systems still creating duplicate ownership for the same outcome."
        >
          <div className="space-y-3">
            {data.outcome_map.consolidate_now.map((item) => (
              <div key={item.system} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-white p-2 text-amber-700 shadow-sm">
                    <BriefcaseBusiness className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">{item.system}</p>
                    <p className="mt-1 text-sm text-slate-700">Target owner: {item.target_owner}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Accepted Specialization"
          subtitle="Systems allowed to remain outside the main Pond without being treated as architectural failures."
        >
          <div className="space-y-3">
            {data.outcome_map.accepted_specializations.map((item) => (
              <div key={item.system} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-base font-semibold text-slate-900">{item.system}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Enterprise Rules"
        subtitle="The platform discipline that keeps us from recreating duplicate systems as we keep improving."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.outcome_map.enterprise_rules.map((rule, index) => (
            <div key={rule} className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#15284B] text-xs font-bold text-white">
                {index + 1}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{rule}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Canonical Foundations"
        subtitle="The truth, interpretation, and structural layers the rest of the platform should extend instead of bypassing."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {data.canonical_foundations.map((item) => (
            <Card key={item.id} className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{item.status}</p>
                  </div>
                  <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-800">
                    {titleCaseTrustZone(item.trust_zone)}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-slate-600">Owner: {item.owner}</p>
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Responsibilities</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.responsibilities.map((responsibility) => (
                      <Badge key={responsibility} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                        {responsibility}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Paths</p>
                  <div className="mt-2 space-y-2">
                    {item.paths.map((path) => (
                      <p key={path} className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
                        {path}
                      </p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Product Surfaces"
          subtitle="Governed execution and operator surfaces that should remain visible inside The Pond or beside it."
        >
          <div className="space-y-3">
            {data.product_surfaces.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.path}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{item.status}</Badge>
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                      {item.visibility_target}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-800">
                    {titleCaseTrustZone(item.trust_zone)}
                  </Badge>
                  {item.depends_on.map((dependency) => (
                    <Badge key={dependency} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                      depends on {dependency}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Trust Zones"
          subtitle="The shared security language the platform should use across app, API, automation, and sibling systems."
        >
          <div className="space-y-3">
            {data.trust_zones.map((zone) => (
              <div key={zone.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{titleCaseTrustZone(zone.id)}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{zone.description}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Legacy and Specialized Systems"
          subtitle="Visible, governed inventory for systems we still need to preserve, integrate, or retire deliberately."
        >
          <div className="space-y-3">
            {data.legacy_or_specialized_systems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.path}</p>
                  </div>
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                    {item.status}
                  </Badge>
                </div>
                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Migration target</p>
                  <p className="mt-1 text-sm text-slate-700">{item.canonical_migration_target}</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.notes}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Nested Repo Boundaries"
          subtitle="Git histories that should be treated as explicit ownership boundaries during cleanup and migration."
        >
          <div className="space-y-3">
            {data.nested_git_repos.map((path) => (
              <div key={path} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm text-slate-700">{path}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-[#15284B]/10 bg-[#15284B]/5 p-4">
            <p className="text-sm font-semibold text-slate-900">Working principle</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Clean the repo by making ownership and migration explicit, not by losing visibility into systems that still matter.
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="border-t border-slate-200 pt-2">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <Link href="/pond" className="hover:text-[#0D5E6D] transition-colors">Back to The Pond</Link>
          <span>·</span>
          <Link href="/watchtower" className="hover:text-[#0D5E6D] transition-colors">Open Watchtower</Link>
          <span>·</span>
          <Link href="/intelligence-office" className="hover:text-[#0D5E6D] transition-colors">Open Intelligence Office</Link>
          <span>·</span>
          <Link href="/dock" className="inline-flex items-center gap-1 hover:text-[#0D5E6D] transition-colors">
            Open Dock <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-white/70">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function SecurityDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-6">
        <p className="text-lg font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        <div className="mt-5">{children}</div>
      </CardContent>
    </Card>
  );
}
