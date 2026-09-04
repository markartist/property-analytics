const SCHEMA_VERSION = "agent-readiness-monitor-v1";
const DEFAULT_SCANNER_URL = "https://isitagentready.com/api/scan";
const DEFAULT_MAX_TARGETS = 8;
const DEFAULT_CADENCE_DAYS = 7;
const DEFAULT_TIMEOUT_MS = 25000;
const CHECK_COLUMN_MAP = {
  robotsTxt: "robots_txt_status",
  sitemap: "sitemap_status",
  linkHeaders: "link_headers_status",
  dnsAid: "dns_aid_status",
  markdownNegotiation: "markdown_negotiation_status",
  aiBotRules: "ai_bot_rules_status",
  contentSignals: "content_signals_status",
  webBotAuth: "web_bot_auth_status",
  apiCatalog: "api_catalog_status",
  apiDiscovery: "api_catalog_status",
  oauthDiscovery: "oauth_discovery_status",
  oauthProtectedResource: "oauth_protected_resource_status",
  authMd: "auth_md_status",
  mcpServerCard: "mcp_server_card_status",
  a2aAgentCard: "a2a_agent_card_status",
  agentSkills: "agent_skills_status",
  webMcp: "web_mcp_status",
  ard: "ard_status"
};

function json(value, init = {}) {
  return new Response(JSON.stringify(value, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });
}

function cleanText(value, limit = 500) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, limit);
}

function cleanNullableText(value, limit = 500) {
  const cleaned = cleanText(value, limit);
  return cleaned || null;
}

