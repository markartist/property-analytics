import { Hono } from "hono";
import { z } from "zod";
import {
  CreateEdgeExperimentDraftPayload,
  EdgeExperimentChangeType,
  EdgeExperimentVariantPayload,
  type EdgeExperiment,
  type EdgeExperimentComponentContract,
  type EdgeExperimentReadiness,
  type EdgeExperimentVariant,
} from "../../../../packages/shared/src";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst, run } from "../lib/db";
import { newId } from "../lib/id";
import { errJson, nowISO, validateSafeText } from "../lib/validate";
import { requireOfferingAction } from "../lib/permissions";

const experiments = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

experiments.use("*", requireAuth);

const EDGE_MESSAGE_ASSET_EXTENSIONS = [
  ".js",
  ".css",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".ico",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
];

const EDGE_MESSAGE_PATH_EXCLUDES = ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"];

const EdgeMessageDraftPayload = z.object({
  id: z.enum(["edge_transparent_pricing_intro_homepage_v1", "edge_message_all_in_pricing_coachmark_v1"]),
  name: z.string().min(1).max(140),
  shape: z.enum(["modal_notice", "anchored_coachmark", "top_banner", "bottom_toast", "inline_callout"]),
  propertyName: z.string().min(1).max(120),
  propertyCode: z.string().min(2).max(20),
  communityId: z.string().min(8).max(80),
  hostname: z.string().min(3).max(120),
  path: z.string().min(1).max(120),
  targetText: z.string().max(120),
  title: z.string().min(1).max(240),
  body: z.string().min(1).max(420),
  disclaimer: z.string().max(360),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  titleColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  bodyColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  disclaimerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  surfaceTextColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  propertyNameFontSize: z.number().int().min(10).max(30),
  titleFontSize: z.number().int().min(12).max(64),
  bodyFontSize: z.number().int().min(12).max(36),
  disclaimerFontSize: z.number().int().min(10).max(24),
  countdownFontSize: z.number().int().min(10).max(30),
  placement: z.string().min(1).max(40),
  triggerMode: z.string().min(1).max(40),
  scrollDepth: z.number().int().min(0).max(100),
  showDelayMs: z.number().int().min(0).max(30000),
  durationMs: z.number().int().min(1000).max(60000),
  fadeMs: z.number().int().min(0).max(5000),
  frequencyCapSeconds: z.number().int().min(0).max(604800),
  ignoreFrequencyCap: z.boolean(),
  decoration: z.enum(["none", "badge", "pulse_badge"]),
  benchmark: z.string().max(180),
});

const PromoteSiteContentContractPayload = CreateEdgeExperimentDraftPayload.pick({
  property_code: true,
  community_id: true,
  website_host: true,
}).extend({
  site_content_page_id: CreateEdgeExperimentDraftPayload.shape.component_id,
  site_content_mapping_id: CreateEdgeExperimentDraftPayload.shape.component_id,
  display_name: CreateEdgeExperimentDraftPayload.shape.name,
  target_label: CreateEdgeExperimentDraftPayload.shape.name.optional(),
  suggested_change_type: EdgeExperimentChangeType.default("text_swap"),
});

const PromoteSpecsContractPayload = CreateEdgeExperimentDraftPayload.pick({
  property_code: true,
  community_id: true,
  website_host: true,
}).extend({
  surface: CreateEdgeExperimentDraftPayload.shape.page_type,
  spec_target: CreateEdgeExperimentDraftPayload.shape.component_id,
  component_name: CreateEdgeExperimentDraftPayload.shape.component_id,
  display_name: CreateEdgeExperimentDraftPayload.shape.name,
  target_label: CreateEdgeExperimentDraftPayload.shape.name,
  page_type: CreateEdgeExperimentDraftPayload.shape.page_type,
  page_path: CreateEdgeExperimentDraftPayload.shape.page_path,
  section_label: CreateEdgeExperimentDraftPayload.shape.name,
  location_label: CreateEdgeExperimentDraftPayload.shape.name,
  action: CreateEdgeExperimentDraftPayload.shape.primary_metric.optional(),
  suggested_change_type: EdgeExperimentChangeType.default("text_swap"),
});

type ExperimentRow = Omit<EdgeExperiment, "variants">;
type VariantRow = Omit<EdgeExperimentVariant, "payload_json"> & { payload_json: string };
type ComponentContractRow = Omit<EdgeExperimentComponentContract, "allowed_change_types" | "required_accessibility_checks"> & {
  allowed_change_types_json: string;
  required_accessibility_checks_json: string;
};
type GuardrailSnapshotRow = {
  guardrail_snapshot_id: string;
  experiment_id: string;
  snapshot_at: string;
  snapshot_date: string;
  variant_key: string;
  guardrail_status: string;
  recommended_action: string | null;
  evidence_json: string | null;
  created_at: string;
};
type ConfigVersionRow = {
  config_version_id: string;
  experiment_id: string;
  config_version: number;
  config_status: string;
  config_json: string;
  config_hash: string;
  signed_at: string | null;
  activated_at: string | null;
  deactivated_at: string | null;
  created_by: string;
  created_at: string;
};
type SiteContentPromotionRow = {
  page_id: string;
  property_id: string;
  page_url: string;
  page_path: string | null;
  page_type: string | null;
  mapping_id: string;
  section_id: string | null;
  expected_section_key: string | null;
  expected_section_label: string | null;
  expected_section_role: string | null;
  expected_order: number | null;
  match_status: string;
  section_key: string | null;
  section_order: number | null;
  section_label: string | null;
  heading: string | null;
  title: string | null;
  section_type: string | null;
  link_count: number | null;
};

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toComponentContract(row: ComponentContractRow): EdgeExperimentComponentContract {
  return {
    component_contract_id: row.component_contract_id,
    component_id: row.component_id,
    page_type: row.page_type,
    page_path: row.page_path ?? null,
    page_path_key: row.page_path_key,
    selector: row.selector,
    allowed_change_types: EdgeExperimentChangeType.array().parse(parseJsonArray(row.allowed_change_types_json)),
    required_accessibility_checks: parseJsonArray(row.required_accessibility_checks_json),
    source: row.source,
    source_reference: row.source_reference ?? null,
    status: row.status,
    last_verified_at: row.last_verified_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 56);
  return slug || "section";
}

