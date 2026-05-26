/**
 * Data Pond routes — landing page insights and surface conditions.
 *
 * Endpoints:
 *   GET /insights  — "Catch of the Day" auto-generated insights from latest snapshot
 */

import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst } from "../lib/db";
import systemLandscapeManifest from "../../../../config/system_landscape_manifest.json";
import platformOutcomeMap from "../../../../config/platform_outcome_map.json";
import enterpriseGapRegister from "../../../../config/enterprise_gap_register.json";
import releaseGovernanceConfig from "../../../../config/release_governance.json";
import serviceOperationsManifestConfig from "../../../../config/service_operations_manifest.json";
import deploymentProvenanceConfig from "../../../../config/deployment_provenance_manifest.json";
import releaseProvenanceConfig from "../../../../config/release_provenance.json";
import releaseReconcileSnapshotConfig from "../../../../config/release_reconcile_snapshot.json";

const pond = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
pond.use("*", requireAuth);

interface Insight {
  id: string;
  icon: "trending-up" | "trending-down" | "alert" | "trophy" | "zap" | "bar-chart";
  color: "green" | "amber" | "red" | "teal" | "blue";
  title: string;
  detail: string;
}

interface SystemLandscapeManifest {
  version: string;
  updated_at: string;
  purpose: string;
  canonical_foundations: Array<{
    id: string;
    name: string;
    status: string;
    owner: string;
    paths: string[];
    trust_zone: string;
    responsibilities: string[];
  }>;
  product_surfaces: Array<{
    id: string;
    name: string;
    status: string;
    path: string;
    depends_on: string[];
    trust_zone: string;
    visibility_target: string;
  }>;
  legacy_or_specialized_systems: Array<{
    id: string;
    name: string;
    status: string;
    path: string;
    canonical_migration_target: string;
    notes: string;
  }>;
  nested_git_repos: string[];
  trust_zones: Array<{
    id: string;
    description: string;
  }>;
  shared_security_posture: {
    secret_authority: string;
    outer_trust_boundary: string;
    business_authorization: string;
    preferred_machine_identity: string;
    migration_debt: string[];
  };
  immediate_priorities: string[];
}

interface PlatformOutcomeMap {
  version: string;
  updated_at: string;
  purpose: string;
  outcomes: Array<{
    id: string;
    name: string;
    category: string;
    canonical_owner: string;
    canonical_surfaces: string[];
    mission: string;
    allowed_specialized_systems: string[];
    consolidate_now: string[];
    current_state: string;
    next_moves: string[];
  }>;
  enterprise_rules: string[];
  accepted_specializations: Array<{
    system: string;
    reason: string;
  }>;
  consolidate_now: Array<{
    system: string;
    target_owner: string;
    reason: string;
  }>;
}

const landscapeManifest = systemLandscapeManifest as SystemLandscapeManifest;
const outcomeMap = platformOutcomeMap as PlatformOutcomeMap;
const enterpriseReadiness = enterpriseGapRegister as {
  version: string;
  updated_at: string;
  purpose: string;
  readiness_summary: {
    overall_state: string;
    headline: string;
    strongest_areas: string[];
    most_critical_gaps: string[];
  };
  domains: Array<{
    id: string;
    name: string;
    readiness: string;
    owner: string;
    scope: string;
    strengths: string[];
    gaps: string[];
    next_moves: string[];
  }>;
  priority_workstreams: Array<{
    id: string;
    name: string;
    severity: "critical" | "high" | "medium";
    owner: string;
    target_outcomes: string[];
    timeframe: string;
    description: string;
    exit_criteria: string[];
  }>;
  next_90_days: Array<{
    phase: string;
    focus: string;
    moves: string[];
  }>;
};

const releaseGovernance = releaseGovernanceConfig as {
  version: string;
  updated_at: string;
  purpose: string;
  promotion_model: {
    canonical_release_path: string;
    working_rule: string;
    release_principles: string[];
  };
  release_gates: Array<{
    id: string;
    label: string;
    description: string;
    required_checks: string[];
  }>;
  active_workstream_lanes: Array<{
    id: string;
    label: string;
    recommended_branch: string;
    scope: string;
  }>;
  anti_patterns: string[];
  next_moves: string[];
};

const serviceOperationsManifest = serviceOperationsManifestConfig as {
  version: string;
  updated_at: string;
  purpose: string;
  services: Array<{
    id: string;
    name: string;
    owner: string;
    service_tier: string;
    runtime: string;
    deployment_target: string;
    release_lane: string;
    trust_boundary: string;
    canonical_surface: string | null;
    primary_runbook: string | null;
    depends_on: string[];
    operational_focus: string[];
  }>;
};

const deploymentProvenance = deploymentProvenanceConfig as {
  version: string;
  updated_at: string;
  purpose: string;
  environments: Array<{
    id: string;
    label: string;
    web_hosts?: string[];
    web_host_suffixes?: string[];
    api_hosts: string[];
    release_posture: string;
  }>;
  rules: {
    canonical_release_path: string;
    preferred_api_base: string;
    production_debug_flags_must_be_false: string[];
    preview_hosts_are_allowed: boolean;
    custom_pages_aliases_are_release_review_only: boolean;
  };
  service_bindings: Array<{
    service_id: string;
    expected_environment: string;
    managed_target: string;
  }>;
};

const releaseProvenance = releaseProvenanceConfig as {
  version: string;
  updated_at: string;
  purpose: string;
  release_descriptor: {
    source_branch: string;
    baseline_commit: {
      sha: string;
      short_sha: string;
      committed_at: string;
      subject: string;
    };
    source_mode: string;
    release_lane: string;
    canonical_release_path: string;
    provenance_status: "aligned" | "transitional" | "review";
    provenance_note: string;
  };
  deployments: Array<{
    service_id: string;
    target: string;
    deployed_at: string;
    runtime_identifier: string;
    public_url: string;
  }>;
  next_moves: string[];
};

const releaseReconcileSnapshot = releaseReconcileSnapshotConfig as {
  version: string;
  updated_at: string;
  purpose: string;
  working_tree: {
    changed_file_count: number;
    primary_release_slice_count: number;
    non_primary_count: number;
  };
  recommended_release_candidate: {
    label: string;
    canonical_branch: string;
    included_lanes: string[];
    exclude_lanes: string[];
    readiness_note: string;
  };
  lane_counts: Record<string, number>;
  lane_examples: Record<string, string[]>;
};

type WatchtowerPosture =
  | "healthy"
  | "active_build"
  | "specialized_live"
  | "migration_debt"
  | "trust_hardening"
  | "external_governed"
  | "reference_only";

interface LandscapeEvidence {
  represented_in_pond: boolean;
  pond_surface_href: string | null;
  boundary_class: string;
  web_surface_live: boolean;
  api_surface_live: boolean;
  expected_zero_trust_mode: "human_access" | "machine_access" | "mixed_access" | "local_only" | "external_governed";
  observed_zero_trust_posture:
    | "session_origin_guard"
    | "service_token_capable"
    | "mixed_session_and_service"
    | "session_plus_debug_bypass"
    | "migration_boundary"
    | "external_governed"
    | "not_inferred";
  trust_alignment: "aligned" | "transitional" | "review";
  trust_evidence_points: string[];
  remediation_track: {
    label: string;
    doc_path: string | null;
    route_href: string | null;
    status: "open" | "active" | "closed";
    status_detail: string;
    completion_criteria: Array<{
      label: string;
      met: boolean;
      detail: string | null;
    }>;
  };
  evidence_points: string[];
  next_action: {
    state: "clear" | "watch" | "action";
    title: string;
    detail: string;
    href: string | null;
  };
}