function cleanToken(value, limit = 120) {
  return cleanText(value, limit).replace(/[^A-Za-z0-9_.:@/-]/g, "_");
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function compactDate(value) {
  return String(value || "").replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function randomSuffix() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function addDaysIso(value, days) {
  const base = Date.parse(value || "");
  const start = Number.isFinite(base) ? base : Date.now();
  return new Date(start + days * 24 * 60 * 60 * 1000).toISOString();
}

function safeJson(value, fallback) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function timingSafeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function queryAll(env, sql, params = []) {
  const result = await env.POP_BRIEF_DB.prepare(sql).bind(...params).all();
  return result.results || [];
}

async function queryFirst(env, sql, params = []) {
  return await env.POP_BRIEF_DB.prepare(sql).bind(...params).first();
}

async function exec(env, sql, params = []) {
  return await env.POP_BRIEF_DB.prepare(sql).bind(...params).run();
}

function normalizeUrl(value) {
  const raw = cleanText(value, 1000);
  if (!raw) return null;
  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function hostFor(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

async function targetIdFor(targetUrl, targetKind, propertyCode) {
  const input = `${targetKind}:${propertyCode || ""}:${targetUrl.toLowerCase()}`;
  return `agent_ready_${(await sha256Hex(input)).slice(0, 24)}`;
}

async function ensureCorporateTargets(env, asOfIso) {
  if (String(env.AGENT_READINESS_SEED_CORPORATE_PAGES || "true").toLowerCase() !== "true") {
    return { considered: 0, upserted: 0 };
  }

  const rows = await queryAll(
    env,
    `SELECT
       id AS community_id,
       name AS property_name,
       encasa_property_code AS property_code,
       full_url AS target_url
     FROM communities
     WHERE status = 'active'
       AND deleted_at IS NULL
       AND full_url IS NOT NULL
       AND TRIM(full_url) != ''
     ORDER BY COALESCE(encasa_property_code, id)`
  );

  let upserted = 0;
  for (const row of rows) {
    const targetUrl = normalizeUrl(row.target_url);
    if (!targetUrl) continue;
    const propertyCode = cleanNullableText(row.property_code, 80);
    const communityId = cleanNullableText(row.community_id, 80);
    const propertyId = propertyCode || communityId;
    const targetId = await targetIdFor(targetUrl, "corporate_property_page", propertyCode);
    const targetHost = hostFor(targetUrl);
    await exec(
      env,
      `INSERT INTO agent_readiness_targets (
         target_id, property_id, community_id, property_code, property_name,
         target_url, target_host, target_kind, source_system, status,
         cadence_days, next_scan_after, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'corporate_property_page', 'communities.full_url', 'active', ?, ?, ?, ?)
       ON CONFLICT(target_id) DO UPDATE SET
         property_id = excluded.property_id,
         community_id = excluded.community_id,
         property_code = excluded.property_code,
         property_name = excluded.property_name,
         target_url = excluded.target_url,
         target_host = excluded.target_host,
         source_system = excluded.source_system,
         cadence_days = excluded.cadence_days,
         updated_at = excluded.updated_at`,
      [
        targetId,
        propertyId,
        communityId,
        propertyCode,
        cleanNullableText(row.property_name, 200),
        targetUrl,
        targetHost,
        parsePositiveInt(env.AGENT_READINESS_TARGET_CADENCE_DAYS, DEFAULT_CADENCE_DAYS),
        asOfIso,
        asOfIso,
        asOfIso
      ]
    );
    upserted += 1;
  }

  return { considered: rows.length, upserted };
}

async function dueTargets(env, asOfIso, maxTargets) {
  return await queryAll(
    env,
    `SELECT *
     FROM agent_readiness_targets
     WHERE status = 'active'
       AND (next_scan_after IS NULL OR next_scan_after <= ?)
     ORDER BY
       CASE target_kind WHEN 'resi_vanity' THEN 0 WHEN 'corporate_property_page' THEN 1 ELSE 2 END,
       COALESCE(next_scan_after, '1970-01-01T00:00:00.000Z'),
       COALESCE(property_code, target_host),
       target_url
     LIMIT ?`,
    [asOfIso, maxTargets]
  );
}

function flattenedChecks(scan) {
  const checks = scan?.checks && typeof scan.checks === "object" ? scan.checks : {};
  const output = [];
  for (const [category, group] of Object.entries(checks)) {
    if (!group || typeof group !== "object") continue;
    for (const [key, check] of Object.entries(group)) {
      if (!check || typeof check !== "object") continue;
      output.push({
        category: cleanToken(category, 80) || "uncategorized",
        key: cleanToken(key, 80) || "unknown",
        status: cleanToken(check.status, 30).toLowerCase() || "unknown",
        message: cleanNullableText(check.message, 1000),
        durationMs: Number.isFinite(check.durationMs) ? Number(check.durationMs) : null,
        details: check.details || {},
        evidence: Array.isArray(check.evidence) ? check.evidence : []
      });
    }
  }
  return output;
}

function summarizedEvidence(evidence) {
  return evidence.slice(0, 12).map((item) => ({
    action: cleanNullableText(item?.action, 80),
    label: cleanNullableText(item?.label, 200),
    requestUrl: cleanNullableText(item?.request?.url, 1000),
    responseStatus: Number.isFinite(item?.response?.status) ? Number(item.response.status) : null,
    responseContentType: cleanNullableText(item?.response?.headers?.["content-type"], 160),
    outcome: cleanNullableText(item?.finding?.outcome, 80),
    summary: cleanNullableText(item?.finding?.summary, 500)
  }));
}

function checkCounts(checks) {
  const counts = { pass: 0, fail: 0, neutral: 0, total: checks.length };
  for (const check of checks) {
    if (check.status === "pass") counts.pass += 1;
    else if (check.status === "fail") counts.fail += 1;
    else counts.neutral += 1;
  }
  return counts;
}

function columnStatuses(checks) {
  const values = {};
  for (const check of checks) {
    const column = CHECK_COLUMN_MAP[check.key];
    if (column) values[column] = check.status;
  }
  return values;
}

function failedChecks(checks) {
  return checks
    .filter((check) => check.status === "fail")
    .map((check) => ({
      category: check.category,
      check: check.key,
      message: check.message
    }));
}

function readinessSummary(scan, counts) {
  const levelText = scan?.levelName ? `Level ${scan.level}: ${scan.levelName}` : "Scan completed";
  const next = scan?.nextLevel?.name ? ` Next target: ${scan.nextLevel.name}.` : "";
  return `${levelText}; ${counts.pass} pass, ${counts.fail} fail, ${counts.neutral} neutral.${next}`;
}

async function callScanner(env, targetUrl) {
  const scannerUrl = cleanText(env.AGENT_READINESS_SCANNER_URL || DEFAULT_SCANNER_URL, 1000);
  const timeoutMs = parsePositiveInt(env.AGENT_READINESS_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("scanner_timeout"), timeoutMs);
  try {
    const response = await fetch(scannerUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: targetUrl }),
      signal: controller.signal
    });
    const bodyText = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      throw new Error(`scanner_invalid_json:${response.status}`);
    }
    if (!response.ok) {
      throw new Error(`scanner_http_${response.status}:${cleanText(parsed?.error || bodyText, 180)}`);
    }
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

async function writeFailure(env, runId, target, asOfIso, errorText) {
  const resultId = `${runId}-${target.target_id}-failed`;
  const cadenceDays = parsePositiveInt(target.cadence_days, DEFAULT_CADENCE_DAYS);
  await exec(env, `UPDATE agent_readiness_results SET is_current = 0 WHERE target_id = ?`, [target.target_id]);
  await exec(
    env,
    `INSERT INTO agent_readiness_results (
       result_id, run_id, target_id, property_id, community_id, property_code, property_name,
       target_url, target_host, target_kind, scanned_at, scan_status, error_text,
       is_current, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'failed', ?, 1, ?, ?)`,
    [
      resultId,
      runId,
      target.target_id,
      target.property_id,
      target.community_id,
      target.property_code,
      target.property_name,
      target.target_url,
      target.target_host,
      target.target_kind,
      asOfIso,
      cleanText(errorText, 1000),
      asOfIso,
      asOfIso
    ]
  );
  await exec(
    env,
    `UPDATE agent_readiness_targets
     SET last_scanned_at = ?,
         next_scan_after = ?,
         last_scan_status = 'failed',
         last_result_id = ?,
         updated_at = ?
     WHERE target_id = ?`,
    [asOfIso, addDaysIso(asOfIso, Math.min(cadenceDays, 1)), resultId, asOfIso, target.target_id]
  );
  return { ok: false, resultId, error: cleanText(errorText, 1000) };
}

async function writeSuccess(env, runId, target, asOfIso, scan, rawR2Key) {
  const checks = flattenedChecks(scan);
  const counts = checkCounts(checks);
  const statuses = columnStatuses(checks);
  const resultId = `${runId}-${target.target_id}`;
  const cadenceDays = parsePositiveInt(target.cadence_days, DEFAULT_CADENCE_DAYS);
  const nextRequirements = Array.isArray(scan?.nextLevel?.requirements) ? scan.nextLevel.requirements : [];
  const summary = {
    scannedAt: cleanText(scan?.scannedAt || asOfIso, 80),
    sourceUrl: cleanNullableText(scan?.url, 1000),
    targetUrl: cleanNullableText(scan?.targetUrl, 1000),
    level: Number.isFinite(scan?.level) ? Number(scan.level) : null,
    levelName: cleanNullableText(scan?.levelName, 120),
    nextLevel: Number.isFinite(scan?.nextLevel?.target) ? Number(scan.nextLevel.target) : null,
    nextLevelName: cleanNullableText(scan?.nextLevel?.name, 120),
    isCommerce: Boolean(scan?.isCommerce),
    commerceSignals: scan?.commerceSignals || null,
    counts
  };

  await exec(env, `UPDATE agent_readiness_results SET is_current = 0 WHERE target_id = ?`, [target.target_id]);
  await exec(
    env,
    `INSERT INTO agent_readiness_results (
       result_id, run_id, target_id, property_id, community_id, property_code, property_name,
       target_url, target_host, target_kind, scanned_at, scan_status, level, level_name,
       next_level, next_level_name, pass_count, fail_count, neutral_count, total_check_count,
       readiness_summary, robots_txt_status, sitemap_status, link_headers_status, dns_aid_status,
       markdown_negotiation_status, ai_bot_rules_status, content_signals_status, web_bot_auth_status,
       api_catalog_status, oauth_discovery_status, oauth_protected_resource_status, auth_md_status,
       mcp_server_card_status, a2a_agent_card_status, agent_skills_status, web_mcp_status, ard_status,
       failed_checks_json, next_requirements_json, summary_json, raw_r2_key, is_current, created_at, updated_at
     ) VALUES (
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'success', ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, 1, ?, ?
     )`,
    [
      resultId,
      runId,
      target.target_id,
      target.property_id,
      target.community_id,
      target.property_code,
      target.property_name,
      target.target_url,
      target.target_host,
      target.target_kind,
      cleanText(scan?.scannedAt || asOfIso, 80),
      Number.isFinite(scan?.level) ? Number(scan.level) : null,
      cleanNullableText(scan?.levelName, 120),
      Number.isFinite(scan?.nextLevel?.target) ? Number(scan.nextLevel.target) : null,
      cleanNullableText(scan?.nextLevel?.name, 120),
      counts.pass,
      counts.fail,
      counts.neutral,
      counts.total,
      readinessSummary(scan, counts),
      statuses.robots_txt_status || null,
      statuses.sitemap_status || null,
      statuses.link_headers_status || null,
      statuses.dns_aid_status || null,
      statuses.markdown_negotiation_status || null,
      statuses.ai_bot_rules_status || null,
      statuses.content_signals_status || null,
      statuses.web_bot_auth_status || null,
      statuses.api_catalog_status || null,
      statuses.oauth_discovery_status || null,
      statuses.oauth_protected_resource_status || null,
      statuses.auth_md_status || null,
      statuses.mcp_server_card_status || null,
      statuses.a2a_agent_card_status || null,
      statuses.agent_skills_status || null,
      statuses.web_mcp_status || null,
      statuses.ard_status || null,
      safeJson(failedChecks(checks), []),
      safeJson(nextRequirements, []),
      safeJson(summary, {}),
      rawR2Key,
      asOfIso,
      asOfIso
    ]
  );

  for (const check of checks) {
    const checkResultId = `${resultId}-${check.category}-${check.key}`.slice(0, 240);
    await exec(
      env,
      `INSERT OR REPLACE INTO agent_readiness_check_results (
         check_result_id, result_id, run_id, target_id, check_category, check_key,
         status, message, duration_ms, details_json, evidence_summary_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        checkResultId,
        resultId,
        runId,
        target.target_id,
        check.category,
        check.key,
        check.status,
        check.message,
        check.durationMs,
        safeJson(check.details, {}),
        safeJson(summarizedEvidence(check.evidence), []),
        asOfIso
      ]
    );
  }

  await exec(
    env,
    `UPDATE agent_readiness_targets
     SET last_scanned_at = ?,
         next_scan_after = ?,
         last_scan_status = 'success',
         last_level = ?,
         last_level_name = ?,
         last_result_id = ?,
         updated_at = ?
     WHERE target_id = ?`,
    [
      asOfIso,
      addDaysIso(asOfIso, cadenceDays),
      Number.isFinite(scan?.level) ? Number(scan.level) : null,
      cleanNullableText(scan?.levelName, 120),
      resultId,
      asOfIso,
      target.target_id
    ]
  );

  return { ok: true, resultId, level: summary.level, levelName: summary.levelName, counts };
}

async function scanOne(env, runId, target, asOfIso) {
  try {
    const scan = await callScanner(env, target.target_url);
    const rawR2Key = `agent-readiness/raw/${target.target_id}/${runId}.json`;
    await env.POP_BRIEF_UPLOADS.put(rawR2Key, JSON.stringify(scan, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: {
        schema: SCHEMA_VERSION,
        target_id: target.target_id,
        target_host: target.target_host
      }
    });
    return await writeSuccess(env, runId, target, asOfIso, scan, rawR2Key);
  } catch (error) {
    return await writeFailure(env, runId, target, asOfIso, error?.message || String(error));
  }
}

async function runMonitor(env, runType = "scheduled") {
  const asOfIso = nowIso();
  if (String(env.AGENT_READINESS_ENABLED || "true").toLowerCase() !== "true") {
    return { ok: true, skipped: true, reason: "disabled", asOfIso };
  }

  const maxTargets = parsePositiveInt(env.AGENT_READINESS_MAX_TARGETS_PER_RUN, DEFAULT_MAX_TARGETS);
  const runId = `agent-readiness-${compactDate(asOfIso)}-${randomSuffix()}`;
  await exec(
    env,
    `INSERT INTO agent_readiness_runs (
       run_id, run_type, status, started_at, target_limit, schema_version, created_at, updated_at
     ) VALUES (?, ?, 'running', ?, ?, ?, ?, ?)`,
    [runId, runType, asOfIso, maxTargets, SCHEMA_VERSION, asOfIso, asOfIso]
  );

  const seeded = await ensureCorporateTargets(env, asOfIso);
  const targets = await dueTargets(env, asOfIso, maxTargets);
  if (!targets.length) {
    await exec(
      env,
      `UPDATE agent_readiness_runs
       SET status = 'skipped', finished_at = ?, skipped_count = 1, updated_at = ?
       WHERE run_id = ?`,
      [nowIso(), nowIso(), runId]
    );
    return { ok: true, runId, status: "skipped", seeded, targetCount: 0 };
  }

  const results = [];
  for (const target of targets) {
    results.push(await scanOne(env, runId, target, asOfIso));
  }

  const successCount = results.filter((item) => item.ok).length;
  const failedCount = results.length - successCount;
  const status = failedCount === 0 ? "success" : successCount > 0 ? "partial" : "failed";
  const finishedAt = nowIso();
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    runId,
    runType,
    startedAt: asOfIso,
    finishedAt,
    seeded,
    targetCount: targets.length,
    successCount,
    failedCount,
    results
  };
  const manifestKey = `agent-readiness/runs/${runId}.json`;
  await env.POP_BRIEF_UPLOADS.put(manifestKey, JSON.stringify(manifest, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: { schema: SCHEMA_VERSION, run_id: runId }
  });

  await exec(
    env,
    `UPDATE agent_readiness_runs
     SET status = ?,
         finished_at = ?,
         target_count = ?,
         success_count = ?,
         failed_count = ?,
         r2_manifest_key = ?,
         updated_at = ?
     WHERE run_id = ?`,
    [status, finishedAt, targets.length, successCount, failedCount, manifestKey, finishedAt, runId]
  );

  return { ok: failedCount === 0, runId, status, seeded, targetCount: targets.length, successCount, failedCount, manifestKey };
}

function authorizedManualRun(request, env) {
  const configured = cleanText(env.AGENT_READINESS_ADMIN_SECRET, 500);
  if (!configured) return { ok: false, status: 503, code: "admin_secret_unconfigured" };
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const header = request.headers.get("x-agent-readiness-secret");
  const supplied = cleanText(bearer || header, 500);
  if (!supplied || !timingSafeEqual(configured, supplied)) {
    return { ok: false, status: 401, code: "unauthorized" };
  }
  return { ok: true };
}

async function status(env) {
  const latestRun = await queryFirst(
    env,
    `SELECT *
     FROM agent_readiness_runs
     ORDER BY started_at DESC
     LIMIT 1`
  );
  const current = await queryFirst(
    env,
    `SELECT
       COUNT(*) AS current_result_count,
       SUM(CASE WHEN scan_status = 'success' THEN 1 ELSE 0 END) AS success_count,
       SUM(CASE WHEN scan_status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
       SUM(CASE WHEN level >= 3 THEN 1 ELSE 0 END) AS agent_readable_or_better_count,
       SUM(CASE WHEN markdown_negotiation_status = 'pass' THEN 1 ELSE 0 END) AS markdown_ready_count,
       SUM(CASE WHEN fail_count > 0 THEN 1 ELSE 0 END) AS with_failed_checks_count
     FROM agent_readiness_results
     WHERE is_current = 1`
  );
  const due = await queryFirst(
    env,
    `SELECT COUNT(*) AS due_target_count
     FROM agent_readiness_targets
     WHERE status = 'active'
       AND (next_scan_after IS NULL OR next_scan_after <= ?)`
    ,
    [nowIso()]
  );
  const targets = await queryFirst(
    env,
    `SELECT
       COUNT(*) AS target_count,
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_target_count
     FROM agent_readiness_targets`
  );
  return {
    ok: true,
    service: "agent-readiness-monitor",
    schemaVersion: SCHEMA_VERSION,
    latestRun,
    current,
    targets,
    due
  };
}

async function listTargets(env, requestUrl) {
  const url = new URL(requestUrl);
  const limit = Math.min(parsePositiveInt(url.searchParams.get("limit"), 100), 250);
  const rows = await queryAll(
    env,
    `SELECT *
     FROM agent_readiness_targets
     ORDER BY status, target_kind, COALESCE(property_code, target_host), target_url
     LIMIT ?`,
    [limit]
  );
  return { ok: true, count: rows.length, rows };
}

async function listResults(env, requestUrl) {
  const url = new URL(requestUrl);
  const limit = Math.min(parsePositiveInt(url.searchParams.get("limit"), 50), 250);
  const propertyCode = cleanNullableText(url.searchParams.get("property_code"), 80);
  const targetKind = cleanNullableText(url.searchParams.get("target_kind"), 80);
  const clauses = ["is_current = 1"];
  const params = [];
  if (propertyCode) {
    clauses.push("property_code = ?");
    params.push(propertyCode);
  }
  if (targetKind) {
    clauses.push("target_kind = ?");
    params.push(targetKind);
  }
  params.push(limit);
  const rows = await queryAll(
    env,
    `SELECT *
     FROM agent_readiness_results
     WHERE ${clauses.join(" AND ")}
     ORDER BY
       CASE scan_status WHEN 'failed' THEN 0 ELSE 1 END,
       level ASC,
       fail_count DESC,
       scanned_at DESC
     LIMIT ?`,
    params
  );
  return { ok: true, count: rows.length, rows };
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runMonitor(env, "scheduled"));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true, service: "agent-readiness-monitor", schemaVersion: SCHEMA_VERSION });
      }
      if (request.method === "GET" && url.pathname === "/v1/agent-readiness/status") {
        return json(await status(env));
      }
      if (request.method === "GET" && url.pathname === "/v1/agent-readiness/targets") {
        return json(await listTargets(env, request.url));
      }
      if (request.method === "GET" && url.pathname === "/v1/agent-readiness/results") {
        return json(await listResults(env, request.url));
      }
      if (request.method === "POST" && url.pathname === "/v1/agent-readiness/run") {
        const auth = authorizedManualRun(request, env);
        if (!auth.ok) return json({ ok: false, error: auth.code }, { status: auth.status });
        return json(await runMonitor(env, "manual"));
      }
      return json({ ok: false, error: "not_found" }, { status: 404 });
    } catch (error) {
      return json({ ok: false, error: cleanText(error?.message || String(error), 1000) }, { status: 500 });
    }
  }
};
