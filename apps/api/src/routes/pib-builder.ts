import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireRole } from "../middleware/auth";
import { queryAll, queryFirst, run } from "../lib/db";
import { newId } from "../lib/id";
import { errJson, nowISO, validateSafeText } from "../lib/validate";
import { writeAuditLog } from "../lib/audit";
import { sendEmail } from "../email/resend";

type Scope = "portfolio" | "property";
type Cadence = "one_time" | "weekly" | "monthly" | "quarterly";
type ScheduleStatus = "draft" | "active" | "paused" | "archived";
type GenerationJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
type GenerationJobAction = "open" | "email_now" | "save" | "scheduled_email";

type ConfigRow = {
  id: string;
  report_name: string;
  scope: Scope;
  community_id: string | null;
  community_name: string | null;
  date_range: string;
  preset_id: string;
  preset_label: string;
  section_ids_json: string;
  canonical_path: string;
  status: "active" | "archived";
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type ScheduleRow = {
  id: string;
  config_id: string;
  cadence: Cadence;
  timezone: string;
  day_of_week: number | null;
  day_of_month: string | null;
  send_time: string;
  recipients_json: string;
  status: ScheduleStatus;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  failure_count: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type RunRow = {
  id: string;
  schedule_id: string | null;
  config_id: string;
  run_type: "manual" | "scheduled";
  run_status: "queued" | "blocked" | "sent" | "failed" | "skipped";
  scheduled_for: string | null;
  started_at: string | null;
  finished_at: string | null;
  canonical_path: string;
  recipients_json: string;
  delivery_status: string;
  delivery_error: string | null;
  snapshot_json: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type JoinedDueScheduleRow = ScheduleRow & {
  report_name: string;
  scope: Scope;
  community_id: string | null;
  community_name: string | null;
  date_range: string;
  preset_id: string;
  preset_label: string;
  section_ids_json: string;
  canonical_path: string;
};

type PibArtifactTarget = {
  scope: Scope;
  community_name: string | null;
};

type PibArtifact = {
  key: string;
  filename: string;
  size: number | undefined;
  uploaded: string | null;
  html: string;
};

type GenerationJobRow = {
  id: string;
  config_id: string;
  run_id: string | null;
  requested_action: GenerationJobAction;
  status: GenerationJobStatus;
  scope: Scope;
  community_id: string | null;
  community_name: string | null;
  date_range: string;
  preset_id: string;
  preset_label: string;
  section_ids_json: string;
  recipients_json: string;
  artifact_key: string | null;
  artifact_filename: string | null;
  artifact_html: string | null;
  error_text: string | null;
  created_by: string | null;
  claimed_by: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type GenerationArtifactChunkRow = {
  chunk_text: string;
};

const pibBuilder = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
pibBuilder.use("*", requireAuth);

const DEFAULT_FRONTEND_URL = "https://app.venterradev.com";

const SectionIds = z.array(z.string().min(1).max(120)).min(1).max(40);
const Recipients = z.array(z.string().email().max(160)).min(1).max(50);

const ConfigPayload = z.object({
  report_name: z.string().min(1).max(160),
  scope: z.enum(["portfolio", "property"]),
  community_id: z.string().max(120).nullable().optional(),
  community_name: z.string().max(160).nullable().optional(),
  date_range: z.string().min(1).max(80),
  preset_id: z.string().min(1).max(80),
  preset_label: z.string().min(1).max(120),
  section_ids: SectionIds,
});

const ConfigPatchPayload = ConfigPayload.partial().extend({
  status: z.enum(["active", "archived"]).optional(),
});

const SchedulePayload = z.object({
  config_id: z.string().min(1).max(80),
  cadence: z.enum(["one_time", "weekly", "monthly", "quarterly"]),
  timezone: z.string().min(1).max(80).default("America/Chicago"),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  day_of_month: z.string().max(24).nullable().optional(),
  send_time: z.string().regex(/^\d{2}:\d{2}$/),
  recipients: Recipients,
  status: z.enum(["draft", "active", "paused"]).default("draft"),
});

const SchedulePatchPayload = SchedulePayload.omit({ config_id: true }).partial().extend({
  config_id: z.string().min(1).max(80).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
});

const GenerationJobPayload = z.object({
  requested_action: z.enum(["open", "email_now", "save", "scheduled_email"]),
  recipients: z.array(z.string().email().max(160)).max(50).default([]),
  run_id: z.string().max(80).nullable().optional(),
});

function jsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toConfig(row: ConfigRow) {
  return {
    id: row.id,
    report_name: row.report_name,
    scope: row.scope,
    community_id: row.community_id,
    community_name: row.community_name,
    date_range: row.date_range,
    preset_id: row.preset_id,
    preset_label: row.preset_label,
    section_ids: jsonArray(row.section_ids_json),
    canonical_path: row.canonical_path,
    status: row.status,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toSchedule(row: ScheduleRow) {
  return {
    id: row.id,
    config_id: row.config_id,
    cadence: row.cadence,
    timezone: row.timezone,
    day_of_week: row.day_of_week,
    day_of_month: row.day_of_month,
    send_time: row.send_time,
    recipients: jsonArray(row.recipients_json),
    status: row.status,
    next_run_at: row.next_run_at,
    last_run_at: row.last_run_at,
    last_run_status: row.last_run_status,
    failure_count: row.failure_count,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toRun(row: RunRow) {
  return {
    id: row.id,
    schedule_id: row.schedule_id,
    config_id: row.config_id,
    run_type: row.run_type,
    run_status: row.run_status,
    scheduled_for: row.scheduled_for,
    started_at: row.started_at,
    finished_at: row.finished_at,
    canonical_path: row.canonical_path,
    recipients: jsonArray(row.recipients_json),
    delivery_status: row.delivery_status,
    delivery_error: row.delivery_error,
    snapshot: parseJsonObject(row.snapshot_json),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toGenerationJob(row: GenerationJobRow) {
  return {
    id: row.id,
    config_id: row.config_id,
    run_id: row.run_id,
    requested_action: row.requested_action,
    status: row.status,
    scope: row.scope,
    community_id: row.community_id,
    community_name: row.community_name,
    date_range: row.date_range,
    preset_id: row.preset_id,
    preset_label: row.preset_label,
    section_ids: jsonArray(row.section_ids_json),
    recipients: jsonArray(row.recipients_json),
    artifact_key: row.artifact_key,
    artifact_filename: row.artifact_filename,
    error_text: row.error_text,
    created_by: row.created_by,
    claimed_by: row.claimed_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
  };
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function canonicalPath(scope: Scope, communityId?: string | null) {
  return scope === "portfolio" ? "/pib" : `/pib/property?id=${encodeURIComponent(communityId ?? "")}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCadence(cadence: Cadence) {
  if (cadence === "one_time") return "Immediate";
  return cadence.charAt(0).toUpperCase() + cadence.slice(1);
}

function reportAudience(schedule: JoinedDueScheduleRow) {
  return schedule.scope === "portfolio" ? "Portfolio PIB" : `${schedule.community_name ?? "Property"} PIB`;
}

function reportFromName(schedule: JoinedDueScheduleRow) {
  const reportTarget = schedule.scope === "portfolio" ? "Portfolio" : schedule.community_name ?? "Property";
  return `PIB Report - ${reportTarget}`.replace(/[<>\r\n]/g, "").trim();
}

function emailAddressOnly(value: string) {
  const bracketed = value.match(/<([^>]+)>/);
  return (bracketed?.[1] ?? value).replace(/[<>\r\n"]/g, "").trim();
}

function formatSender(from: string, displayName: string) {
  const email = emailAddressOnly(from);
  if (!email) return from;
  return `${displayName} <${email}>`;
}

function artifactSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function artifactTargetName(target: PibArtifactTarget) {
  return target.scope === "property" ? target.community_name?.trim() : null;
}

function artifactPrefix(target: PibArtifactTarget) {
  const name = artifactTargetName(target);
  if (!name) return null;
  return `pib/reports/${artifactSlug(name)}/`;
}

async function findLatestPibArtifact(env: Env, target: PibArtifactTarget): Promise<PibArtifact | null> {
  const prefix = artifactPrefix(target);
  if (!prefix) return null;

  let cursor: string | undefined;
  let latest: R2Object | null = null;
  do {
    const listed = await env.POP_BRIEF_UPLOADS.list({ prefix, cursor, limit: 1000 });
    for (const object of listed.objects) {
      if (!object.key.endsWith(".html")) continue;
      if (object.key.includes("__payload")) continue;
      if (!latest || object.key.localeCompare(latest.key) > 0) latest = object;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  if (latest) {
    const object = await env.POP_BRIEF_UPLOADS.get(latest.key);
    if (object) {
      const html = await object.text();
      return {
        key: latest.key,
        filename: latest.key.split("/").pop() ?? "Property-Intelligence-Brief.html",
        size: latest.size,
        uploaded: latest.uploaded ? latest.uploaded.toISOString() : null,
        html,
      };
    }
  }

  const fallback = await queryFirst<GenerationJobRow>(
    env.POP_BRIEF_DB,
    `SELECT * FROM pib_report_generation_jobs
     WHERE status = 'succeeded'
       AND scope = ?
       AND community_name = ?
     ORDER BY finished_at DESC, updated_at DESC
     LIMIT 1`,
    [target.scope, artifactTargetName(target)]
  );
  if (!fallback) return null;
  const chunks = await queryAll<GenerationArtifactChunkRow>(
    env.POP_BRIEF_DB,
    `SELECT chunk_text
     FROM pib_report_generation_artifact_chunks
     WHERE job_id = ?
     ORDER BY chunk_index ASC`,
    [fallback.id]
  );
  const html = fallback.artifact_html ?? chunks.map((chunk) => chunk.chunk_text).join("");
  if (!html) return null;
  return {
    key: fallback.artifact_key ?? `pib-builder-generation-job:${fallback.id}`,
    filename: fallback.artifact_filename ?? "Property-Intelligence-Brief.html",
    size: html.length,
    uploaded: fallback.finished_at ?? fallback.updated_at,
    html,
  };
}

function artifactMissingMessage(target: PibArtifactTarget) {
  if (target.scope === "portfolio") {
    return "The PIB Builder is attached to property-level canonical PIB artifacts. Portfolio PIB artifact generation is not connected yet.";
  }
  return `No canonical PIB HTML artifact is published for ${artifactTargetName(target) ?? "this property"}. Generate and publish the PIB artifact before emailing or opening it from the Builder.`;
}

function buildPibEmailHtml(schedule: JoinedDueScheduleRow, reportUrl: string, runType: "manual" | "scheduled") {
  const sectionCount = jsonArray(schedule.section_ids_json).length;
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F6F6F5;font-family:Arial,Helvetica,sans-serif;color:#15284B;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F6F5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:100%;background:#FFFFFF;border:1px solid #D6D6D2;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background:#15284B;color:#FFFFFF;">
                <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7DCAC2;font-weight:700;">Data Pond PIB</div>
                <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;font-weight:700;">${escapeHtml(schedule.report_name)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 20px;font-size:16px;line-height:1.55;color:#294782;">Your ${escapeHtml(reportAudience(schedule))} is ready in Data Pond. Open the canonical PIB to view the current report.</p>
                <p style="margin:0 0 24px;">
                  <a href="${escapeHtml(reportUrl)}" style="display:inline-block;background:#3B9189;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:700;padding:13px 20px;border-radius:6px;">Open PIB Report</a>
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid #D6D6D2;">
                  <tr>
                    <td style="padding:14px 0;border-bottom:1px solid #D6D6D2;color:#3D66B9;font-size:12px;font-weight:700;text-transform:uppercase;">Audience</td>
                    <td style="padding:14px 0;border-bottom:1px solid #D6D6D2;text-align:right;font-size:14px;">${escapeHtml(reportAudience(schedule))}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0;border-bottom:1px solid #D6D6D2;color:#3D66B9;font-size:12px;font-weight:700;text-transform:uppercase;">Date Range</td>
                    <td style="padding:14px 0;border-bottom:1px solid #D6D6D2;text-align:right;font-size:14px;">${escapeHtml(schedule.date_range)}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0;border-bottom:1px solid #D6D6D2;color:#3D66B9;font-size:12px;font-weight:700;text-transform:uppercase;">Preset</td>
                    <td style="padding:14px 0;border-bottom:1px solid #D6D6D2;text-align:right;font-size:14px;">${escapeHtml(schedule.preset_label)}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0;border-bottom:1px solid #D6D6D2;color:#3D66B9;font-size:12px;font-weight:700;text-transform:uppercase;">Included Areas</td>
                    <td style="padding:14px 0;border-bottom:1px solid #D6D6D2;text-align:right;font-size:14px;">${sectionCount}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0;color:#3D66B9;font-size:12px;font-weight:700;text-transform:uppercase;">Delivery</td>
                    <td style="padding:14px 0;text-align:right;font-size:14px;">${escapeHtml(runType === "manual" ? "Email now" : formatCadence(schedule.cadence))}</td>
                  </tr>
                </table>
                <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#9B9B96;">This email links to the governed PIB experience in Data Pond. Report content continues to render through the canonical PIB route.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildPibEmailText(schedule: JoinedDueScheduleRow, reportUrl: string, runType: "manual" | "scheduled") {
  const sectionCount = jsonArray(schedule.section_ids_json).length;
  return [
    `${schedule.report_name}`,
    "",
    `Open PIB Report: ${reportUrl}`,
    "",
    `Audience: ${reportAudience(schedule)}`,
    `Date Range: ${schedule.date_range}`,
    `Preset: ${schedule.preset_label}`,
    `Included Areas: ${sectionCount}`,
    `Delivery: ${runType === "manual" ? "Email now" : formatCadence(schedule.cadence)}`,
  ].join("\n");
}

async function deliverPibEmail(env: Env, schedule: JoinedDueScheduleRow, runType: "manual" | "scheduled") {
  if ((env.ENABLE_EMAIL_SEND ?? "").toLowerCase() !== "true") {
    return {
      runStatus: "blocked" as const,
      deliveryStatus: "email_disabled",
      deliveryError: "Email sending is disabled for this API environment.",
    };
  }
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return {
      runStatus: "blocked" as const,
      deliveryStatus: "email_credentials_missing",
      deliveryError: "Email credentials are not bound in the API environment.",
    };
  }

  const artifact = await findLatestPibArtifact(env, schedule);
  if (!artifact) {
    return {
      runStatus: "blocked" as const,
      deliveryStatus: "canonical_pib_artifact_missing",
      deliveryError: artifactMissingMessage(schedule),
    };
  }

  const recipients = jsonArray(schedule.recipients_json);
  const from = formatSender(env.EMAIL_FROM, reportFromName(schedule));
  const failures: string[] = [];
  for (const recipient of recipients) {
    const result = await sendEmail(env.RESEND_API_KEY, from, {
      to: recipient,
      subject: `PIB Report: ${schedule.report_name}`,
      html: artifact.html,
      text: [
        `${schedule.report_name}`,
        "",
        `Canonical PIB artifact: ${artifact.filename}`,
        `Audience: ${reportAudience(schedule)}`,
        `Delivery: ${runType === "manual" ? "Email now" : formatCadence(schedule.cadence)}`,
      ].join("\n"),
    });
    if (!result.ok) failures.push(`${recipient}: ${result.error ?? "unknown email provider error"}`);
  }

  if (failures.length > 0) {
    return {
      runStatus: "failed" as const,
      deliveryStatus: "resend_error",
      deliveryError: failures.slice(0, 5).join("; "),
    };
  }

  return {
    runStatus: "sent" as const,
    deliveryStatus: `sent:${artifact.key}`,
    deliveryError: null,
  };
}

function textValidationError(payload: Record<string, unknown>) {
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value !== "string") continue;
    const error = validateSafeText(value, key);
    if (error) return error;
  }
  return null;
}

async function ensurePibBuilderTables(db: D1Database) {
  await run(db, `CREATE TABLE IF NOT EXISTS pib_report_configs (
    id TEXT PRIMARY KEY,
    report_name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('portfolio', 'property')),
    community_id TEXT,
    community_name TEXT,
    date_range TEXT NOT NULL,
    preset_id TEXT NOT NULL,
    preset_label TEXT NOT NULL,
    section_ids_json TEXT NOT NULL,
    canonical_path TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'archived')) DEFAULT 'active',
    created_by TEXT,
    updated_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_pib_report_configs_status ON pib_report_configs(status, updated_at DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_pib_report_configs_scope ON pib_report_configs(scope, community_id, updated_at DESC)`);

  await run(db, `CREATE TABLE IF NOT EXISTS pib_report_schedules (
    id TEXT PRIMARY KEY,
    config_id TEXT NOT NULL REFERENCES pib_report_configs(id) ON DELETE CASCADE,
    cadence TEXT NOT NULL CHECK (cadence IN ('one_time', 'weekly', 'monthly', 'quarterly')),
    timezone TEXT NOT NULL DEFAULT 'America/Chicago',
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    day_of_month TEXT,
    send_time TEXT NOT NULL,
    recipients_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'archived')) DEFAULT 'draft',
    next_run_at TEXT,
    last_run_at TEXT,
    last_run_status TEXT,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    updated_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_pib_report_schedules_due ON pib_report_schedules(status, next_run_at)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_pib_report_schedules_config ON pib_report_schedules(config_id, updated_at DESC)`);

  await run(db, `CREATE TABLE IF NOT EXISTS pib_report_runs (
    id TEXT PRIMARY KEY,
    schedule_id TEXT REFERENCES pib_report_schedules(id) ON DELETE SET NULL,
    config_id TEXT NOT NULL REFERENCES pib_report_configs(id) ON DELETE CASCADE,
    run_type TEXT NOT NULL CHECK (run_type IN ('manual', 'scheduled')),
    run_status TEXT NOT NULL CHECK (run_status IN ('queued', 'blocked', 'sent', 'failed', 'skipped')),
    scheduled_for TEXT,
    started_at TEXT,
    finished_at TEXT,
    canonical_path TEXT NOT NULL,
    recipients_json TEXT NOT NULL,
    delivery_status TEXT NOT NULL,
    delivery_error TEXT,
    snapshot_json TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(schedule_id, scheduled_for)
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_pib_report_runs_schedule ON pib_report_runs(schedule_id, scheduled_for DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_pib_report_runs_config ON pib_report_runs(config_id, created_at DESC)`);

  await run(db, `CREATE TABLE IF NOT EXISTS pib_report_generation_jobs (
    id TEXT PRIMARY KEY,
    config_id TEXT NOT NULL REFERENCES pib_report_configs(id) ON DELETE CASCADE,
    run_id TEXT REFERENCES pib_report_runs(id) ON DELETE SET NULL,
    requested_action TEXT NOT NULL CHECK (requested_action IN ('open', 'email_now', 'save', 'scheduled_email')),
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')) DEFAULT 'queued',
    scope TEXT NOT NULL CHECK (scope IN ('portfolio', 'property')),
    community_id TEXT,
    community_name TEXT,
    date_range TEXT NOT NULL,
    preset_id TEXT NOT NULL,
    preset_label TEXT NOT NULL,
    section_ids_json TEXT NOT NULL,
    recipients_json TEXT NOT NULL,
    artifact_key TEXT,
    artifact_filename TEXT,
    artifact_html TEXT,
    error_text TEXT,
    created_by TEXT,
    claimed_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT
  )`);
  try {
    await run(db, `ALTER TABLE pib_report_generation_jobs ADD COLUMN artifact_html TEXT`);
  } catch {
    // Existing databases may already have the column; D1 has no ADD COLUMN IF NOT EXISTS.
  }
  await run(db, `CREATE INDEX IF NOT EXISTS idx_pib_report_generation_jobs_status ON pib_report_generation_jobs(status, created_at ASC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_pib_report_generation_jobs_config ON pib_report_generation_jobs(config_id, updated_at DESC)`);

  await run(db, `CREATE TABLE IF NOT EXISTS pib_report_generation_artifact_chunks (
    job_id TEXT NOT NULL REFERENCES pib_report_generation_jobs(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (job_id, chunk_index)
  )`);
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(lookup.year);
  const month = Number(lookup.month);
  const day = Number(lookup.day);
  const hour = Number(lookup.hour === "24" ? "0" : lookup.hour);
  const minute = Number(lookup.minute);
  const second = Number(lookup.second);
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = localParts(new Date(utc), timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    utc -= asUtc - utc;
  }
  return new Date(utc);
}

function addLocalDays(parts: ReturnType<typeof localParts>, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function lastBusinessDay(year: number, month: number) {
  for (let day = daysInMonth(year, month); day >= 1; day -= 1) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) return day;
  }
  return daysInMonth(year, month);
}

function parseSendTime(sendTime: string) {
  const [hour, minute] = sendTime.split(":").map(Number);
  return { hour: Number.isFinite(hour) ? hour : 8, minute: Number.isFinite(minute) ? minute : 0 };
}

function nextMonthlyLocalDate(now: Date, timeZone: string, sendTime: string, dayOfMonth: string | null, monthStep: number) {
  const nowLocal = localParts(now, timeZone);
  const { hour, minute } = parseSendTime(sendTime);
  let year = nowLocal.year;
  let month = nowLocal.month;
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const day = dayOfMonth === "last_business_day"
      ? lastBusinessDay(year, month)
      : Math.min(Math.max(Number(dayOfMonth ?? "1") || 1, 1), daysInMonth(year, month));
    const candidate = zonedTimeToUtc(year, month, day, hour, minute, timeZone);
    if (candidate.getTime() > now.getTime()) return candidate;
    month += monthStep;
    while (month > 12) {
      month -= 12;
      year += 1;
    }
  }
  return null;
}

function computeNextRunAt(input: {
  cadence: Cadence;
  timezone: string;
  day_of_week?: number | null;
  day_of_month?: string | null;
  send_time: string;
}, fromDate = new Date()): string | null {
  if (input.cadence === "one_time") return null;
  const timeZone = input.timezone || "America/Chicago";
  const { hour, minute } = parseSendTime(input.send_time);
  const nowLocal = localParts(fromDate, timeZone);
  if (input.cadence === "weekly") {
    const targetWeekday = input.day_of_week ?? 1;
    let delta = (targetWeekday - nowLocal.weekday + 7) % 7;
    if (delta === 0) {
      const todayCandidate = zonedTimeToUtc(nowLocal.year, nowLocal.month, nowLocal.day, hour, minute, timeZone);
      if (todayCandidate.getTime() <= fromDate.getTime()) delta = 7;
      else return todayCandidate.toISOString();
    }
    const localDate = addLocalDays(nowLocal, delta);
    return zonedTimeToUtc(localDate.year, localDate.month, localDate.day, hour, minute, timeZone).toISOString();
  }
  if (input.cadence === "monthly") {
    return nextMonthlyLocalDate(fromDate, timeZone, input.send_time, input.day_of_month ?? "1", 1)?.toISOString() ?? null;
  }
  return nextMonthlyLocalDate(fromDate, timeZone, input.send_time, input.day_of_month ?? "1", 3)?.toISOString() ?? null;
}

pibBuilder.get("/", async (c) => {
  try {
    await ensurePibBuilderTables(c.env.POP_BRIEF_DB);
    const [configs, schedules, runs, jobs] = await Promise.all([
      queryAll<ConfigRow>(c.env.POP_BRIEF_DB, `SELECT * FROM pib_report_configs WHERE status != 'archived' ORDER BY updated_at DESC LIMIT 100`),
      queryAll<ScheduleRow>(c.env.POP_BRIEF_DB, `SELECT * FROM pib_report_schedules WHERE status != 'archived' ORDER BY updated_at DESC LIMIT 100`),
      queryAll<RunRow>(c.env.POP_BRIEF_DB, `SELECT * FROM pib_report_runs ORDER BY created_at DESC LIMIT 100`),
      queryAll<GenerationJobRow>(c.env.POP_BRIEF_DB, `SELECT * FROM pib_report_generation_jobs ORDER BY created_at DESC LIMIT 100`),
    ]);
    return c.json({
      configs: configs.map(toConfig),
      schedules: schedules.map(toSchedule),
      runs: runs.map(toRun),
      generation_jobs: jobs.map(toGenerationJob),
    });
  } catch (error) {
    return c.json(errJson("PIB_BUILDER_STATE_ERROR", error instanceof Error ? error.message : "Unable to load PIB Builder state"), 500);
  }
});

pibBuilder.get("/artifacts/latest", async (c) => {
  try {
    const scope = c.req.query("scope") === "portfolio" ? "portfolio" : "property";
    const communityName = c.req.query("community_name") ?? null;
    const artifact = await findLatestPibArtifact(c.env, { scope, community_name: communityName });
    if (!artifact) {
      return c.json(errJson("PIB_ARTIFACT_NOT_FOUND", artifactMissingMessage({ scope, community_name: communityName })), 404);
    }
    return new Response(artifact.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${artifact.filename.replaceAll('"', "")}"`,
        "Cache-Control": "private, max-age=60",
        "X-PIB-Artifact-Key": artifact.key,
      },
    });
  } catch (error) {
    return c.json(errJson("PIB_ARTIFACT_LOAD_ERROR", error instanceof Error ? error.message : "Unable to load PIB artifact"), 500);
  }
});

pibBuilder.post("/configs/:id/generation-jobs", requireRole("admin", "editor"), async (c) => {
  try {
    await ensurePibBuilderTables(c.env.POP_BRIEF_DB);
    const configId = c.req.param("id");
    const config = await queryFirst<ConfigRow>(
      c.env.POP_BRIEF_DB,
      `SELECT * FROM pib_report_configs WHERE id = ? AND status != 'archived'`,
      [configId]
    );
    if (!config) return c.json(errJson("NOT_FOUND", "PIB config not found"), 404);
    if (config.scope !== "property" || !config.community_name) {
      return c.json(errJson("PIB_GENERATION_UNSUPPORTED", "Canonical PIB generation is currently available for property PIB reports only."), 400);
    }
    const parse = GenerationJobPayload.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid generation job payload"), 400);
    const existingArtifact = await findLatestPibArtifact(c.env, config);
    const actor = c.get("user");
    const id = newId();
    const now = nowISO();
    await run(c.env.POP_BRIEF_DB, `INSERT INTO pib_report_generation_jobs (
      id, config_id, run_id, requested_action, status, scope, community_id, community_name, date_range,
      preset_id, preset_label, section_ids_json, recipients_json, artifact_key, artifact_filename,
      created_by, created_at, updated_at, finished_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id,
      config.id,
      parse.data.run_id ?? null,
      parse.data.requested_action,
      existingArtifact ? "succeeded" : "queued",
      config.scope,
      config.community_id,
      config.community_name,
      config.date_range,
      config.preset_id,
      config.preset_label,
      config.section_ids_json,
      JSON.stringify(parse.data.recipients),
      existingArtifact?.key ?? null,
      existingArtifact?.filename ?? null,
      actor.id,
      now,
      now,
      existingArtifact ? now : null,
    ]);
    const row = await queryFirst<GenerationJobRow>(c.env.POP_BRIEF_DB, `SELECT * FROM pib_report_generation_jobs WHERE id = ?`, [id]);
    await writeAuditLog(c.env.POP_BRIEF_DB, {
      actorUserId: actor.id,
      action: "pib_builder.generation_job.create",
      entityType: "pib_report_generation_job",
      entityId: id,
      after: row,
    });
    return c.json({ generation_job: row ? toGenerationJob(row) : null }, 201);
  } catch (error) {
    return c.json(errJson("PIB_GENERATION_JOB_CREATE_ERROR", error instanceof Error ? error.message : "Unable to queue canonical PIB generation"), 500);
  }
});

pibBuilder.get("/generation-jobs/:id", async (c) => {
  try {
    await ensurePibBuilderTables(c.env.POP_BRIEF_DB);
    const id = c.req.param("id");
    const row = await queryFirst<GenerationJobRow>(c.env.POP_BRIEF_DB, `SELECT * FROM pib_report_generation_jobs WHERE id = ?`, [id]);
    if (!row) return c.json(errJson("NOT_FOUND", "PIB generation job not found"), 404);
    return c.json({ generation_job: toGenerationJob(row) });
  } catch (error) {
    return c.json(errJson("PIB_GENERATION_JOB_LOAD_ERROR", error instanceof Error ? error.message : "Unable to load canonical PIB generation job"), 500);
  }
});

pibBuilder.post("/configs", requireRole("admin", "editor"), async (c) => {
  try {
    await ensurePibBuilderTables(c.env.POP_BRIEF_DB);
    const parse = ConfigPayload.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid config payload"), 400);
    const unsafe = textValidationError(parse.data);
    if (unsafe) return c.json(errJson("VALIDATION_ERROR", unsafe), 400);
    if (parse.data.scope === "property" && !parse.data.community_id) {
      return c.json(errJson("VALIDATION_ERROR", "community_id is required for property PIB configs"), 400);
    }
    const actor = c.get("user");
    const id = newId();
    const now = nowISO();
    const path = canonicalPath(parse.data.scope, parse.data.community_id);
    await run(c.env.POP_BRIEF_DB, `INSERT INTO pib_report_configs (
      id, report_name, scope, community_id, community_name, date_range, preset_id, preset_label,
      section_ids_json, canonical_path, status, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`, [
      id,
      parse.data.report_name.trim(),
      parse.data.scope,
      parse.data.community_id ?? null,
      parse.data.community_name ?? null,
      parse.data.date_range,
      parse.data.preset_id,
      parse.data.preset_label,
      JSON.stringify(parse.data.section_ids),
      path,
      actor.id,
      actor.id,
      now,
      now,
    ]);
    const row = await queryFirst<ConfigRow>(c.env.POP_BRIEF_DB, `SELECT * FROM pib_report_configs WHERE id = ?`, [id]);
    await writeAuditLog(c.env.POP_BRIEF_DB, {
      actorUserId: actor.id,
      action: "pib_builder.config.create",
      entityType: "pib_report_config",
      entityId: id,
      after: row,
    });
    return c.json({ config: row ? toConfig(row) : null }, 201);
  } catch (error) {
    return c.json(errJson("PIB_CONFIG_CREATE_ERROR", error instanceof Error ? error.message : "Unable to save PIB config"), 500);
  }
});

pibBuilder.patch("/configs/:id", requireRole("admin", "editor"), async (c) => {
  try {
    await ensurePibBuilderTables(c.env.POP_BRIEF_DB);
    const id = c.req.param("id");
    const existing = await queryFirst<ConfigRow>(c.env.POP_BRIEF_DB, `SELECT * FROM pib_report_configs WHERE id = ?`, [id]);
    if (!existing) return c.json(errJson("NOT_FOUND", "PIB config not found"), 404);
    const parse = ConfigPatchPayload.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid config payload"), 400);
    const unsafe = textValidationError(parse.data);
    if (unsafe) return c.json(errJson("VALIDATION_ERROR", unsafe), 400);
    const nextScope = parse.data.scope ?? existing.scope;
    const nextCommunityId = parse.data.community_id ?? existing.community_id;
    if (nextScope === "property" && !nextCommunityId) {
      return c.json(errJson("VALIDATION_ERROR", "community_id is required for property PIB configs"), 400);
    }
    const actor = c.get("user");
    const now = nowISO();
    await run(c.env.POP_BRIEF_DB, `UPDATE pib_report_configs SET
      report_name = ?,
      scope = ?,
      community_id = ?,
      community_name = ?,
      date_range = ?,
      preset_id = ?,
      preset_label = ?,
      section_ids_json = ?,
      canonical_path = ?,
      status = ?,
      updated_by = ?,
      updated_at = ?
      WHERE id = ?`, [
      parse.data.report_name?.trim() ?? existing.report_name,
      nextScope,
      nextCommunityId ?? null,
      parse.data.community_name ?? existing.community_name,
      parse.data.date_range ?? existing.date_range,
      parse.data.preset_id ?? existing.preset_id,
      parse.data.preset_label ?? existing.preset_label,
      JSON.stringify(parse.data.section_ids ?? jsonArray(existing.section_ids_json)),
      canonicalPath(nextScope, nextCommunityId),
      parse.data.status ?? existing.status,
      actor.id,
      now,
      id,
    ]);
    const row = await queryFirst<ConfigRow>(c.env.POP_BRIEF_DB, `SELECT * FROM pib_report_configs WHERE id = ?`, [id]);
    await writeAuditLog(c.env.POP_BRIEF_DB, {
      actorUserId: actor.id,
      action: "pib_builder.config.update",
      entityType: "pib_report_config",
      entityId: id,
      before: existing,
      after: row,
    });
    return c.json({ config: row ? toConfig(row) : null });
  } catch (error) {
    return c.json(errJson("PIB_CONFIG_UPDATE_ERROR", error instanceof Error ? error.message : "Unable to update PIB config"), 500);
  }
});

pibBuilder.post("/schedules", requireRole("admin", "editor"), async (c) => {
  try {
    await ensurePibBuilderTables(c.env.POP_BRIEF_DB);
    const parse = SchedulePayload.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid schedule payload"), 400);
    const config = await queryFirst<ConfigRow>(c.env.POP_BRIEF_DB, `SELECT * FROM pib_report_configs WHERE id = ? AND status != 'archived'`, [parse.data.config_id]);
    if (!config) return c.json(errJson("NOT_FOUND", "PIB config not found"), 404);
    const actor = c.get("user");
    const id = newId();
    const now = nowISO();
    const scheduleInput = {
      cadence: parse.data.cadence,
      timezone: parse.data.timezone,
      day_of_week: parse.data.day_of_week ?? null,
      day_of_month: parse.data.day_of_month ?? null,
      send_time: parse.data.send_time,
    };
    const nextRunAt = parse.data.status === "active" ? computeNextRunAt(scheduleInput) : null;
    await run(c.env.POP_BRIEF_DB, `INSERT INTO pib_report_schedules (
      id, config_id, cadence, timezone, day_of_week, day_of_month, send_time, recipients_json,
      status, next_run_at, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id,
      parse.data.config_id,
      parse.data.cadence,
      parse.data.timezone,
      parse.data.day_of_week ?? null,
      parse.data.day_of_month ?? null,
      parse.data.send_time,
      JSON.stringify(parse.data.recipients),
      parse.data.status,
      nextRunAt,
      actor.id,
      actor.id,
      now,
      now,
    ]);
    const row = await queryFirst<ScheduleRow>(c.env.POP_BRIEF_DB, `SELECT * FROM pib_report_schedules WHERE id = ?`, [id]);
    await writeAuditLog(c.env.POP_BRIEF_DB, {
      actorUserId: actor.id,
      action: "pib_builder.schedule.create",
      entityType: "pib_report_schedule",
      entityId: id,
      after: row,
    });
    return c.json({ schedule: row ? toSchedule(row) : null }, 201);
  } catch (error) {
    return c.json(errJson("PIB_SCHEDULE_CREATE_ERROR", error instanceof Error ? error.message : "Unable to create PIB schedule"), 500);
  }
});

pibBuilder.patch("/schedules/:id", requireRole("admin", "editor"), async (c) => {
  try {
    await ensurePibBuilderTables(c.env.POP_BRIEF_DB);
    const id = c.req.param("id");
    const existing = await queryFirst<ScheduleRow>(c.env.POP_BRIEF_DB, `SELECT * FROM pib_report_schedules WHERE id = ?`, [id]);
    if (!existing) return c.json(errJson("NOT_FOUND", "PIB schedule not found"), 404);
    const parse = SchedulePatchPayload.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid schedule payload"), 400);
    const actor = c.get("user");
    const now = nowISO();
    const nextStatus = parse.data.status ?? existing.status;
    const next = {
      config_id: parse.data.config_id ?? existing.config_id,
      cadence: parse.data.cadence ?? existing.cadence,
      timezone: parse.data.timezone ?? existing.timezone,
      day_of_week: parse.data.day_of_week ?? existing.day_of_week,
      day_of_month: parse.data.day_of_month ?? existing.day_of_month,
      send_time: parse.data.send_time ?? existing.send_time,
      recipients: parse.data.recipients ?? jsonArray(existing.recipients_json),
      status: nextStatus === "archived" ? "paused" : nextStatus,
    };
    const nextRunAt = nextStatus === "active" ? computeNextRunAt(next) : null;
    await run(c.env.POP_BRIEF_DB, `UPDATE pib_report_schedules SET
      config_id = ?,
      cadence = ?,
      timezone = ?,
      day_of_week = ?,
      day_of_month = ?,
      send_time = ?,
      recipients_json = ?,
      status = ?,
      next_run_at = ?,
      updated_by = ?,
      updated_at = ?
      WHERE id = ?`, [
      next.config_id,
      next.cadence,
      next.timezone,
      next.day_of_week ?? null,
      next.day_of_month ?? null,
      next.send_time,
      JSON.stringify(next.recipients),
      nextStatus,
      nextRunAt,
      actor.id,
      now,
      id,
    ]);
    const row = await queryFirst<ScheduleRow>(c.env.POP_BRIEF_DB, `SELECT * FROM pib_report_schedules WHERE id = ?`, [id]);
    await writeAuditLog(c.env.POP_BRIEF_DB, {
      actorUserId: actor.id,
      action: "pib_builder.schedule.update",
      entityType: "pib_report_schedule",
      entityId: id,
      before: existing,
      after: row,
    });
    return c.json({ schedule: row ? toSchedule(row) : null });
  } catch (error) {
    return c.json(errJson("PIB_SCHEDULE_UPDATE_ERROR", error instanceof Error ? error.message : "Unable to update PIB schedule"), 500);
  }
});

pibBuilder.post("/schedules/:id/run", requireRole("admin", "editor"), async (c) => {
  try {
    await ensurePibBuilderTables(c.env.POP_BRIEF_DB);
    const scheduleId = c.req.param("id");
    const schedule = await queryFirst<JoinedDueScheduleRow>(
      c.env.POP_BRIEF_DB,
      `SELECT s.*, c.report_name, c.scope, c.community_id, c.community_name, c.date_range, c.preset_id, c.preset_label,
              c.section_ids_json, c.canonical_path
       FROM pib_report_schedules s
       JOIN pib_report_configs c ON c.id = s.config_id
       WHERE s.id = ? AND s.status != 'archived' AND c.status != 'archived'`,
      [scheduleId]
    );
    if (!schedule) return c.json(errJson("NOT_FOUND", "PIB schedule not found"), 404);
    const actor = c.get("user");
    const result = await recordPibScheduleRun(c.env, schedule, new Date(), "manual", actor.id);
    return c.json({ run: result });
  } catch (error) {
    return c.json(errJson("PIB_SCHEDULE_RUN_ERROR", error instanceof Error ? error.message : "Unable to create PIB schedule run"), 500);
  }
});

export async function runScheduledPibReports(env: Env, scheduledAt: Date) {
  const db = env.POP_BRIEF_DB;
  await ensurePibBuilderTables(db);
  const dueRows = await queryAll<JoinedDueScheduleRow>(
    db,
    `SELECT s.*, c.report_name, c.scope, c.community_id, c.community_name, c.date_range, c.preset_id, c.preset_label,
            c.section_ids_json, c.canonical_path
     FROM pib_report_schedules s
     JOIN pib_report_configs c ON c.id = s.config_id
     WHERE s.status = 'active'
       AND c.status = 'active'
       AND s.next_run_at IS NOT NULL
       AND s.next_run_at <= ?
     ORDER BY s.next_run_at ASC
     LIMIT 25`,
    [scheduledAt.toISOString()]
  );
  const runs = [];
  for (const row of dueRows) {
    runs.push(await recordPibScheduleRun(env, row, scheduledAt, "scheduled", "cloudflare-cron"));
  }
  return {
    scheduledAt: scheduledAt.toISOString(),
    selectedScheduleCount: dueRows.length,
    runs,
  };
}

async function recordPibScheduleRun(
  env: Env,
  schedule: JoinedDueScheduleRow,
  runAt: Date,
  runType: "manual" | "scheduled",
  actorId: string
) {
  const db = env.POP_BRIEF_DB;
  const now = nowISO();
  const runId = newId();
  const scheduledFor = runType === "scheduled" ? schedule.next_run_at : runAt.toISOString();
  const existingRun = await queryFirst<RunRow>(
    db,
    `SELECT * FROM pib_report_runs WHERE schedule_id = ? AND scheduled_for = ?`,
    [schedule.id, scheduledFor]
  );
  if (existingRun) {
    if (existingRun.delivery_status !== "canonical_pib_artifact_missing") return toRun(existingRun);
    const retryDelivery = await deliverPibEmail(env, schedule, runType);
    if (retryDelivery.deliveryStatus === "canonical_pib_artifact_missing") return toRun(existingRun);
    await run(db, `UPDATE pib_report_runs SET
      run_status = ?,
      finished_at = ?,
      delivery_status = ?,
      delivery_error = ?,
      updated_at = ?
      WHERE id = ?`, [
      retryDelivery.runStatus,
      now,
      retryDelivery.deliveryStatus,
      retryDelivery.deliveryError,
      now,
      existingRun.id,
    ]);
    await run(db, `UPDATE pib_report_schedules SET
      last_run_at = ?,
      last_run_status = ?,
      failure_count = ?,
      updated_by = ?,
      updated_at = ?
      WHERE id = ?`, [
      now,
      retryDelivery.runStatus,
      retryDelivery.runStatus === "sent" ? 0 : schedule.failure_count + 1,
      actorId,
      now,
      schedule.id,
    ]);
    const retriedRun = await queryFirst<RunRow>(db, `SELECT * FROM pib_report_runs WHERE id = ?`, [existingRun.id]);
    return retriedRun ? toRun(retriedRun) : toRun(existingRun);
  }

  const snapshot = {
    report_name: schedule.report_name,
    scope: schedule.scope,
    community_id: schedule.community_id,
    community_name: schedule.community_name,
    date_range: schedule.date_range,
    preset_id: schedule.preset_id,
    preset_label: schedule.preset_label,
    section_ids: jsonArray(schedule.section_ids_json),
    cadence: schedule.cadence,
    timezone: schedule.timezone,
    send_time: schedule.send_time,
  };
  const delivery = await deliverPibEmail(env, schedule, runType);
  await run(db, `INSERT OR IGNORE INTO pib_report_runs (
    id, schedule_id, config_id, run_type, run_status, scheduled_for, started_at, finished_at,
    canonical_path, recipients_json, delivery_status, delivery_error, snapshot_json, created_by, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    runId,
    schedule.id,
    schedule.config_id,
    runType,
    delivery.runStatus,
    scheduledFor,
    now,
    now,
    schedule.canonical_path,
    schedule.recipients_json,
    delivery.deliveryStatus,
    delivery.deliveryError,
    JSON.stringify(snapshot),
    actorId,
    now,
    now,
  ]);
  const nextRunAt = runType === "scheduled"
    ? computeNextRunAt(schedule, new Date(runAt.getTime() + 60_000))
    : schedule.next_run_at;
  await run(db, `UPDATE pib_report_schedules SET
    last_run_at = ?,
    last_run_status = ?,
    failure_count = ?,
    next_run_at = ?,
    updated_by = ?,
    updated_at = ?
    WHERE id = ?`, [
    now,
    delivery.runStatus,
    delivery.runStatus === "sent" ? 0 : schedule.failure_count + 1,
    nextRunAt,
    actorId,
    now,
    schedule.id,
  ]);
  const runRow = await queryFirst<RunRow>(db, `SELECT * FROM pib_report_runs WHERE schedule_id = ? AND scheduled_for = ?`, [schedule.id, scheduledFor]);
  return runRow ? toRun(runRow) : null;
}

export { pibBuilder };