interface RawObservedTrustEvidence {
  observed_zero_trust_posture: LandscapeEvidence["observed_zero_trust_posture"];
  trust_alignment: LandscapeEvidence["trust_alignment"];
  trust_evidence_points: string[];
  remediation_track: {
    label: string;
    doc_path: string | null;
    route_href: string | null;
    status: "open" | "active" | "closed";
    status_detail: string;
    completion_criteria: string[];
  };
}

function summarizeRemediationLifecycle(
  baseDetail: string,
  completionCriteria: LandscapeEvidence["remediation_track"]["completion_criteria"],
): Pick<LandscapeEvidence["remediation_track"], "status" | "status_detail"> {
  const metCount = completionCriteria.filter((criterion) => criterion.met).length;
  const totalCount = completionCriteria.length;

  if (totalCount > 0 && metCount === totalCount) {
    return {
      status: "closed",
      status_detail: `${baseDetail} All ${totalCount} completion criteria are currently satisfied.`,
    };
  }

  if (metCount > 0) {
    return {
      status: "active",
      status_detail: `${baseDetail} ${metCount}/${totalCount} completion criteria are currently satisfied.`,
    };
  }

  return {
    status: "open",
    status_detail: `${baseDetail} No completion criteria are currently satisfied.`,
  };
}

interface GapRunbookItem {
  id: string;
  label: string;
  state: "clear" | "watch" | "action";
  count: number;
  detail: string;
  next_move: string;
  href: string | null;
}

type LandscapeNodeWithEvidence = {
  id: string;
  posture: WatchtowerPosture;
  evidence: LandscapeEvidence;
};

const KNOWN_WEB_ROUTES = new Set([
  "/",
  "/analysis",
  "/backup",
  "/communities",
  "/dock",
  "/evs",
  "/fish",
  "/gbp-posts",
  "/gsc",
  "/intelligence-office",
  "/login",
  "/marketing",
  "/metrics-import",
  "/pib",
  "/site-content",
  "/system",
  "/t30-metrics",
  "/t7-metrics",
  "/tracker",
  "/vacs",
  "/watchtower",
]);

const KNOWN_API_ROUTES = new Set([
  "/v1/admin/intelligence",
  "/v1/admin/site-content",
  "/v1/auth",
  "/v1/communities",
  "/v1/evs",
  "/v1/exports",
  "/v1/fish",
  "/v1/gbp-posts",
  "/v1/gsc-snapshot",
  "/v1/health",
  "/v1/intelligence-memory",
  "/v1/marketing",
  "/v1/marketing-data",
  "/v1/metrics",
  "/v1/pib",
  "/v1/platform",
  "/v1/pond",
  "/v1/search-intelligence",
  "/v1/t30-metrics",
  "/v1/t7-metrics",
  "/v1/vacs",
]);

function derivePondHref(path: string): string | null {
  const match = path.match(/\/apps\/web\/src\/app(\/[^/]+(?:\/[^/]+)*)$/);
  if (match) {
    const route = match[1].replace(/\/page$/, "");
    return route === "" ? "/" : route;
  }
  return null;
}

function expectedZeroTrustMode(boundaryClass: string): LandscapeEvidence["expected_zero_trust_mode"] {
  if (boundaryClass === "access_protected_human") return "human_access";
  if (boundaryClass === "access_protected_machine") return "machine_access";
  if (boundaryClass === "access_protected_human_and_machine") return "mixed_access";
  if (boundaryClass === "local_operator_only" || boundaryClass === "repo_boundary_migration") return "local_only";
  return "external_governed";
}

function knownApiRouteForNode(id: string): string | null {
  switch (id) {
    case "data_pond_truth":
      return "/v1/pond";
    case "intelligence_office":
      return "/v1/intelligence-memory";
    case "watchtower":
      return "/v1/health";
    case "site_content_creator":
      return "/v1/admin/site-content";
    case "vacs":
      return "/v1/vacs";
    case "evs":
      return "/v1/evs";
    case "pilot_tracker":
      return null;
    case "property_intelligence_brief":
      return "/v1/pib";
    default:
      return null;
  }
}