function normalizeContractPageType(pageType: string | null | undefined): string {
  if (!pageType || pageType === "homepage") return "property_homepage";
  return pageType.replace(/-/g, "_");
}

function normalizeContractPagePath(pagePath: string | null | undefined): string {
  if (!pagePath) return "/";
  return pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
}

function siteContentDisplayName(row: SiteContentPromotionRow): string {
  return (
    row.title ||
    row.heading ||
    row.section_label ||
    row.expected_section_label ||
    row.expected_section_key ||
    "Page section"
  );
}

function inferAllowedChanges(row: SiteContentPromotionRow): EdgeExperimentChangeType[] {
  const haystack = [
    row.expected_section_key,
    row.expected_section_label,
    row.expected_section_role,
    row.section_key,
    row.section_label,
    row.section_type,
    row.heading,
    row.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasCtaSignal =
    (row.link_count ?? 0) > 0 ||
    haystack.includes("cta") ||
    haystack.includes("hero") ||
    haystack.includes("tour") ||
    haystack.includes("floor");
  return hasCtaSignal ? ["text_swap", "href_swap", "insert_adjacent"] : ["text_swap"];
}

async function getSiteContentPromotionRow(db: D1Database, pageId: string, mappingId: string) {
  return await queryFirst<SiteContentPromotionRow>(
    db,
    `SELECT
       scp.id AS page_id,
       scp.property_id,
       scp.page_url,
       scp.page_path,
       scp.page_type,
       scm.id AS mapping_id,
       scm.section_id,
       scm.expected_section_key,
       scm.expected_section_label,
       scm.expected_section_role,
       scm.expected_order,
       scm.match_status,
       scs.section_key,
       scs.section_order,
       scs.section_label,
       scs.heading,
       scs.title,
       scs.section_type,
       scs.link_count
     FROM site_content_section_mappings scm
     INNER JOIN site_content_pages scp ON scp.id = scm.page_id
     LEFT JOIN site_content_sections scs ON scs.id = scm.section_id
     WHERE scp.id = ? AND scm.id = ?
     LIMIT 1`,
    [pageId, mappingId],
  );
}

function parsePayload(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function toProofSnapshot(row: GuardrailSnapshotRow | null) {
  if (!row) return null;
  return {
    guardrail_snapshot_id: row.guardrail_snapshot_id,
    experiment_id: row.experiment_id,
    snapshot_at: row.snapshot_at,
    snapshot_date: row.snapshot_date,
    variant_key: row.variant_key,
    guardrail_status: row.guardrail_status,
    recommended_action: row.recommended_action,
    evidence: parseJsonObject(row.evidence_json),
    created_at: row.created_at,
  };
}

function toDryRunVersion(row: ConfigVersionRow | null) {
  if (!row) return null;
  return {
    config_version_id: row.config_version_id,
    experiment_id: row.experiment_id,
    config_version: row.config_version,
    config_status: row.config_status,
    config: parseJsonObject(row.config_json),
    config_hash: row.config_hash,
    signed_at: row.signed_at,
    activated_at: row.activated_at,
    deactivated_at: row.deactivated_at,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

async function getLatestPreflight(db: D1Database, experimentId: string) {
  const row = await queryFirst<GuardrailSnapshotRow>(
    db,
    `SELECT guardrail_snapshot_id, experiment_id, snapshot_at, snapshot_date, variant_key, guardrail_status,
            recommended_action, evidence_json, created_at
     FROM edge_experiment_guardrail_snapshots
     WHERE experiment_id = ? AND variant_key = 'preflight'
     ORDER BY snapshot_at DESC
     LIMIT 1`,
    [experimentId],
  );
  return toProofSnapshot(row);
}

async function getLatestDryRun(db: D1Database, experimentId: string) {
  const row = await queryFirst<ConfigVersionRow>(
    db,
    `SELECT config_version_id, experiment_id, config_version, config_status, config_json, config_hash,
            signed_at, activated_at, deactivated_at, created_by, created_at
     FROM edge_experiment_config_versions
     WHERE experiment_id = ? AND config_status = 'dry_run'
     ORDER BY config_version DESC
     LIMIT 1`,
    [experimentId],
  );
  return toDryRunVersion(row);
}

function toVariant(row: VariantRow): EdgeExperimentVariant {
  return {
    ...row,
    payload_json: parsePayload(row.payload_json),
  };
}

async function listVariants(db: D1Database, experimentIds: string[]): Promise<Map<string, EdgeExperimentVariant[]>> {
  const variantsByExperiment = new Map<string, EdgeExperimentVariant[]>();
  if (experimentIds.length === 0) return variantsByExperiment;

  const placeholders = experimentIds.map(() => "?").join(",");
  const rows = await queryAll<VariantRow>(
    db,
    `SELECT * FROM edge_experiment_variants WHERE experiment_id IN (${placeholders}) ORDER BY experiment_id, variant_key`,
    experimentIds,
  );

  for (const row of rows) {
    const list = variantsByExperiment.get(row.experiment_id) ?? [];
    list.push(toVariant(row));
    variantsByExperiment.set(row.experiment_id, list);
  }
  return variantsByExperiment;
}

async function getComponentContract(db: D1Database, pageType: string, componentId: string, pagePath?: string | null) {
  const pagePathKey = pagePath ?? "";
  const row = await queryFirst<ComponentContractRow>(
    db,
    `SELECT * FROM edge_experiment_component_contracts
     WHERE page_type = ? AND component_id = ? AND status = 'active' AND (page_path_key = ? OR page_path_key = '')
     ORDER BY CASE WHEN page_path_key = ? THEN 0 ELSE 1 END
     LIMIT 1`,
    [pageType, componentId, pagePathKey, pagePathKey],
  );
  return row ? toComponentContract(row) : null;
}

async function getExperiment(db: D1Database, experimentId: string): Promise<EdgeExperiment | null> {
  const row = await queryFirst<ExperimentRow>(
    db,
    "SELECT * FROM edge_experiments WHERE experiment_id = ?",
    [experimentId],
  );
  if (!row) return null;
  const variants = await listVariants(db, [experimentId]);
  return { ...row, variants: variants.get(experimentId) ?? [] };
}

function buildReadiness(experiment: EdgeExperiment, contract: EdgeExperimentComponentContract | null): EdgeExperimentReadiness[] {
  const hasVariant = experiment.variants.some((variant) => variant.variant_key !== "control");
  return [
    {
      key: "property_identity",
      label: "Property identity resolved",
      status: experiment.property_code && experiment.community_id ? "pass" : "warning",
      note: experiment.community_id ? `${experiment.property_code} / ${experiment.community_id}` : "Property code is present; community id should be confirmed before preflight.",
    },
    {
      key: "component_contract",
      label: "Component contract resolved",
      status: contract ? "pass" : "fail",
      note: contract ? `${contract.component_id} via ${contract.source}` : "No active component contract found.",
    },
    {
      key: "change_type",
      label: "Change type allowed",
      status: contract?.allowed_change_types.includes(experiment.change_type) ? "pass" : "fail",
      note: contract ? `${experiment.change_type}` : "Requires component contract.",
    },
    {
      key: "variant_payload",
      label: "Variant payload valid",
      status: hasVariant ? "pass" : "fail",
      note: hasVariant ? "Control and B variant are present." : "A non-control variant is required.",
    },
    { key: "worker_dry_run", label: "Worker dry-run proof", status: "not_run", note: "Dry-run execution is the next implementation slice." },
    { key: "evs_preflight", label: "EVS preflight proof", status: "not_run", note: "EVS proof is required before launch." },
    { key: "zaraz_mapping", label: "Zaraz event mapping", status: "not_run", note: "Event routing is not yet attached." },
    { key: "ga4_metric", label: "GA4 primary metric confirmed", status: experiment.primary_metric ? "warning" : "fail", note: experiment.primary_metric || "Primary metric required." },
    { key: "guardrail_policy", label: "Guardrail policy attached", status: experiment.guardrail_policy_id ? "pass" : "fail", note: experiment.guardrail_policy_id },
    { key: "rollback_owner", label: "Rollback owner assigned", status: experiment.rollback_owner ? "pass" : "warning", note: experiment.rollback_owner ?? "Assign before approval." },
    { key: "approval", label: "Approval recorded", status: experiment.approved_by ? "pass" : "not_run", note: experiment.approved_by ?? "Drafts cannot launch." },
  ];
}

function buildWorkerDryRunConfig(experiment: EdgeExperiment, contract: EdgeExperimentComponentContract | null) {
  const treatment = experiment.variants.find((variant) => variant.variant_key !== "control");
  return {
    mode: "dry_run",
    mutates_live_traffic: false,
    fail_open_to_control: true,
    experiment: {
      experiment_id: experiment.experiment_id,
      name: experiment.name,
      property_code: experiment.property_code,
      community_id: experiment.community_id,
      page_type: experiment.page_type,
      page_path: experiment.page_path,
      component_id: experiment.component_id,
      change_type: experiment.change_type,
      primary_metric: experiment.primary_metric,
      traffic_split_pct: experiment.traffic_split_pct,
      assignment_unit: experiment.assignment_unit,
    },
    target: {
      selector: contract?.selector ?? treatment?.target_selector ?? null,
      contract_source: contract?.source ?? experiment.component_contract_source,
      source_reference: contract?.source_reference ?? null,
    },
    treatment: treatment
      ? {
          variant_key: treatment.variant_key,
          action: treatment.action,
          payload: treatment.payload_json,
          allocation_pct: treatment.allocation_pct,
        }
      : null,
    checks: [
      "match target page path",
      "resolve component selector or Site Content mapping reference",
      "validate treatment payload",
      "emit no production assignment cookie",
      "return control HTML unchanged",
    ],
  };
}

function validateVariantPayload(action: string, payload: Record<string, unknown>): string | null {
  const parsed = EdgeExperimentVariantPayload.safeParse(payload);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid variant payload";

  if (action === "text_swap" && !parsed.data.text) return "Text swap requires text.";
  if (action === "class_swap" && !parsed.data.class_name) return "Class swap requires class_name.";
  if (action === "href_swap" && !parsed.data.href) return "Href swap requires href.";
  if (action === "insert_adjacent" && (!parsed.data.text || !parsed.data.href || !parsed.data.tag || !parsed.data.position)) {
    return "Adjacent insertion requires tag, text, href, and position.";
  }
  if (parsed.data.href && !parsed.data.href.startsWith("/") && !parsed.data.href.startsWith("https://venterraliving.com/")) {
    return "Href must be a site-relative path or a venterraliving.com URL.";
  }
  return null;
}

function normalizeLivePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized || "/";
}

function deriveCoachMarkMaxWidth(titleFontSize: number, bodyFontSize: number): number {
  const largest = Math.max(titleFontSize, bodyFontSize);
  if (largest >= 28) return 580;
  if (largest >= 20) return 520;
  return 460;
}

function buildEdgeMessageLiveConfig(draft: z.infer<typeof EdgeMessageDraftPayload>, configVersion: string) {
  const common = {
    id: draft.id,
    configVersion,
    enabled: true,
    hostnames: [draft.hostname],
    pathExact: [normalizeLivePath(draft.path)],
    pathIncludes: [],
    pathExcludes: EDGE_MESSAGE_PATH_EXCLUDES,
    assetExtensions: EDGE_MESSAGE_ASSET_EXTENSIONS,
    cookieMaxAgeSeconds: draft.frequencyCapSeconds,
    ignoreFrequencyCap: draft.ignoreFrequencyCap,
    showDelayMs: draft.showDelayMs,
    durationMs: draft.durationMs,
    fadeMs: draft.fadeMs,
    propertyCode: draft.propertyCode,
    communityId: draft.communityId,
    propertyName: draft.propertyName,
    brandColor: draft.brandColor,
    accentColor: draft.accentColor,
    surfaceTextColor: draft.surfaceTextColor,
    titleColor: draft.titleColor,
    bodyColor: draft.bodyColor,
    disclaimerColor: draft.disclaimerColor,
    propertyNameFontSizePx: draft.propertyNameFontSize,
    titleFontSizePx: draft.titleFontSize,
    bodyFontSizePx: draft.bodyFontSize,
    disclaimerFontSizePx: draft.disclaimerFontSize,
    countdownFontSizePx: draft.countdownFontSize,
    title: draft.title,
    body: draft.body,
    disclaimer: draft.disclaimer,
    analyticsEnabled: true,
  };

  if (draft.shape === "anchored_coachmark") {
    return {
      ...common,
      cookieName: "v_edge_coachmark_seen",
      iconTextColor: "#294782",
      maxWidthPx: deriveCoachMarkMaxWidth(draft.titleFontSize, draft.bodyFontSize),
      targetText: draft.targetText,
      closeLabel: "Close all-in pricing tip",
    };
  }

  return {
    ...common,
    cookieName: "v_edge_msg_seen",
    forceCookieName: "v_edge_msg_force_once",
    resetCookieName: "v_edge_msg_reset_once",
    forceParam: "edge_popup_force",
    resetParam: "edge_popup_reset",
    waitForUnitSelectors: false,
    brandName: "VENTERRA",
    autoCloseTextPrefix: "Closing in",
    closeLabel: "Close pricing message",
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureEdgeMessageExperiment(db: D1Database, draft: z.infer<typeof EdgeMessageDraftPayload>, userId: string, now: string) {
  await run(
    db,
    `INSERT INTO edge_experiments (
      experiment_id,
      name,
      description,
      hypothesis,
      status,
      property_code,
      community_id,
      website_host,
      page_type,
      page_path,
      component_id,
      component_contract_source,
      change_type,
      primary_metric,
      guardrail_policy_id,
      traffic_split_pct,
      assignment_unit,
      rollback_owner,
      created_by,
      approved_by,
      created_at,
      updated_at,
      approved_at,
      started_at,
      notes
    ) VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, 'edge_message_admin', 'insert_adjacent', 'pricing_detail_click_rate', 'edge_message_beta_guardrails', 100, 'anonymous_visitor', ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(experiment_id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      status = 'running',
      property_code = excluded.property_code,
      community_id = excluded.community_id,
      website_host = excluded.website_host,
      page_type = excluded.page_type,
      page_path = excluded.page_path,
      component_id = excluded.component_id,
      updated_at = excluded.updated_at,
      notes = excluded.notes`,
    [
      draft.id,
      draft.name,
      "Live Edge Message config published from the Edge Messages admin.",
      "Make required monthly fee/rent clarity easier for visitors to notice without degrading unit browsing.",
      draft.propertyCode,
      draft.communityId,
      draft.hostname,
      draft.shape,
      normalizeLivePath(draft.path),
      draft.id,
      userId,
      userId,
      userId,
      now,
      now,
      now,
      now,
      "Config is read by the Cloudflare edge-transparent-pricing-intro-beta Worker from D1 active config versions.",
    ],
  );
}

async function resolveCommunity(db: D1Database, propertyCode: string, communityId?: string) {
  if (communityId) {
    return await queryFirst<{ id: string; name: string; encasa_property_code: string | null; full_url: string | null }>(
      db,
      "SELECT id, name, encasa_property_code, full_url FROM communities WHERE id = ? AND deleted_at IS NULL",
      [communityId],
    );
  }
  return await queryFirst<{ id: string; name: string; encasa_property_code: string | null; full_url: string | null }>(
    db,
    "SELECT id, name, encasa_property_code, full_url FROM communities WHERE encasa_property_code = ? AND deleted_at IS NULL",
    [propertyCode],
  );
}

experiments.get("/", requireOfferingAction("experiments", "view"), async (c) => {
  const rows = await queryAll<ExperimentRow>(
    c.env.POP_BRIEF_DB,
    "SELECT * FROM edge_experiments ORDER BY updated_at DESC, created_at DESC LIMIT 100",
  );
  const variants = await listVariants(c.env.POP_BRIEF_DB, rows.map((row) => row.experiment_id));
  const experimentList: EdgeExperiment[] = rows.map((row) => ({ ...row, variants: variants.get(row.experiment_id) ?? [] }));

  const contractRows = await queryAll<ComponentContractRow>(
    c.env.POP_BRIEF_DB,
    "SELECT * FROM edge_experiment_component_contracts WHERE status = 'active' ORDER BY page_type, component_id",
  );
  const componentContracts = contractRows.map(toComponentContract);
  const activeStatuses = new Set(["approved", "scheduled", "running", "paused"]);
  const blockedStatuses = new Set(["preflight_failed", "rolled_back"]);

  return c.json({
    experiments: experimentList,
    component_contracts: componentContracts,
    summary: {
      total: experimentList.length,
      draft: experimentList.filter((experiment) => experiment.status === "draft").length,
      active: experimentList.filter((experiment) => activeStatuses.has(experiment.status)).length,
      blocked: experimentList.filter((experiment) => blockedStatuses.has(experiment.status)).length,
      contracts: componentContracts.length,
    },
  });
});

experiments.get("/component-contracts", requireOfferingAction("experiments", "view"), async (c) => {
  const rows = await queryAll<ComponentContractRow>(
    c.env.POP_BRIEF_DB,
    "SELECT * FROM edge_experiment_component_contracts WHERE status = 'active' ORDER BY page_type, component_id",
  );
  return c.json({ component_contracts: rows.map(toComponentContract) });
});

experiments.post("/component-contracts/site-content", requireOfferingAction("experiments", "draft"), async (c) => {
  const parsed = PromoteSiteContentContractPayload.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(errJson("VALIDATION_ERROR", "Invalid Site Content promotion payload", parsed.error.issues), 400);
  }

  const payload = parsed.data;
  const community = await resolveCommunity(c.env.POP_BRIEF_DB, payload.property_code, payload.community_id);
  if (!community) {
    return c.json(errJson("VALIDATION_ERROR", "Property identity did not resolve to an active Data Pond community"), 400);
  }
  if (payload.community_id && community.encasa_property_code && community.encasa_property_code !== payload.property_code) {
    return c.json(errJson("VALIDATION_ERROR", "Property code does not match selected community identity"), 400);
  }

  const siteContentItem = await getSiteContentPromotionRow(
    c.env.POP_BRIEF_DB,
    payload.site_content_page_id,
    payload.site_content_mapping_id,
  );
  if (!siteContentItem) return c.json(errJson("NOT_FOUND", "Site Content section mapping not found"), 404);
  if (!["matched", "partial"].includes(siteContentItem.match_status)) {
    return c.json(errJson("VALIDATION_ERROR", "Only matched or partially matched Site Content sections can be prepared for testing"), 400);
  }

  const sectionName = siteContentDisplayName(siteContentItem);
  const targetLabel = payload.target_label?.trim() || payload.display_name.trim() || sectionName;
  const displayName = payload.display_name.trim() || targetLabel;
  const pageType = normalizeContractPageType(siteContentItem.page_type);
  const pagePath = normalizeContractPagePath(siteContentItem.page_path);
  const pagePathKey = pagePath;
  const sectionSlug = slugify(
    siteContentItem.expected_section_key ||
      siteContentItem.section_key ||
      sectionName,
  );
  const targetSlug = slugify(targetLabel);
  const mappingSlug = slugify(siteContentItem.mapping_id).slice(0, 12);
  const componentId = `site_content.${pageType}.${sectionSlug}.${targetSlug}_${mappingSlug}`;
  const contractId = `contract_${slugify(componentId)}`;
  const allowedChanges = inferAllowedChanges(siteContentItem);
  if (!allowedChanges.includes(payload.suggested_change_type)) allowedChanges.unshift(payload.suggested_change_type);
  const selector = `site-content://page/${siteContentItem.page_id}/mapping/${siteContentItem.mapping_id}`;
  const now = nowISO();

  await run(
    c.env.POP_BRIEF_DB,
    `INSERT INTO edge_experiment_component_contracts (
      component_contract_id,
      component_id,
      page_type,
      page_path,
      page_path_key,
      selector,
      allowed_change_types_json,
      required_accessibility_checks_json,
      source,
      source_reference,
      status,
      last_verified_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'site_content_section_mapping', ?, 'active', NULL, ?, ?)
    ON CONFLICT(component_id, page_type, page_path_key) DO UPDATE SET
      selector = excluded.selector,
      allowed_change_types_json = excluded.allowed_change_types_json,
      required_accessibility_checks_json = excluded.required_accessibility_checks_json,
      source = excluded.source,
      source_reference = excluded.source_reference,
      status = 'active',
      updated_at = excluded.updated_at`,
    [
      contractId,
      componentId,
      pageType,
      pagePath,
      pagePathKey,
      selector,
      JSON.stringify(allowedChanges),
      JSON.stringify(["cta_text_present", "href_safe", "keyboard_focusable", "mobile_visible", "evs_preflight_required"]),
      JSON.stringify({
        system: "site_content",
        property_code: payload.property_code,
        community_id: community.id,
        page_id: siteContentItem.page_id,
        mapping_id: siteContentItem.mapping_id,
        section_id: siteContentItem.section_id,
        section_name: sectionName,
        target_label: targetLabel,
        display_name: displayName,
        page_url: siteContentItem.page_url,
      }),
      now,
      now,
    ],
  );

  const contract = await getComponentContract(c.env.POP_BRIEF_DB, pageType, componentId, pagePath);
  if (!contract) return c.json(errJson("INTERNAL_ERROR", "Prepared component contract could not be reloaded"), 500);

  return c.json({
    component_contract: contract,
    suggested_draft: {
      name: `${targetLabel} CTA test`,
      hypothesis: `Changing the ${targetLabel} CTA in ${sectionName} will improve qualified visitor engagement without hurting tour intent.`,
      page_type: pageType,
      page_path: pagePath,
      component_id: componentId,
      change_type: payload.suggested_change_type,
      primary_metric: allowedChanges.includes("insert_adjacent") || allowedChanges.includes("href_swap") ? "floorplan_click_rate" : "tour_click_rate",
      variant_text: allowedChanges.includes("insert_adjacent") ? "View Floor Plans" : targetLabel,
      variant_href: `${pagePath.replace(/\/$/, "")}/floorplans/`.replace(/^\/\//, "/"),
    },
  });
});

experiments.post("/component-contracts/specs", requireOfferingAction("experiments", "draft"), async (c) => {
  const parsed = PromoteSpecsContractPayload.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(errJson("VALIDATION_ERROR", "Invalid Specs promotion payload", parsed.error.issues), 400);
  }

  const payload = parsed.data;
  const community = await resolveCommunity(c.env.POP_BRIEF_DB, payload.property_code, payload.community_id);
  if (!community) {
    return c.json(errJson("VALIDATION_ERROR", "Property identity did not resolve to an active Data Pond community"), 400);
  }
  if (payload.community_id && community.encasa_property_code && community.encasa_property_code !== payload.property_code) {
    return c.json(errJson("VALIDATION_ERROR", "Property code does not match selected community identity"), 400);
  }

  const pageType = normalizeContractPageType(payload.page_type);
  const pagePath = normalizeContractPagePath(payload.page_path);
  const surfaceSlug = slugify(payload.surface);
  const specSlug = slugify(payload.spec_target);
  const componentSlug = slugify(payload.component_name);
  const targetSlug = slugify(payload.target_label);
  const componentId = `specs.${surfaceSlug}.${componentSlug}.${targetSlug}`;
  const contractId = `contract_${slugify(componentId)}`;
  const allowedChanges = Array.from(new Set([payload.suggested_change_type, "text_swap", "href_swap"]));
  const selector = `specs://${payload.spec_target}/${payload.component_name}`;
  const now = nowISO();

  await run(
    c.env.POP_BRIEF_DB,
    `INSERT INTO edge_experiment_component_contracts (
      component_contract_id,
      component_id,
      page_type,
      page_path,
      page_path_key,
      selector,
      allowed_change_types_json,
      required_accessibility_checks_json,
      source,
      source_reference,
      status,
      last_verified_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'specs_contract', ?, 'active', NULL, ?, ?)
    ON CONFLICT(component_id, page_type, page_path_key) DO UPDATE SET
      selector = excluded.selector,
      allowed_change_types_json = excluded.allowed_change_types_json,
      required_accessibility_checks_json = excluded.required_accessibility_checks_json,
      source = excluded.source,
      source_reference = excluded.source_reference,
      status = 'active',
      updated_at = excluded.updated_at`,
    [
      contractId,
      componentId,
      pageType,
      pagePath,
      pagePath,
      selector,
      JSON.stringify(allowedChanges),
      JSON.stringify(["specs_target_present", "live_selector_required", "href_safe", "keyboard_focusable", "mobile_visible", "evs_preflight_required"]),
      JSON.stringify({
        system: "specs",
        property_code: payload.property_code,
        community_id: community.id,
        surface: payload.surface,
        spec_target: payload.spec_target,
        component_name: payload.component_name,
        target_label: payload.target_label,
        display_name: payload.display_name,
        section_label: payload.section_label,
        location_label: payload.location_label,
        action: payload.action ?? null,
      }),
      now,
      now,
    ],
  );

  const contract = await getComponentContract(c.env.POP_BRIEF_DB, pageType, componentId, pagePath);
  if (!contract) return c.json(errJson("INTERNAL_ERROR", "Prepared Specs component contract could not be reloaded"), 500);

  const isProspectAction =
    payload.action?.includes("prospect") ||
    payload.action?.includes("apartments") ||
    payload.action?.includes("tour") ||
    payload.target_label.toLowerCase().includes("tour") ||
    payload.target_label.toLowerCase().includes("home") ||
    payload.target_label.toLowerCase().includes("apply");

  return c.json({
    component_contract: contract,
    suggested_draft: {
      name: `${payload.target_label} ${payload.surface} test`,
      hypothesis: `Improving the ${payload.target_label} action in ${payload.location_label} will make the prospect path easier to find without reducing tour intent.`,
      page_type: pageType,
      page_path: pagePath,
      component_id: componentId,
      change_type: payload.suggested_change_type,
      primary_metric: isProspectAction ? "floorplan_click_rate" : "tour_click_rate",
      variant_text: payload.target_label,
      variant_href: pagePath === "/" ? "/floorplans/" : pagePath,
    },
  });
});

experiments.post("/", requireOfferingAction("experiments", "draft"), async (c) => {
  const parsed = CreateEdgeExperimentDraftPayload.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(errJson("VALIDATION_ERROR", "Invalid experiment draft payload", parsed.error.issues), 400);
  }

  const payload = parsed.data;
  for (const [field, value] of Object.entries({
    name: payload.name,
    description: payload.description,
    hypothesis: payload.hypothesis,
    notes: payload.notes,
  })) {
    const unsafe = validateSafeText(value, field);
    if (unsafe) return c.json(errJson("VALIDATION_ERROR", unsafe), 400);
  }

  const community = await resolveCommunity(c.env.POP_BRIEF_DB, payload.property_code, payload.community_id);
  if (!community) {
    return c.json(errJson("VALIDATION_ERROR", "Property identity did not resolve to an active Data Pond community"), 400);
  }
  if (payload.community_id && community.encasa_property_code && community.encasa_property_code !== payload.property_code) {
    return c.json(errJson("VALIDATION_ERROR", "Property code does not match selected community identity"), 400);
  }

  const contract = await getComponentContract(c.env.POP_BRIEF_DB, payload.page_type, payload.component_id, payload.page_path);
  if (!contract) {
    return c.json(errJson("VALIDATION_ERROR", "No active governed component contract found for that page/component"), 400);
  }
  if (!contract.allowed_change_types.includes(payload.change_type)) {
    return c.json(errJson("VALIDATION_ERROR", `Component contract does not allow ${payload.change_type}`), 400);
  }
  if (payload.variant.action !== payload.change_type) {
    return c.json(errJson("VALIDATION_ERROR", "Variant action must match experiment change type for MVP"), 400);
  }

  const payloadError = validateVariantPayload(payload.variant.action, payload.variant.payload);
  if (payloadError) return c.json(errJson("VALIDATION_ERROR", payloadError), 400);

  const now = nowISO();
  const user = c.get("user");
  const experimentId = `exp_${newId()}`;
  const controlVariantId = `var_${newId()}`;
  const treatmentVariantId = `var_${newId()}`;
  const controlAllocation = 100 - payload.traffic_split_pct;

  await run(
    c.env.POP_BRIEF_DB,
    `INSERT INTO edge_experiments (
      experiment_id, name, description, hypothesis, status, property_code, community_id, website_host,
      page_type, page_path, component_id, component_contract_source, change_type, primary_metric,
      guardrail_policy_id, traffic_split_pct, assignment_unit, rollback_owner, created_by, created_at,
      updated_at, notes
    ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      experimentId,
      payload.name,
      payload.description ?? null,
      payload.hypothesis,
      payload.property_code,
      community.id,
      payload.website_host ?? null,
      payload.page_type,
      payload.page_path,
      payload.component_id,
      contract.source,
      payload.change_type,
      payload.primary_metric,
      payload.guardrail_policy_id,
      payload.traffic_split_pct,
      payload.assignment_unit,
      payload.rollback_owner ?? null,
      user.email,
      now,
      now,
      payload.notes ?? null,
    ],
  );

  await run(
    c.env.POP_BRIEF_DB,
    `INSERT INTO edge_experiment_variants (
      variant_id, experiment_id, variant_key, allocation_pct, action, target_selector, target_component_id,
      payload_json, html_safety_hash, accessibility_notes, created_at, updated_at
    ) VALUES (?, ?, 'control', ?, 'none', ?, ?, '{}', NULL, 'Control variant preserves the original page.', ?, ?)`,
    [controlVariantId, experimentId, controlAllocation, contract.selector, contract.component_id, now, now],
  );

  await run(
    c.env.POP_BRIEF_DB,
    `INSERT INTO edge_experiment_variants (
      variant_id, experiment_id, variant_key, allocation_pct, action, target_selector, target_component_id,
      payload_json, html_safety_hash, accessibility_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    [
      treatmentVariantId,
      experimentId,
      payload.variant.variant_key,
      payload.traffic_split_pct,
      payload.variant.action,
      contract.selector,
      contract.component_id,
      JSON.stringify(payload.variant.payload),
      `MVP ${payload.variant.action} payload validated against governed component contract.`,
      now,
      now,
    ],
  );

  const experiment = await getExperiment(c.env.POP_BRIEF_DB, experimentId);
  if (!experiment) return c.json(errJson("INTERNAL_ERROR", "Experiment disappeared after creation"), 500);
  return c.json({ experiment, component_contract: contract, readiness: buildReadiness(experiment, contract) }, 201);
});

experiments.post("/edge-messages/:messageId/live-config", requireOfferingAction("experiments", "administer"), async (c) => {
  const parsed = EdgeMessageDraftPayload.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(errJson("VALIDATION_ERROR", "Invalid Edge Message live config payload", parsed.error.issues), 400);
  }

  const draft = parsed.data;
  const messageId = c.req.param("messageId");
  if (messageId !== draft.id) {
    return c.json(errJson("VALIDATION_ERROR", "Route message id must match payload id"), 400);
  }
  if (draft.id === "edge_message_all_in_pricing_coachmark_v1" && draft.shape !== "anchored_coachmark") {
    return c.json(errJson("VALIDATION_ERROR", "All-In pricing message must remain a coach mark"), 400);
  }
  if (draft.id === "edge_transparent_pricing_intro_homepage_v1" && draft.shape !== "modal_notice") {
    return c.json(errJson("VALIDATION_ERROR", "Homepage transparent pricing message must remain a modal notice"), 400);
  }

  for (const [field, value] of Object.entries({
    name: draft.name,
    title: draft.title,
    body: draft.body,
    disclaimer: draft.disclaimer,
    targetText: draft.targetText,
  })) {
    const unsafe = validateSafeText(value, field);
    if (unsafe) return c.json(errJson("VALIDATION_ERROR", unsafe), 400);
  }

  const now = nowISO();
  const user = c.get("user");
  await ensureEdgeMessageExperiment(c.env.POP_BRIEF_DB, draft, user.id, now);

  const latest = await queryFirst<{ max_version: number | null }>(
    c.env.POP_BRIEF_DB,
    "SELECT MAX(config_version) AS max_version FROM edge_experiment_config_versions WHERE experiment_id = ?",
    [draft.id],
  );
  const nextVersion = (latest?.max_version ?? 0) + 1;
  const configVersionLabel = `edge-message-admin-v${nextVersion}`;
  const config = buildEdgeMessageLiveConfig(draft, configVersionLabel);
  const configJson = JSON.stringify(config);
  const configHash = await sha256Hex(configJson);
  const configVersionId = `cfg_${newId()}`;

  await run(
    c.env.POP_BRIEF_DB,
    `UPDATE edge_experiment_config_versions
     SET config_status = 'replaced', deactivated_at = ?
     WHERE experiment_id = ? AND config_status = 'active'`,
    [now, draft.id],
  );

  await run(
    c.env.POP_BRIEF_DB,
    `INSERT INTO edge_experiment_config_versions (
      config_version_id,
      experiment_id,
      config_version,
      config_status,
      config_json,
      config_hash,
      signed_at,
      activated_at,
      deactivated_at,
      created_by,
      created_at
    ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, NULL, ?, ?)`,
    [configVersionId, draft.id, nextVersion, configJson, configHash, now, now, user.id, now],
  );

  return c.json({
    live_config: {
      config_version_id: configVersionId,
      experiment_id: draft.id,
      config_version: nextVersion,
      config_status: "active",
      config_hash: configHash,
      activated_at: now,
      created_by: user.email,
      config,
    },
  });
});

experiments.get("/:experimentId", requireOfferingAction("experiments", "view"), async (c) => {
  const experiment = await getExperiment(c.env.POP_BRIEF_DB, c.req.param("experimentId"));
  if (!experiment) return c.json(errJson("NOT_FOUND", "Experiment not found"), 404);
  const contract = await getComponentContract(c.env.POP_BRIEF_DB, experiment.page_type, experiment.component_id, experiment.page_path);
  const latestPreflight = await getLatestPreflight(c.env.POP_BRIEF_DB, experiment.experiment_id);
  const latestDryRun = await getLatestDryRun(c.env.POP_BRIEF_DB, experiment.experiment_id);
  return c.json({
    experiment,
    component_contract: contract,
    readiness: buildReadiness(experiment, contract),
    latest_preflight: latestPreflight,
    latest_dry_run: latestDryRun,
  });
});

experiments.post("/:experimentId/preflight", requireOfferingAction("experiments", "draft"), async (c) => {
  const experiment = await getExperiment(c.env.POP_BRIEF_DB, c.req.param("experimentId"));
  if (!experiment) return c.json(errJson("NOT_FOUND", "Experiment not found"), 404);
  const contract = await getComponentContract(c.env.POP_BRIEF_DB, experiment.page_type, experiment.component_id, experiment.page_path);
  if (!contract) return c.json(errJson("VALIDATION_ERROR", "Component contract must resolve before preflight can be requested"), 400);

  const now = nowISO();
  const date = now.slice(0, 10);
  const treatment = experiment.variants.find((variant) => variant.variant_key !== "control");
  const evidence = {
    proof_type: "evs_preflight_request",
    status: "awaiting_external_evs_execution",
    message: "Preflight request recorded. External EVS/BrowserStack execution must still provide screenshot and interaction proof before launch.",
    checklist: [
      { label: "Page found", status: "queued", detail: experiment.page_path },
      { label: "Component found", status: "queued", detail: contract.selector },
      { label: "Change is safe", status: treatment ? "pass" : "fail", detail: treatment ? `${treatment.action} payload is present` : "Treatment variant missing" },
      { label: "Mobile proof", status: "queued", detail: "EVS iphone_safari run required" },
      { label: "Desktop proof", status: "queued", detail: "EVS desktop_chrome run required" },
      { label: "Metrics ready", status: experiment.primary_metric ? "pass" : "fail", detail: experiment.primary_metric },
      { label: "Rollback ready", status: experiment.rollback_owner ? "pass" : "queued", detail: experiment.rollback_owner ?? "Assign owner before approval" },
    ],
    evs_request_seed: {
      source_consumer: "operator",
      environment: "staging",
      priority: "normal",
      validation_profiles: ["critical_cta_smoke", "broad_experiential_homepage"],
      device_profiles: ["iphone_safari", "desktop_chrome"],
      execution_mode: "manual",
      governance_context: {
        experiment_id: experiment.experiment_id,
        component_id: experiment.component_id,
        property_code: experiment.property_code,
      },
    },
  };

  await run(
    c.env.POP_BRIEF_DB,
    `INSERT INTO edge_experiment_guardrail_snapshots (
      guardrail_snapshot_id, experiment_id, snapshot_at, snapshot_date, variant_key,
      selector_miss_rate, worker_error_rate, analytics_event_loss_rate, guardrail_status,
      recommended_action, evidence_json, created_at
    ) VALUES (?, ?, ?, ?, 'preflight', NULL, NULL, NULL, 'watch', ?, ?, ?)`,
    [
      `preflight_${newId()}`,
      experiment.experiment_id,
      now,
      date,
      "Hand off this request to EVS and attach screenshot/interaction proof before approval.",
      JSON.stringify(evidence),
      now,
    ],
  );

  await run(
    c.env.POP_BRIEF_DB,
    "UPDATE edge_experiments SET status = 'pending_preflight', updated_at = ? WHERE experiment_id = ? AND status = 'draft'",
    [now, experiment.experiment_id],
  );

  const updated = await getExperiment(c.env.POP_BRIEF_DB, experiment.experiment_id);
  if (!updated) return c.json(errJson("INTERNAL_ERROR", "Experiment disappeared after preflight request"), 500);
  const latestPreflight = await getLatestPreflight(c.env.POP_BRIEF_DB, experiment.experiment_id);
  const latestDryRun = await getLatestDryRun(c.env.POP_BRIEF_DB, experiment.experiment_id);
  return c.json({
    experiment: updated,
    component_contract: contract,
    readiness: buildReadiness(updated, contract),
    latest_preflight: latestPreflight,
    latest_dry_run: latestDryRun,
  });
});

experiments.post("/:experimentId/dry-run", requireOfferingAction("experiments", "draft"), async (c) => {
  const experiment = await getExperiment(c.env.POP_BRIEF_DB, c.req.param("experimentId"));
  if (!experiment) return c.json(errJson("NOT_FOUND", "Experiment not found"), 404);
  const contract = await getComponentContract(c.env.POP_BRIEF_DB, experiment.page_type, experiment.component_id, experiment.page_path);
  if (!contract) return c.json(errJson("VALIDATION_ERROR", "Component contract must resolve before dry-run can be generated"), 400);
  if (!experiment.variants.some((variant) => variant.variant_key !== "control")) {
    return c.json(errJson("VALIDATION_ERROR", "Treatment variant is required before dry-run can be generated"), 400);
  }

  const latest = await queryFirst<{ max_version: number | null }>(
    c.env.POP_BRIEF_DB,
    "SELECT MAX(config_version) AS max_version FROM edge_experiment_config_versions WHERE experiment_id = ?",
    [experiment.experiment_id],
  );
  const nextVersion = (latest?.max_version ?? 0) + 1;
  const config = buildWorkerDryRunConfig(experiment, contract);
  const configJson = JSON.stringify(config);
  const now = nowISO();
  const user = c.get("user");

  await run(
    c.env.POP_BRIEF_DB,
    `INSERT INTO edge_experiment_config_versions (
      config_version_id, experiment_id, config_version, config_status, config_json,
      config_hash, signed_at, activated_at, deactivated_at, created_by, created_at
    ) VALUES (?, ?, ?, 'dry_run', ?, ?, NULL, NULL, NULL, ?, ?)`,
    [
      `cfg_${newId()}`,
      experiment.experiment_id,
      nextVersion,
      configJson,
      `dry_${nextVersion}_${newId().slice(0, 8)}`,
      user.email,
      now,
    ],
  );

  const latestPreflight = await getLatestPreflight(c.env.POP_BRIEF_DB, experiment.experiment_id);
  const latestDryRun = await getLatestDryRun(c.env.POP_BRIEF_DB, experiment.experiment_id);
  return c.json({
    experiment,
    component_contract: contract,
    readiness: buildReadiness(experiment, contract),
    latest_preflight: latestPreflight,
    latest_dry_run: latestDryRun,
  });
});

experiments.get("/:experimentId/config", requireOfferingAction("experiments", "view"), async (c) => {
  const experiment = await getExperiment(c.env.POP_BRIEF_DB, c.req.param("experimentId"));
  if (!experiment) return c.json(errJson("NOT_FOUND", "Experiment not found"), 404);
  return c.json({
    mode: "preview_only",
    note: "Worker execution is intentionally locked until dry-run and EVS proof are implemented.",
    config: {
      experiment_id: experiment.experiment_id,
      status: experiment.status,
      property_code: experiment.property_code,
      community_id: experiment.community_id,
      page_type: experiment.page_type,
      page_path: experiment.page_path,
      component_id: experiment.component_id,
      traffic_split_pct: experiment.traffic_split_pct,
      assignment_unit: experiment.assignment_unit,
      variants: experiment.variants,
    },
  });
});

export { experiments };