function deriveObservedTrustEvidence(id: string): RawObservedTrustEvidence {
  switch (id) {
    case "data_pond_truth":
      return {
        observed_zero_trust_posture: "mixed_session_and_service",
        trust_alignment: "transitional",
        trust_evidence_points: [
          "Human app/API surfaces such as /v1/pond and /v1/health use session-based requireAuth at origin.",
          "Platform machine routes support Access service-token auth, but shared-token fallback still exists in the platform layer.",
        ],
        remediation_track: {
          label: "Phase 1 Platform Cutover",
          doc_path: "/Users/mark/Property_Analytics/docs/PHASE1_CUTOVER_RUNBOOK.md",
          route_href: "/watchtower",
          status: "active",
          status_detail: "Platform cutover remains active because the core platform still carries transitional mixed human/service trust posture.",
          completion_criteria: [
            "Core human surfaces remain session-guarded and represented in The Pond.",
            "Machine-facing platform routes no longer depend on shared-token fallback.",
            "Observed trust alignment for the core platform boundary resolves from transitional to aligned.",
          ],
        },
      };
    case "intelligence_office":
      return {
        observed_zero_trust_posture: "session_origin_guard",
        trust_alignment: "aligned",
        trust_evidence_points: [
          "Intelligence Office web and API surfaces are represented as authenticated human flows.",
          "No machine-only trust exception is required for the current governed memory lane.",
        ],
        remediation_track: {
          label: "Governed Human Surface",
          doc_path: "/Users/mark/Property_Analytics/docs/UNIFIED_SYSTEM_FOUNDATION_2026-04-17.md",
          route_href: "/intelligence-office",
          status: "closed",
          status_detail: "Current observed trust posture is aligned for this governed human-facing lane.",
          completion_criteria: [
            "Human-facing route is live and represented in The Pond.",
            "Observed trust posture is session-guarded without machine-boundary exceptions.",
            "Trust alignment reads aligned in the tower.",
          ],
        },
      };
    case "specs":
      return {
        observed_zero_trust_posture: "external_governed",
        trust_alignment: "aligned",
        trust_evidence_points: [
          "Specs is intentionally treated as an external governed sibling rather than an app-hosted trust surface.",
        ],
        remediation_track: {
          label: "External Governed Linkage",
          doc_path: "/Users/mark/Property_Analytics/docs/UNIFIED_SYSTEM_FOUNDATION_2026-04-17.md",
          route_href: "/system",
          status: "closed",
          status_detail: "The linkage model is behaving as intended for an external governed sibling system.",
          completion_criteria: [
            "The node remains explicitly classified as external governed.",
            "No private canonical truth is being duplicated inside the platform.",
            "The relationship is represented in the control plane.",
          ],
        },
      };
    case "watchtower":
    case "pilot_tracker":
      return {
        observed_zero_trust_posture: "session_origin_guard",
        trust_alignment: "aligned",
        trust_evidence_points: [
          "Observed route posture is authenticated human access through requireAuth-backed app/API flows.",
        ],
        remediation_track: {
          label: "Access-Protected Human Surface",
          doc_path: "/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md",
          route_href: "/watchtower",
          status: "closed",
          status_detail: "Observed route posture is aligned with the expected human Access pattern.",
          completion_criteria: [
            "Human-facing route is live.",
            "Observed trust posture is session-guarded.",
            "Trust alignment reads aligned in the tower.",
          ],
        },
      };
    case "site_content_creator":
      return {
        observed_zero_trust_posture: "session_origin_guard",
        trust_alignment: "aligned",
        trust_evidence_points: [
          "Primary surface posture is authenticated human access with admin gating on the admin site-content API.",
          "The temporary debug bypass path has been retired, so this lane now reads as a governed human-access surface rather than a trust-review exception.",
        ],
        remediation_track: {
          label: "Governed Human Surface",
          doc_path: "/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md",
          route_href: "/site-content",
          status: "closed",
          status_detail: "Observed route posture is aligned for the Site Content governed human-access lane.",
          completion_criteria: [
            "Admin site-content API remains live behind authenticated human access.",
            "Observed trust posture is session-guarded without debug-bypass exceptions.",
            "Observed trust alignment for the lane resolves to aligned.",
          ],
        },
      };
    case "vacs":
      return {
        observed_zero_trust_posture: "service_token_capable",
        trust_alignment: "aligned",
        trust_evidence_points: [
          "VACS routes require service credentials and resolve Access service-token headers at origin.",
          "Shared-token fallback has been retired for the VACS route, so the lane now reads as an aligned machine-access surface.",
        ],
        remediation_track: {
          label: "Aligned Machine Surface",
          doc_path: "/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_WORKER_SECRET_CUTOVER_2026-04-13.md",
          route_href: "/vacs",
          status: "closed",
          status_detail: "Observed route posture is aligned for the VACS machine-access lane.",
          completion_criteria: [
            "Machine-facing VACS API contract remains live.",
            "Access service-token auth is the canonical machine entry path.",
            "Observed trust alignment for VACS resolves to aligned.",
          ],
        },
      };
    case "evs":
      return {
        observed_zero_trust_posture: "mixed_session_and_service",
        trust_alignment: "aligned",
        trust_evidence_points: [
          "EVS human request/property routes use authenticated session access.",
          "The ingest route accepts machine service credentials, so EVS is an intentionally mixed human-and-machine lane rather than an accidental boundary mismatch.",
        ],
        remediation_track: {
          label: "Governed Mixed Validation Lane",
          doc_path: "/Users/mark/Property_Analytics/docs/WORKTREE_EVS_BROWSERSTACK_FINISH_ORDER_2026-04-16.md",
          route_href: "/evs",
          status: "closed",
          status_detail: "Observed route posture is aligned for the EVS mixed human-and-machine validation lane.",
          completion_criteria: [
            "The intended EVS boundary is explicitly represented as a mixed validation lane.",
            "Human request surfaces and machine ingest both remain live.",
            "Observed trust alignment for EVS resolves to aligned.",
          ],
        },
      };
    case "property_intelligence_brief":
      return {
        observed_zero_trust_posture: "session_origin_guard",
        trust_alignment: "aligned",
        trust_evidence_points: [
          "PIB is surfaced through authenticated human-facing Pond routes while the canonical generator remains a protected internal subsystem.",
        ],
        remediation_track: {
          label: "Protected Canonical PIB",
          doc_path: "/Users/mark/Property_Analytics/AGENTS.md",
          route_href: "/pib",
          status: "closed",
          status_detail: "The canonical PIB trust and ownership posture is currently aligned and protected.",
          completion_criteria: [
            "PIB remains surfaced through governed app routes.",
            "Locked canonical PIB generator/render path is not forked or mutated outside approval.",
            "Observed trust alignment remains aligned.",
          ],
        },
      };
    case "portfolio_monitoring":
    case "portfolio_dashboard":
    case "spotlight_properties_report":
      return {
        observed_zero_trust_posture: "migration_boundary",
        trust_alignment: "review",
        trust_evidence_points: [
          "This lane remains outside the unified app trust boundary and should be treated as a migration/repo-boundary concern rather than a first-class Zero Trust surface.",
        ],
        remediation_track: {
          label: "Repo Boundary Migration",
          doc_path: "/Users/mark/Property_Analytics/docs/RELEASE_SPLIT_PLAN_2026-04-14.md",
          route_href: "/system",
          status: "open",
          status_detail: "Migration cleanup remains open while this lane still sits outside the unified platform trust boundary.",
          completion_criteria: [
            "Nested or legacy repo boundary remains explicitly tracked in the control plane.",
            "Net-new ownership is redirected into the canonical destination lane.",
            "The system no longer presents as a trust-review migration boundary in the tower.",
          ],
        },
      };
    default:
      return {
        observed_zero_trust_posture: "not_inferred",
        trust_alignment: "review",
        trust_evidence_points: [
          "Observed trust posture has not yet been inferred for this node from live route/auth contracts.",
        ],
        remediation_track: {
          label: "Foundation Review",
          doc_path: "/Users/mark/Property_Analytics/docs/UNIFIED_SYSTEM_FOUNDATION_2026-04-17.md",
          route_href: "/system",
          status: "open",
          status_detail: "Remediation remains open until this node's trust posture is inferred and aligned explicitly.",
          completion_criteria: [
            "Observed trust posture is inferred from current route/auth evidence.",
            "Expected and observed trust models are explicitly represented in the control plane.",
            "The node no longer remains in unresolved review status.",
          ],
        },
      };
  }
}

function criterion(label: string, met: boolean, detail: string | null = null): LandscapeEvidence["remediation_track"]["completion_criteria"][number] {
  return { label, met, detail };
}

function withMachineEvaluatedRemediation<T extends LandscapeNodeWithEvidence>(item: T): T {
  const { evidence, id } = item;
  const completionCriteria = (() => {
    switch (id) {
      case "data_pond_truth":
        return [
          criterion(
            "Core human surfaces remain session-guarded and represented in The Pond.",
            evidence.represented_in_pond && evidence.api_surface_live,
            evidence.represented_in_pond && evidence.api_surface_live
              ? "Canonical control-plane routes are visible and authenticated."
              : "The core control-plane surface still needs stable governed representation.",
          ),
          criterion(
            "Machine-facing platform routes no longer depend on shared-token fallback.",
            evidence.trust_alignment === "aligned",
            evidence.trust_alignment === "aligned"
              ? "Observed trust posture no longer reads transitional."
              : "Transitional trust posture still implies shared-token retirement is not complete.",
          ),
          criterion(
            "Observed trust alignment for the core platform boundary resolves from transitional to aligned.",
            evidence.trust_alignment === "aligned",
            `Current tower read is ${evidence.trust_alignment}.`,
          ),
        ];
      case "intelligence_office":
        return [
          criterion(
            "Human-facing route is live and represented in The Pond.",
            evidence.represented_in_pond && evidence.web_surface_live,
            evidence.represented_in_pond && evidence.web_surface_live ? "The governed human surface is live in The Pond." : "The governed human surface is not fully attached yet.",
          ),
          criterion(
            "Observed trust posture is session-guarded without machine-boundary exceptions.",
            evidence.observed_zero_trust_posture === "session_origin_guard",
            `Observed posture is ${evidence.observed_zero_trust_posture}.`,
          ),
          criterion(
            "Trust alignment reads aligned in the tower.",
            evidence.trust_alignment === "aligned",
            `Current tower read is ${evidence.trust_alignment}.`,
          ),
        ];
      case "specs":
        return [
          criterion(
            "The node remains explicitly classified as external governed.",
            evidence.observed_zero_trust_posture === "external_governed",
            `Observed posture is ${evidence.observed_zero_trust_posture}.`,
          ),
          criterion(
            "No private canonical truth is being duplicated inside the platform.",
            !evidence.represented_in_pond,
            evidence.represented_in_pond ? "This node is showing up as a direct Pond representation." : "The node remains linked rather than duplicated into the platform.",
          ),
          criterion(
            "The relationship is represented in the control plane.",
            evidence.next_action.href === "/system",
            evidence.next_action.href === "/system" ? "The control-plane route owns the linkage." : "The linkage is not currently anchored back to /system.",
          ),
        ];
      case "watchtower":
      case "pilot_tracker":
        return [
          criterion(
            "Human-facing route is live.",
            evidence.web_surface_live,
            evidence.web_surface_live ? "The operator surface is live." : "The expected human route is not live.",
          ),
          criterion(
            "Observed trust posture is session-guarded.",
            evidence.observed_zero_trust_posture === "session_origin_guard",
            `Observed posture is ${evidence.observed_zero_trust_posture}.`,
          ),
          criterion(
            "Trust alignment reads aligned in the tower.",
            evidence.trust_alignment === "aligned",
            `Current tower read is ${evidence.trust_alignment}.`,
          ),
        ];
      case "site_content_creator":
        return [
          criterion(
            "Admin site-content API remains live behind authenticated human access.",
            evidence.web_surface_live && evidence.api_surface_live,
            evidence.web_surface_live && evidence.api_surface_live ? "The governed editorial lane is live in both web and API surfaces." : "The governed editorial lane is missing a live surface.",
          ),
          criterion(
            "Observed trust posture is session-guarded without debug-bypass exceptions.",
            evidence.observed_zero_trust_posture === "session_origin_guard",
            `Observed posture is ${evidence.observed_zero_trust_posture}.`,
          ),
          criterion(
            "Observed trust alignment for the lane resolves to aligned.",
            evidence.trust_alignment === "aligned",
            `Current tower read is ${evidence.trust_alignment}.`,
          ),
        ];
      case "vacs":
        return [
          criterion(
            "Machine-facing VACS API contract remains live.",
            evidence.api_surface_live,
            evidence.api_surface_live ? "The canonical machine contract is visible." : "The tower cannot see a canonical machine contract yet.",
          ),
          criterion(
            "Access service-token auth is the canonical machine entry path.",
            evidence.observed_zero_trust_posture === "service_token_capable" || evidence.trust_alignment === "aligned",
            `Observed posture is ${evidence.observed_zero_trust_posture}.`,
          ),
          criterion(
            "Observed trust alignment for VACS resolves to aligned.",
            evidence.trust_alignment === "aligned",
            `Current tower read is ${evidence.trust_alignment}.`,
          ),
        ];
      case "evs":
        return [
          criterion(
            "The intended EVS boundary is explicitly represented as a mixed validation lane.",
            evidence.expected_zero_trust_mode === "mixed_access",
            `Current tower read is ${evidence.trust_alignment}.`,
          ),
          criterion(
            "Human request surfaces and machine ingest both remain live.",
            evidence.web_surface_live && evidence.api_surface_live,
            `Web surface is ${evidence.web_surface_live ? "live" : "missing"} and API surface is ${evidence.api_surface_live ? "live" : "missing"}.`,
          ),
          criterion(
            "Observed trust alignment for EVS resolves to aligned.",
            evidence.trust_alignment === "aligned",
            `Current tower read is ${evidence.trust_alignment}.`,
          ),
        ];
      case "property_intelligence_brief":
        return [
          criterion(
            "PIB remains surfaced through governed app routes.",
            evidence.represented_in_pond && evidence.web_surface_live,
            evidence.represented_in_pond && evidence.web_surface_live ? "PIB is still represented through the governed Pond surface." : "PIB is missing its governed surface representation.",
          ),
          criterion(
            "Locked canonical PIB generator/render path is not forked or mutated outside approval.",
            evidence.boundary_class === "access_protected_human",
            "This remains governed by PIB guardrails and the protected human-surface boundary.",
          ),
          criterion(
            "Observed trust alignment remains aligned.",
            evidence.trust_alignment === "aligned",
            `Current tower read is ${evidence.trust_alignment}.`,
          ),
        ];
      case "portfolio_monitoring":
      case "portfolio_dashboard":
      case "spotlight_properties_report":
        return [
          criterion(
            "Nested or legacy repo boundary remains explicitly tracked in the control plane.",
            !evidence.represented_in_pond && evidence.boundary_class === "repo_boundary_migration",
            "The system is still treated as a migration-boundary lane in the control plane.",
          ),
          criterion(
            "Net-new ownership is redirected into the canonical destination lane.",
            Boolean(evidence.next_action.href),
            evidence.next_action.href ? `Current canonical next move routes back to ${evidence.next_action.href}.` : "No canonical destination surface is currently attached.",
          ),
          criterion(
            "The system no longer presents as a trust-review migration boundary in the tower.",
            evidence.observed_zero_trust_posture !== "migration_boundary" && evidence.trust_alignment !== "review",
            `Observed posture is ${evidence.observed_zero_trust_posture} and alignment is ${evidence.trust_alignment}.`,
          ),
        ];
      default:
        return [
          criterion(
            "Observed trust posture is inferred from current route/auth evidence.",
            evidence.observed_zero_trust_posture !== "not_inferred",
            `Observed posture is ${evidence.observed_zero_trust_posture}.`,
          ),
          criterion(
            "Expected and observed trust models are explicitly represented in the control plane.",
            Boolean(evidence.next_action.href),
            evidence.next_action.href ? `The node is anchored back to ${evidence.next_action.href}.` : "The control-plane linkage is still missing.",
          ),
          criterion(
            "The node no longer remains in unresolved review status.",
            evidence.trust_alignment !== "review",
            `Current tower read is ${evidence.trust_alignment}.`,
          ),
        ];
    }
  })();
  const lifecycle = summarizeRemediationLifecycle(evidence.remediation_track.status_detail, completionCriteria);

  return {
    ...item,
    evidence: {
      ...evidence,
      remediation_track: {
        ...evidence.remediation_track,
        ...lifecycle,
        completion_criteria: completionCriteria,
      },
    },
  };
}

function deriveFoundationEvidence(
  item: SystemLandscapeManifest["canonical_foundations"][number],
): LandscapeEvidence {
  const pondHref = item.id === "intelligence_office" ? "/intelligence-office" : null;
  const apiRoute = knownApiRouteForNode(item.id);
  const observed = deriveObservedTrustEvidence(item.id);
  return {
    represented_in_pond: item.id !== "specs",
    pond_surface_href: pondHref,
    boundary_class: item.trust_zone,
    web_surface_live: pondHref ? KNOWN_WEB_ROUTES.has(pondHref) : false,
    api_surface_live: apiRoute ? KNOWN_API_ROUTES.has(apiRoute) : false,
    expected_zero_trust_mode: expectedZeroTrustMode(item.trust_zone),
    ...observed,
    remediation_track: {
      ...observed.remediation_track,
      completion_criteria: [],
    },
    evidence_points:
      item.id === "data_pond_truth"
        ? [
            "Canonical DB, registry, collection system, API, and web platform all live inside the main platform boundary.",
            "Visible in The Pond and Watchtower as the truth/control-plane layer.",
          ]
        : item.id === "intelligence_office"
          ? [
              "Governed memory and directives are present in both API and web surfaces.",
              "Visible in The Pond as an active interpretation layer.",
            ]
          : [
              "Governed sibling system exists outside the main repo/app surface.",
              "Should stay structurally linked without becoming private canonical truth.",
            ],
    next_action:
      item.id === "data_pond_truth"
        ? {
            state: "clear",
            title: "Protect canonical boundary",
            detail: "Keep new truth, collection, and operator workflows attached to the shared platform boundary rather than forking parallel systems.",
            href: "/system",
          }
        : item.id === "intelligence_office"
          ? {
              state: "watch",
              title: "Deepen governed integration",
              detail: "Continue wiring directives, evidence, and governed memory into active product surfaces instead of leaving Intelligence Office as a sidecar.",
              href: "/intelligence-office",
            }
          : {
              state: "watch",
              title: "Maintain governed linkage",
              detail: "Keep Specs structurally linked from Pond surfaces while preserving it as an external governed sibling rather than duplicating its contracts locally.",
              href: "/system",
            },
  };
}

function deriveProductEvidence(
  item: SystemLandscapeManifest["product_surfaces"][number],
): LandscapeEvidence {
  const pondHref = derivePondHref(item.path);
  const apiRoute = knownApiRouteForNode(item.id);
  const observed = deriveObservedTrustEvidence(item.id);
  return {
    represented_in_pond: item.visibility_target === "in_pond" || Boolean(pondHref),
    pond_surface_href: pondHref,
    boundary_class: item.trust_zone,
    web_surface_live: pondHref ? KNOWN_WEB_ROUTES.has(pondHref) : false,
    api_surface_live: apiRoute ? KNOWN_API_ROUTES.has(apiRoute) : false,
    expected_zero_trust_mode: expectedZeroTrustMode(item.trust_zone),
    ...observed,
    remediation_track: {
      ...observed.remediation_track,
      completion_criteria: [],
    },
    evidence_points: [
      pondHref ? `Has a governed Pond surface at ${pondHref}.` : "No first-class Pond route is surfaced yet.",
      item.visibility_target === "in_pond"
        ? "Marked as directly represented inside The Pond."
        : "Marked as pond-adjacent rather than fully represented in The Pond.",
      `Trust boundary class is ${item.trust_zone}.`,
    ],
    next_action:
      item.id === "watchtower"
        ? {
            state: "clear",
            title: "Keep the tower canonical",
            detail: "Use Watchtower as the operator-facing control surface for live status, landscape pressure, and remediation guidance instead of scattering ops context.",
            href: "/watchtower",
          }
        : item.id === "site_content_creator"
          ? {
              state: "action",
              title: "Finish the editorial spine",
              detail: "Complete the section-level execution workflow so the surface becomes a governed operator lane, not only a capable active build.",
              href: "/site-content",
            }
          : item.id === "vacs"
            ? {
                state: "action",
                title: "Harden machine boundary",
                detail: "Keep VACS API-first, verify Zero Trust machine posture, and avoid adding human-facing sprawl until the machine contract is settled.",
                href: "/watchtower",
              }
            : item.id === "evs"
              ? {
                  state: "clear",
                  title: "Preserve governed mixed lane",
                  detail: "Keep EVS visible through the Pond bridge while preserving its explicit mixed human-and-machine validation boundary.",
                  href: "/evs",
                }
              : {
                  state: "clear",
                  title: "Preserve governed discoverability",
                  detail: "Keep this active surface represented inside the Pond and aligned with the canonical route and trust model.",
                  href: pondHref,
                },
  };
}

function deriveLegacyEvidence(
  item: SystemLandscapeManifest["legacy_or_specialized_systems"][number],
): LandscapeEvidence {
  const pondHref = item.id === "property_intelligence_brief" ? "/pib" : null;
  const apiRoute = knownApiRouteForNode(item.id);
  const observed = deriveObservedTrustEvidence(item.id);
  return {
    represented_in_pond: Boolean(pondHref),
    pond_surface_href: pondHref,
    boundary_class: item.id === "property_intelligence_brief" ? "access_protected_human" : "repo_boundary_migration",
    web_surface_live: pondHref ? KNOWN_WEB_ROUTES.has(pondHref) : false,
    api_surface_live: apiRoute ? KNOWN_API_ROUTES.has(apiRoute) : false,
    expected_zero_trust_mode: expectedZeroTrustMode(item.id === "property_intelligence_brief" ? "access_protected_human" : "repo_boundary_migration"),
    ...observed,
    remediation_track: {
      ...observed.remediation_track,
      completion_criteria: [],
    },
    evidence_points: [
      pondHref ? `The Pond has an orchestration/view surface at ${pondHref}.` : "No first-class Pond route exists yet for this lane.",
      `Canonical migration target is ${item.canonical_migration_target}.`,
      item.notes,
    ],
    next_action:
      item.id === "property_intelligence_brief"
        ? {
            state: "clear",
            title: "Orchestrate, do not fork",
            detail: "Keep PIB surfaced through the Pond and preserve the locked canonical generator/render path rather than mutating or duplicating it.",
            href: "/pib",
          }
        : {
            state: "action",
            title: "Reduce migration debt",
            detail: `Move net-new ownership toward ${item.canonical_migration_target} while retaining this lane as reusable reference or specialized logic only.`,
            href: "/system",
          },
  };
}

function deriveFoundationPosture(id: string): { posture: WatchtowerPosture; signal: string } {
  if (id === "data_pond_truth") {
    return { posture: "healthy", signal: "Canonical truth and control plane are now visible in The Pond and Watchtower." };
  }
  if (id === "intelligence_office") {
    return { posture: "active_build", signal: "Governed interpretation layer is live and still being integrated more deeply across surfaces." };
  }
  return { posture: "external_governed", signal: "Governed sibling system should stay linked without becoming private truth." };
}

function deriveProductPosture(
  item: SystemLandscapeManifest["product_surfaces"][number],
): { posture: WatchtowerPosture; signal: string } {
  if (item.id === "watchtower") {
    return { posture: "healthy", signal: "Operator tower is live and now represents both morning ops and broader platform boundaries." };
  }
  if (item.id === "site_content_creator") {
    return { posture: "active_build", signal: "Execution workspace is live but still needs deeper governed rewrite workflow maturation." };
  }
  if (item.id === "vacs") {
    return { posture: "trust_hardening", signal: "API-first capability exists; machine-boundary hardening and governed surface shaping remain active work." };
  }
  if (item.id === "evs") {
    return { posture: "specialized_live", signal: "Validation lane is real, specialized, and now represented in the Pond as a governed mixed-access bridge." };
  }
  return { posture: "specialized_live", signal: "Active product surface with shared truth integration." };
}

function deriveLegacyPosture(
  item: SystemLandscapeManifest["legacy_or_specialized_systems"][number],
): { posture: WatchtowerPosture; signal: string } {
  if (item.status.includes("canonical_locked")) {
    return { posture: "reference_only", signal: "Canonical locked system should be orchestrated around, not forked." };
  }
  if (item.status.includes("legacy")) {
    return { posture: "migration_debt", signal: `Still useful, but canonical ownership should move toward ${item.canonical_migration_target}.` };
  }
  return { posture: "specialized_live", signal: "Specialized system remains valuable and should stay visible during migration planning." };
}

function withConditionAwareNextAction<T extends LandscapeNodeWithEvidence>(item: T): T {
  const { evidence, posture, id } = item;
  const nextAction = { ...evidence.next_action };

  if (
    (evidence.expected_zero_trust_mode === "machine_access" || evidence.expected_zero_trust_mode === "mixed_access")
    && !evidence.api_surface_live
  ) {
    nextAction.state = "action";
    nextAction.title = "Expose canonical machine contract";
    nextAction.detail = "This node is expected to support machine or mixed access, but the tower cannot see a canonical API route yet. Register or add the machine contract before expanding dependent workflows.";
    nextAction.href = "/watchtower";
  } else if (
    (evidence.expected_zero_trust_mode === "human_access" || evidence.expected_zero_trust_mode === "mixed_access")
    && !evidence.web_surface_live
    && evidence.represented_in_pond
  ) {
    nextAction.state = "action";
    nextAction.title = "Restore governed operator surface";
    nextAction.detail = "This node is meant to be visible to people in the platform, but the tower cannot find a first-class web surface. Add or reattach the governed route.";
    nextAction.href = "/system";
  } else if (!evidence.represented_in_pond && evidence.boundary_class !== "external_governed_system") {
    nextAction.state = posture === "reference_only" ? "watch" : "action";
    nextAction.title = "Close representation gap";
    nextAction.detail = "This lane is active or governed, but it is still outside first-class Pond representation. Either attach it to a canonical Pond surface or classify it explicitly as reference-only/external.";
    nextAction.href = "/system";
  } else if (posture === "trust_hardening") {
    nextAction.state = "action";
    nextAction.title = "Finish Zero Trust hardening";
    nextAction.detail = "The capability exists, but its trust boundary is still under active review. Confirm Access posture, secret authority, and origin-side contract discipline before calling it stable.";
    nextAction.href = "/watchtower";
  } else if (posture === "migration_debt") {
    nextAction.state = "action";
    nextAction.title = "Reduce migration debt";
    nextAction.detail = "This node still carries legacy ownership pressure. Keep useful logic, but move net-new ownership and discoverability into the canonical target path.";
    nextAction.href = "/system";
  } else if (posture === "active_build") {
    nextAction.state = nextAction.state === "clear" ? "watch" : nextAction.state;
    nextAction.detail = evidence.web_surface_live || evidence.api_surface_live
      ? `${nextAction.detail} The surface is already live, so the next step is to finish workflow maturity rather than create another entry point.`
      : `${nextAction.detail} The workflow is still maturing and should be completed in the existing canonical lane.`;
  }

  if (id === "evs" && evidence.api_surface_live) {
    nextAction.state = "clear";
    nextAction.title = "Operate the governed EVS lane";
    nextAction.detail = "EVS now has both the specialized machine-facing contract and a governed Pond bridge. The next move is to mature workflow detail inside that explicit mixed lane, not re-decide where EVS belongs.";
    nextAction.href = "/evs";
  }

  if (id === "vacs" && evidence.api_surface_live) {
    nextAction.state = "action";
    nextAction.title = "Harden live VACS contract";
    nextAction.detail = "The VACS machine contract is live. The next move is to finish Zero Trust and ownership hardening without adding parallel human-surface sprawl.";
    nextAction.href = "/watchtower";
  }

  if (id === "site_content_creator" && evidence.web_surface_live && evidence.api_surface_live) {
    nextAction.state = "action";
    nextAction.title = "Finish governed editorial workflow";
    nextAction.detail = "The surface and API are both live. The remaining work is execution maturity: make the section-level rewrite and approval workflow feel complete inside the existing lane.";
    nextAction.href = "/site-content";
  }

  if (id === "property_intelligence_brief") {
    nextAction.state = "clear";
  }

  return {
    ...item,
    evidence: {
      ...evidence,
      next_action: nextAction,
    },
  };
}

/** GET /insights — Catch of the Day */
pond.get("/insights", async (c) => {
  const db = c.env.POP_BRIEF_DB;

  // Get latest snapshot date
  const latest = await queryFirst<{ snapshot_date: string }>(
    db,
    `SELECT MAX(snapshot_date) as snapshot_date FROM pib_ga4_metrics`
  );
  const weekDate = latest?.snapshot_date ?? null;
  if (!weekDate) {
    return c.json({ week_date: null, insights: [], surface: null });
  }

  // Get previous snapshot date
  const prev = await queryFirst<{ snapshot_date: string }>(
    db,
    `SELECT MAX(snapshot_date) as snapshot_date FROM pib_ga4_metrics WHERE snapshot_date < ?`,
    [weekDate]
  );
  const prevDate = prev?.snapshot_date ?? null;

  const insights: Insight[] = [];

  // 1. Portfolio session trend
  const sessionAgg = await queryFirst<{ total: number; avg_trend: number; count: number }>(
    db,
    `SELECT SUM(total_sessions) as total, AVG(sessions_trend_pct) as avg_trend, COUNT(*) as count
     FROM pib_ga4_metrics WHERE snapshot_date = ?`,
    [weekDate]
  );
  if (sessionAgg && sessionAgg.avg_trend != null) {
    const dir = sessionAgg.avg_trend >= 0 ? "up" : "down";
    const abs = Math.abs(sessionAgg.avg_trend).toFixed(1);
    insights.push({
      id: "sessions-trend",
      icon: dir === "up" ? "trending-up" : "trending-down",
      color: dir === "up" ? "green" : "red",
      title: `Portfolio sessions ${dir} ${abs}%`,
      detail: `${sessionAgg.total?.toLocaleString() ?? 0} total sessions across ${sessionAgg.count} properties this period.`,
    });
  }

  // 2. CIR movers — count properties with improving CIR
  const cirImproved = await queryFirst<{ improved: number; total: number; avg_cir: number }>(
    db,
    `SELECT
       SUM(CASE WHEN cir_trend_pct > 0 THEN 1 ELSE 0 END) as improved,
       COUNT(*) as total,
       AVG(cir_value) as avg_cir
     FROM pib_cir WHERE snapshot_date = ?`,
    [weekDate]
  );
  if (cirImproved && cirImproved.total > 0) {
    const pct = Math.round((cirImproved.improved / cirImproved.total) * 100);
    insights.push({
      id: "cir-movers",
      icon: "zap",
      color: pct >= 50 ? "green" : "amber",
      title: `${cirImproved.improved} of ${cirImproved.total} properties improved CIR`,
      detail: `Portfolio avg CIR is ${cirImproved.avg_cir?.toFixed(1) ?? "—"}%. ${pct}% of properties trending upward.`,
    });
  }

  // 3. Low occupancy alert
  const lowOcc = await queryAll<{ name: string; occupancy: number }>(
    db,
    `SELECT c.name, md.occupancy
     FROM marketing_data md
     JOIN communities c ON c.id = md.community_id
     WHERE md.week_date = ? AND md.occupancy < 90 AND md.occupancy IS NOT NULL
     ORDER BY md.occupancy ASC LIMIT 5`,
    [weekDate]
  );
  if (lowOcc.length > 0) {
    const names = lowOcc.slice(0, 3).map((r) => r.name).join(", ");
    const suffix = lowOcc.length > 3 ? ` +${lowOcc.length - 3} more` : "";
    insights.push({
      id: "low-occupancy",
      icon: "alert",
      color: "red",
      title: `${lowOcc.length} ${lowOcc.length === 1 ? "property" : "properties"} below 90% occupancy`,
      detail: `${names}${suffix}. Lowest: ${lowOcc[0].name} at ${lowOcc[0].occupancy.toFixed(1)}%.`,
    });
  }

  // 4. Top performer — best CIR this week
  const topCir = await queryFirst<{ name: string; cir_value: number; cir_status: string }>(
    db,
    `SELECT c.name, cir.cir_value, cir.cir_status
     FROM pib_cir cir
     JOIN communities c ON c.id = cir.community_id
     WHERE cir.snapshot_date = ? AND cir.cir_value IS NOT NULL
     ORDER BY cir.cir_value DESC LIMIT 1`,
    [weekDate]
  );
  if (topCir) {
    insights.push({
      id: "top-cir",
      icon: "trophy",
      color: "teal",
      title: `${topCir.name} leads CIR at ${topCir.cir_value.toFixed(1)}%`,
      detail: `Status: ${topCir.cir_status ?? "—"}. Highest conversion intent rate in the portfolio.`,
    });
  }

  // 5. Ad spend summary
  const adSpend = await queryFirst<{ total_ppc: number; total_rm: number; count: number }>(
    db,
    `SELECT SUM(COALESCE(google_ppc,0)) as total_ppc, SUM(COALESCE(google_remarketing,0)) as total_rm, COUNT(*) as count
     FROM marketing_data WHERE week_date = ?`,
    [weekDate]
  );
  if (adSpend && (adSpend.total_ppc + adSpend.total_rm) > 0) {
    const total = adSpend.total_ppc + adSpend.total_rm;
    insights.push({
      id: "ad-spend",
      icon: "bar-chart",
      color: "blue",
      title: `$${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} total ad spend`,
      detail: `PPC: $${adSpend.total_ppc.toLocaleString(undefined, { maximumFractionDigits: 0 })} | Remarketing: $${adSpend.total_rm.toLocaleString(undefined, { maximumFractionDigits: 0 })} across ${adSpend.count} properties.`,
    });
  }

  // Surface conditions
  const communityCount = await queryFirst<{ cnt: number }>(
    db,
    `SELECT COUNT(*) as cnt FROM communities WHERE deleted_at IS NULL AND ga4_property_id IS NOT NULL`
  );

  // Try actual source freshness first (from canonical DB sync), fall back to D1 table dates
  const sourceFreshness = await queryAll<{ source_key: string; latest_date: string }>(
    db, `SELECT source_key, latest_date FROM data_freshness`
  ).catch(() => [] as { source_key: string; latest_date: string }[]);

  let freshness: Record<string, string | null>;
  if (sourceFreshness.length > 0) {
    freshness = Object.fromEntries(sourceFreshness.map((r) => [r.source_key, r.latest_date]));
  } else {
    // Fallback to D1 table dates
    const tableFreshness = await queryAll<{ tbl: string; latest: string }>(
      db,
      `SELECT 'ga4' as tbl, MAX(snapshot_date) as latest FROM pib_ga4_metrics
       UNION ALL SELECT 'gsc', MAX(snapshot_date) FROM pib_search_performance
       UNION ALL SELECT 'marketing', MAX(week_date) FROM marketing_data`
    );
    freshness = Object.fromEntries(tableFreshness.map((r) => [r.tbl, r.latest]));
  }

  // Use the most recent date across all data sources for the "Latest" badge
  const latestAcrossSources = sourceFreshness.length > 0
    ? sourceFreshness.reduce((max, r) => (r.latest_date > max ? r.latest_date : max), "")
    : weekDate;

  const surface = {
    latest_snapshot: latestAcrossSources || weekDate,
    prev_snapshot: prevDate,
    community_count: communityCount?.cnt ?? 0,
    freshness,
  };

  return c.json({ week_date: weekDate, insights: insights.slice(0, 5), surface });
});

/** GET /dock-preview — lightweight headline metrics for the dock hub cards */
pond.get("/dock-preview", async (c) => {
  const db = c.env.POP_BRIEF_DB;

  // Latest snapshot date
  const latest = await queryFirst<{ snapshot_date: string }>(
    db, `SELECT MAX(snapshot_date) as snapshot_date FROM pib_ga4_metrics`
  );
  const weekDate = latest?.snapshot_date ?? null;
  if (!weekDate) {
    return c.json({ week_date: null, pib: null, leasing: null, marketing: null, analysis: null });
  }

  // PIB metrics
  const pibAgg = await queryFirst<{ communities: number; avg_cir: number; total_sessions: number; avg_mobile: number; avg_rating: number }>(
    db,
    `SELECT
       COUNT(DISTINCT g.community_id) as communities,
       AVG(cir.cir_value) as avg_cir,
       SUM(g.total_sessions) as total_sessions,
       AVG(sp.mobile_score) as avg_mobile,
       AVG(rv.avg_rating) as avg_rating
     FROM pib_ga4_metrics g
     LEFT JOIN pib_cir cir ON cir.community_id = g.community_id AND cir.snapshot_date = g.snapshot_date
     LEFT JOIN pib_site_performance sp ON sp.community_id = g.community_id AND sp.snapshot_date = g.snapshot_date
     LEFT JOIN pib_reviews rv ON rv.community_id = g.community_id AND rv.snapshot_date = g.snapshot_date
     WHERE g.snapshot_date = ?`,
    [weekDate]
  );

  // Leasing
  const leasingAgg = await queryFirst<{ t7_communities: number; total_gc: number; avg_v_gc: number }>(
    db,
    `SELECT COUNT(DISTINCT community_id) as t7_communities, SUM(g_cards) as total_gc, AVG(v_gc_conv) as avg_v_gc
     FROM t7_metrics WHERE week_date = ? AND type = 'community'`,
    [weekDate]
  );

  // Marketing
  const mktAgg = await queryFirst<{ communities: number; avg_occ: number; total_ad_spend: number }>(
    db,
    `SELECT COUNT(*) as communities, AVG(occupancy) as avg_occ,
       SUM(COALESCE(google_ppc,0) + COALESCE(google_remarketing,0)) as total_ad_spend
     FROM marketing_data WHERE week_date = ?`,
    [weekDate]
  );

  return c.json({
    week_date: weekDate,
    pib: pibAgg ? {
      communities: pibAgg.communities,
      avg_cir: pibAgg.avg_cir != null ? Math.round(pibAgg.avg_cir * 10) / 10 : null,
      total_sessions: pibAgg.total_sessions,
      avg_mobile_score: pibAgg.avg_mobile != null ? Math.round(pibAgg.avg_mobile) : null,
      avg_rating: pibAgg.avg_rating != null ? Math.round(pibAgg.avg_rating * 100) / 100 : null,
    } : null,
    leasing: leasingAgg ? {
      communities: leasingAgg.t7_communities,
      total_guest_cards: leasingAgg.total_gc,
      avg_visit_conv: leasingAgg.avg_v_gc != null ? Math.round(leasingAgg.avg_v_gc * 10) / 10 : null,
    } : null,
    marketing: mktAgg ? {
      communities: mktAgg.communities,
      avg_occupancy: mktAgg.avg_occ != null ? Math.round(mktAgg.avg_occ * 10) / 10 : null,
      total_ad_spend: Math.round(mktAgg.total_ad_spend ?? 0),
    } : null,
  });
});

/** GET /landscape — control-plane landscape awareness snapshot */
pond.get("/landscape", async (c) => {
  const manifest = landscapeManifest;
  const serviceOperations = serviceOperationsManifest;
  const deploymentRuntime = {
    api_request_origin: new URL(c.req.url).origin,
    api_request_host: new URL(c.req.url).host,
    cloudflare_access_team_domain: c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN ?? null,
    access_auto_provision_enabled: c.env.CLOUDFLARE_ACCESS_AUTO_PROVISION_ENABLED === "true",
    access_default_role: c.env.CLOUDFLARE_ACCESS_DEFAULT_ROLE ?? null,
  };

  const canonicalFoundations = manifest.canonical_foundations.map((item) => withMachineEvaluatedRemediation(withConditionAwareNextAction({
    ...item,
    ...deriveFoundationPosture(item.id),
    evidence: deriveFoundationEvidence(item),
  })));
  const productSurfaces = manifest.product_surfaces.map((item) => withMachineEvaluatedRemediation(withConditionAwareNextAction({
    ...item,
    ...deriveProductPosture(item),
    evidence: deriveProductEvidence(item),
  })));
  const legacyOrSpecializedSystems = manifest.legacy_or_specialized_systems.map((item) => withMachineEvaluatedRemediation(withConditionAwareNextAction({
    ...item,
    ...deriveLegacyPosture(item),
    evidence: deriveLegacyEvidence(item),
  })));
  const allNodes = [...canonicalFoundations, ...productSurfaces, ...legacyOrSpecializedSystems];
  const representedInPondCount = allNodes.filter((item) => item.evidence.represented_in_pond).length;
  const offPondCount = allNodes.length - representedInPondCount;
  const machineExpectedNodes = allNodes.filter(
    (item) => item.evidence.expected_zero_trust_mode === "machine_access" || item.evidence.expected_zero_trust_mode === "mixed_access"
  );
  const machineApiGapCount = machineExpectedNodes.filter((item) => !item.evidence.api_surface_live).length;
  const humanExpectedNodes = allNodes.filter(
    (item) => item.evidence.expected_zero_trust_mode === "human_access" || item.evidence.expected_zero_trust_mode === "mixed_access"
  );
  const humanSurfaceGapCount = humanExpectedNodes.filter((item) => !item.evidence.web_surface_live).length;
  const trustReviewCount = allNodes.filter(
    (item) => item.posture === "trust_hardening" || item.posture === "active_build" || item.posture === "migration_debt"
  ).length;
  const trustAlignedCount = allNodes.filter((item) => item.evidence.trust_alignment === "aligned").length;
  const trustTransitionalCount = allNodes.filter((item) => item.evidence.trust_alignment === "transitional").length;
  const trustReviewNodeCount = allNodes.filter((item) => item.evidence.trust_alignment === "review").length;
  const gapRunbook: GapRunbookItem[] = [
    {
      id: "representation",
      label: "Pond Representation",
      state: offPondCount > 0 ? "action" : "clear",
      count: offPondCount,
      detail:
        offPondCount > 0
          ? `${offPondCount} governed or active node(s) still sit outside first-class Pond representation.`
          : "Every governed node is at least represented or intentionally surfaced in The Pond.",
      next_move:
        offPondCount > 0
          ? "Create or extend a canonical Pond surface, or explicitly classify the lane as governed external/reference-only."
          : "Keep new capabilities attached to existing Pond surfaces instead of creating parallel entry points.",
      href: "/system",
    },
    {
      id: "machine_api",
      label: "Machine Contract",
      state: machineApiGapCount > 0 ? "action" : "clear",
      count: machineApiGapCount,
      detail:
        machineApiGapCount > 0
          ? `${machineApiGapCount} machine or mixed-access node(s) do not yet expose a visible canonical API contract.`
          : "Machine-facing lanes currently advertise a visible API contract from the tower.",
      next_move:
        machineApiGapCount > 0
          ? "Add or register the canonical apps/api route and keep the route inventory aligned with expected machine access."
          : "Preserve route inventory discipline as new machine-facing capabilities come online.",
      href: "/watchtower",
    },
    {
      id: "human_surface",
      label: "Human Surface",
      state: humanSurfaceGapCount > 0 ? "watch" : "clear",
      count: humanSurfaceGapCount,
      detail:
        humanSurfaceGapCount > 0
          ? `${humanSurfaceGapCount} human or mixed-access node(s) lack a clear operator-facing surface.`
          : "Human-facing lanes now have an operator or stakeholder surface in the platform.",
      next_move:
        humanSurfaceGapCount > 0
          ? "Add a first-class web route or deliberately keep the lane off-Pond with explicit documentation and boundary notes."
          : "Keep human-facing work discoverable through governed surfaces rather than docs-only entry points.",
      href: "/system",
    },
    {
      id: "trust",
      label: "Trust Hardening",
      state: trustReviewCount > 0 ? "action" : "clear",
      count: trustReviewCount,
      detail:
        trustReviewCount > 0
          ? `${trustReviewCount} node(s) remain under active build, migration debt, or trust hardening review.`
          : "Current landscape posture reads aligned with the expected Zero Trust model.",
      next_move:
        trustReviewCount > 0
          ? "Verify Cloudflare Access posture, Keeper-backed secret authority, and route ownership before calling the lane stable."
          : "Maintain Zero Trust posture as the default boundary for new human and machine access paths.",
      href: "/watchtower",
    },
    {
      id: "repo_boundaries",
      label: "Repo Boundaries",
      state: manifest.nested_git_repos.length > 0 ? "watch" : "clear",
      count: manifest.nested_git_repos.length,
      detail:
        manifest.nested_git_repos.length > 0
          ? `${manifest.nested_git_repos.length} nested repo boundary/boundaries still require explicit migration and ownership awareness.`
          : "No nested repo boundaries are currently tracked in the landscape manifest.",
      next_move:
        manifest.nested_git_repos.length > 0
          ? "Keep nested repos visible in the control plane and assign a canonical migration or integration owner before expanding them further."
          : "Track any new external repo boundary in the manifest before it becomes operationally important.",
      href: "/system",
    },
  ];

  const summary = {
    canonical_foundation_count: manifest.canonical_foundations.length,
    product_surface_count: manifest.product_surfaces.length,
    legacy_or_specialized_count: manifest.legacy_or_specialized_systems.length,
    nested_repo_count: manifest.nested_git_repos.length,
    trust_zone_count: manifest.trust_zones.length,
    represented_in_pond_count: representedInPondCount,
    off_pond_count: offPondCount,
    machine_api_gap_count: machineApiGapCount,
    human_surface_gap_count: humanSurfaceGapCount,
    trust_review_count: trustReviewCount,
    trust_aligned_count: trustAlignedCount,
    trust_transitional_count: trustTransitionalCount,
    trust_review_node_count: trustReviewNodeCount,
  };
  const serviceOperationsSummary = {
    service_count: serviceOperations.services.length,
    foundation_count: serviceOperations.services.filter((item) => item.service_tier === "foundation").length,
    critical_operator_count: serviceOperations.services.filter((item) => item.service_tier === "critical_operator").length,
    governed_workspace_count: serviceOperations.services.filter((item) => item.service_tier === "governance" || item.service_tier === "governed_workspace").length,
    machine_or_mixed_count: serviceOperations.services.filter(
      (item) => item.trust_boundary === "access_protected_machine" || item.trust_boundary === "access_protected_human_and_machine"
    ).length,
    local_runtime_count: serviceOperations.services.filter((item) => item.deployment_target === "local operator runtime").length,
    release_lane_count: new Set(serviceOperations.services.map((item) => item.release_lane)).size,
  };

  return c.json({
    version: manifest.version,
    updated_at: manifest.updated_at,
    purpose: manifest.purpose,
    summary,
    gap_runbook: gapRunbook,
    canonical_foundations: canonicalFoundations,
    product_surfaces: productSurfaces,
    legacy_or_specialized_systems: legacyOrSpecializedSystems,
    nested_git_repos: manifest.nested_git_repos,
    trust_zones: manifest.trust_zones,
    shared_security_posture: manifest.shared_security_posture,
    immediate_priorities: manifest.immediate_priorities,
    outcome_map: outcomeMap,
    enterprise_readiness: enterpriseReadiness,
    release_governance: releaseGovernance,
    service_operations: serviceOperations,
    service_operations_summary: serviceOperationsSummary,
    deployment_provenance: deploymentProvenance,
    deployment_runtime: deploymentRuntime,
    release_provenance: releaseProvenance,
    release_reconcile_snapshot: releaseReconcileSnapshot,
  });
});

export { pond };
