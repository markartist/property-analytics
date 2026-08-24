const SCHEMA_VERSION = "captain-refresh-v1";
const DEFAULT_FAMILY_DUE_DATE = "2026-09-07";
const DEFAULT_MAX_PROPERTIES = 150;

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

function safeJson(value, fallback = {}) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function isDue(dateText, asOfIso) {
  const due = Date.parse(dateText || "");
  const asOf = Date.parse(asOfIso);
  return Number.isFinite(due) && Number.isFinite(asOf) && due <= asOf;
}

function titleCaseToken(token) {
  const cleaned = cleanToken(token, 120).replace(/[-_]+/g, " ");
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function fallbackCaptainName(propertyId) {
  return `Captain ${titleCaseToken(propertyId) || "Property"}`;
}

function fallbackOfficeName(captainDisplayName) {
  const name = cleanText(captainDisplayName, 120) || "Captain";
  const base = name.replace(/^Captain\s+/i, "Captain ");
  return `${base}'s Office`;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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

async function activeCaptains(env, maxProperties) {
  const rows = await queryAll(
    env,
    `SELECT
       assigned_property_id AS property_id,
       display_name AS captain_display_name,
       agent_id AS source_agent_id
     FROM awareness_agent_identities
     WHERE agent_type = 'captain'
       AND active_status = 'active'
       AND assigned_property_id IS NOT NULL
     ORDER BY assigned_property_id
     LIMIT ?`,
    [maxProperties]
  );

  if (rows.length) {
    return rows.map((row) => ({
      propertyId: cleanToken(row.property_id, 120),
      captainDisplayName: cleanText(row.captain_display_name, 160),
      sourceAgentId: cleanText(row.source_agent_id, 160)
    })).filter((row) => row.propertyId);
  }

  const fallbackRows = await queryAll(
    env,
    `SELECT property_id, MAX(agent_name) AS captain_display_name, NULL AS source_agent_id
     FROM captain_support_agents
     WHERE status = 'active'
     GROUP BY property_id
     ORDER BY property_id
     LIMIT ?`,
    [maxProperties]
  );
  return fallbackRows.map((row) => ({
    propertyId: cleanToken(row.property_id, 120),
    captainDisplayName: cleanText(row.captain_display_name, 160) || fallbackCaptainName(row.property_id),
    sourceAgentId: null
  })).filter((row) => row.propertyId);
}

async function ensurePersona(env, captain, asOfIso) {
  const dueDate = cleanText(env.CAPTAIN_REFRESH_FAMILY_DUE_DATE || DEFAULT_FAMILY_DUE_DATE, 20);
  const existing = await queryFirst(
    env,
    `SELECT * FROM captain_persona_profiles WHERE property_id = ?`,
    [captain.propertyId]
  );

  if (existing) {
    return { profile: existing, created: false };
  }

  const captainDisplayName = captain.captainDisplayName || fallbackCaptainName(captain.propertyId);
  const officeName = fallbackOfficeName(captainDisplayName);
  const profileId = `captain_persona_${captain.propertyId.toLowerCase()}`;
  await exec(
    env,
    `INSERT INTO captain_persona_profiles (
       profile_id, property_id, captain_display_name, office_name, persona_status,
       family_composition_status, family_composition_due_at, profile_owned_by,
       source_agent_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'active', 'not_started', ?, 'captain', ?, ?, ?)`,
    [profileId, captain.propertyId, captainDisplayName, officeName, dueDate, captain.sourceAgentId, asOfIso, asOfIso]
  );

  return {
    created: true,
    profile: {
      profile_id: profileId,
      property_id: captain.propertyId,
      captain_display_name: captainDisplayName,
      office_name: officeName,
      persona_status: "active",
      family_composition_status: "not_started",
      family_composition_due_at: dueDate,
      profile_owned_by: "captain",
      source_agent_id: captain.sourceAgentId,
      created_at: asOfIso,
      updated_at: asOfIso
    }
  };
}

async function propertyCounts(env, propertyId) {
  const [watch, actions, opsSignals, awareness, runtime, evidence] = await Promise.all([
    queryFirst(
      env,
      `SELECT
         COUNT(*) AS open_watch_count,
         SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical_watch_count
       FROM captain_watch_items
       WHERE property_id = ?
         AND status IN ('open', 'monitoring', 'escalated')`,
      [propertyId]
    ),
    queryFirst(
      env,
      `SELECT
         COUNT(*) AS open_action_count,
         SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked_action_count
       FROM captain_actions
       WHERE property_id = ?
         AND status IN ('open', 'in_progress', 'blocked')`,
      [propertyId]
    ),
    queryFirst(
      env,
      `SELECT
         COUNT(*) AS ops_signal_count,
         SUM(CASE WHEN severity IN ('high', 'critical') THEN 1 ELSE 0 END) AS high_ops_signal_count
       FROM ops_watch_signals
       WHERE property_refs_json LIKE ?
         AND COALESCE(status, '') NOT IN ('done', 'resolved', 'closed', 'superseded')`,
      [`%"${propertyId}"%`]
    ),
    queryFirst(
      env,
      `SELECT
         (SELECT COUNT(*) FROM awareness_commitments WHERE property_id = ? AND status IN ('open', 'waiting', 'blocked')) AS open_commitment_count,
         (SELECT COUNT(*) FROM awareness_memory_items WHERE property_id = ? AND lifecycle_state NOT IN ('archived', 'expired', 'rejected') AND verification_required = 1) AS verification_needed_count`,
      [propertyId, propertyId]
    ),
    queryFirst(
      env,
      `SELECT started_at, runtime_mode, runtime_hash
       FROM captain_runtime_sessions
       WHERE property_id = ?
       ORDER BY started_at DESC
       LIMIT 1`,
      [propertyId]
    ),
    queryFirst(
      env,
      `SELECT generated_at, evidence_hash, included_sources_json, freshness_state_json
       FROM captain_evidence_packets
       WHERE property_id = ?
       ORDER BY generated_at DESC
       LIMIT 1`,
      [propertyId]
    )
  ]);

  return {
    watch: {
      open: Number(watch?.open_watch_count || 0),
      critical: Number(watch?.critical_watch_count || 0)
    },
    actions: {
      open: Number(actions?.open_action_count || 0),
      blocked: Number(actions?.blocked_action_count || 0)
    },
    opsSignals: {
      open: Number(opsSignals?.ops_signal_count || 0),
      high: Number(opsSignals?.high_ops_signal_count || 0)
    },
    awareness: {
      openCommitments: Number(awareness?.open_commitment_count || 0),
      verificationNeeded: Number(awareness?.verification_needed_count || 0)
    },
    runtime: {
      latestAt: runtime?.started_at || null,
      mode: runtime?.runtime_mode || null,
      hash: runtime?.runtime_hash || null
    },
    evidence: {
      latestAt: evidence?.generated_at || null,
      hash: evidence?.evidence_hash || null,
      includedSources: parseJson(evidence?.included_sources_json, []),
      freshnessState: parseJson(evidence?.freshness_state_json, {})
    }
  };
}

function wallStatus(profile, counts, asOfIso) {
  const pressure =
    counts.watch.critical > 0 || counts.actions.blocked > 0 || counts.opsSignals.high > 0
      ? "needs_attention"
      : counts.watch.open > 0 || counts.actions.open > 0 || counts.opsSignals.open > 0
        ? "monitor"
        : "steady";
  return {
    pressure,
    familyCompositionDue: profile.family_composition_status !== "approved" && isDue(profile.family_composition_due_at, asOfIso),
    hasRuntime: Boolean(counts.runtime.latestAt),
    hasEvidence: Boolean(counts.evidence.hash),
    generatedBy: "captain-refresh-worker",
    schemaVersion: SCHEMA_VERSION
  };
}

async function writeWallSnapshot(env, runId, captain, profile, counts, asOfIso) {
  const captainDisplayName = cleanText(profile.captain_display_name, 160) || captain.captainDisplayName || fallbackCaptainName(captain.propertyId);
  const officeName = cleanText(profile.office_name, 180) || fallbackOfficeName(captainDisplayName);
  const status = wallStatus(profile, counts, asOfIso);
  const summary = {
    propertyId: captain.propertyId,
    captainDisplayName,
    officeName,
    snapshotAt: asOfIso,
    desk: {
      propertyPhotoUrl: profile.property_photo_url || null,
      propertyPhotoAssetKey: profile.property_photo_asset_key || null,
      portraitAssetKey: profile.portrait_asset_key || null,
      familyPortraitAssetKey: profile.family_portrait_asset_key || null,
      familyCaption: profile.family_caption || null,
      familyCompositionStatus: profile.family_composition_status,
      familyCompositionType: profile.family_composition_type || null,
      familyCompositionDueAt: profile.family_composition_due_at
    },
    officeWall: {
      openWatchItems: counts.watch.open,
      criticalWatchItems: counts.watch.critical,
      openActions: counts.actions.open,
      blockedActions: counts.actions.blocked,
      opsSignals: counts.opsSignals.open,
      highOpsSignals: counts.opsSignals.high,
      openCommitments: counts.awareness.openCommitments,
      verificationNeeded: counts.awareness.verificationNeeded,
      latestRuntimeAt: counts.runtime.latestAt,
      latestRuntimeMode: counts.runtime.mode,
      latestEvidenceAt: counts.evidence.latestAt,
      latestEvidenceHash: counts.evidence.hash,
      includedSources: counts.evidence.includedSources,
      freshnessState: counts.evidence.freshnessState
    },
    status
  };
  const summaryText = JSON.stringify(summary);
  const snapshotHash = (await sha256Hex(summaryText)).slice(0, 16);
  const snapshotId = `captain_wall_${captain.propertyId.toLowerCase()}_${compactDate(asOfIso)}_${snapshotHash}`;
  const r2Key = `captains/office-wall/${captain.propertyId}/${runId}.json`;

  await env.POP_BRIEF_UPLOADS.put(r2Key, summaryText, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: {
      property_id: captain.propertyId,
      run_id: runId,
      snapshot_id: snapshotId,
      snapshot_at: asOfIso
    }
  });

  await exec(env, `UPDATE captain_office_wall_snapshots SET is_current = 0, updated_at = ? WHERE property_id = ? AND is_current = 1`, [asOfIso, captain.propertyId]);
  await exec(
    env,
    `INSERT INTO captain_office_wall_snapshots (
       snapshot_id, run_id, property_id, snapshot_at, is_current,
       captain_display_name, office_name, family_composition_status,
       family_composition_due_at, open_watch_count, critical_watch_count,
       open_action_count, blocked_action_count, ops_signal_count, high_ops_signal_count,
       open_commitment_count, verification_needed_count, latest_runtime_at,
       latest_runtime_mode, latest_evidence_at, latest_evidence_hash, r2_key,
       summary_json, status_json, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshotId,
      runId,
      captain.propertyId,
      asOfIso,
      captainDisplayName,
      officeName,
      profile.family_composition_status,
      profile.family_composition_due_at,
      counts.watch.open,
      counts.watch.critical,
      counts.actions.open,
      counts.actions.blocked,
      counts.opsSignals.open,
      counts.opsSignals.high,
      counts.awareness.openCommitments,
      counts.awareness.verificationNeeded,
      counts.runtime.latestAt,
      counts.runtime.mode,
      counts.evidence.latestAt,
      counts.evidence.hash,
      r2Key,
      summaryText,
      safeJson(status),
      asOfIso,
      asOfIso
    ]
  );

  return { snapshotId, r2Key, summary, status };
}

async function runRefresh(env, refreshType = "scheduled") {
  if (String(env.CAPTAIN_REFRESH_ENABLED || "true").toLowerCase() !== "true") {
    return { ok: false, skipped: true, error: "captain_refresh_disabled" };
  }

  const asOfIso = nowIso();
  const runId = `captain-refresh-${compactDate(asOfIso)}-${randomSuffix()}`;
  const maxProperties = parsePositiveInt(env.CAPTAIN_REFRESH_MAX_PROPERTIES, DEFAULT_MAX_PROPERTIES);
  await exec(
    env,
    `INSERT INTO captain_refresh_runs (
       run_id, refresh_type, status, started_at, created_at, updated_at
     ) VALUES (?, ?, 'running', ?, ?, ?)`,
    [runId, refreshType, asOfIso, asOfIso, asOfIso]
  );

  const manifest = {
    runId,
    refreshType,
    generatedAt: asOfIso,
    schemaVersion: env.CAPTAIN_REFRESH_SCHEMA_VERSION || SCHEMA_VERSION,
    snapshots: []
  };
  let personaCreatedCount = 0;
  let personaDueCount = 0;
  let status = "success";
  let errorText = null;

  try {
    const captains = await activeCaptains(env, maxProperties);
    for (const captain of captains) {
      const persona = await ensurePersona(env, captain, asOfIso);
      if (persona.created) personaCreatedCount += 1;
      if (persona.profile.family_composition_status !== "approved" && isDue(persona.profile.family_composition_due_at, asOfIso)) {
        personaDueCount += 1;
      }
      const counts = await propertyCounts(env, captain.propertyId);
      const snapshot = await writeWallSnapshot(env, runId, captain, persona.profile, counts, asOfIso);
      manifest.snapshots.push({
        propertyId: captain.propertyId,
        snapshotId: snapshot.snapshotId,
        r2Key: snapshot.r2Key,
        pressure: snapshot.status.pressure,
        familyCompositionDue: snapshot.status.familyCompositionDue
      });
    }

    const manifestText = JSON.stringify(manifest, null, 2);
    const manifestKey = `captains/refresh-runs/${runId}.json`;
    await env.POP_BRIEF_UPLOADS.put(manifestKey, manifestText, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: {
        run_id: runId,
        refresh_type: refreshType,
        generated_at: asOfIso
      }
    });

    const finishedAt = nowIso();
    await exec(
      env,
      `UPDATE captain_refresh_runs
       SET status = ?, finished_at = ?, property_count = ?, snapshot_count = ?,
           persona_created_count = ?, persona_due_count = ?, error_text = ?,
           r2_manifest_key = ?, updated_at = ?
       WHERE run_id = ?`,
      [
        status,
        finishedAt,
        captains.length,
        manifest.snapshots.length,
        personaCreatedCount,
        personaDueCount,
        errorText,
        manifestKey,
        finishedAt,
        runId
      ]
    );

    return {
      ok: true,
      runId,
      status,
      propertyCount: captains.length,
      snapshotCount: manifest.snapshots.length,
      personaCreatedCount,
      personaDueCount,
      r2ManifestKey: manifestKey
    };
  } catch (error) {
    status = "failed";
    errorText = error instanceof Error ? error.message : String(error);
    const finishedAt = nowIso();
    await exec(
      env,
      `UPDATE captain_refresh_runs
       SET status = 'failed', finished_at = ?, error_text = ?, updated_at = ?
       WHERE run_id = ?`,
      [finishedAt, cleanText(errorText, 1000), finishedAt, runId]
    );
    return { ok: false, runId, status, error: cleanText(errorText, 1000) };
  }
}

async function latestStatus(env) {
  const latestRun = await queryFirst(
    env,
    `SELECT * FROM captain_refresh_runs ORDER BY started_at DESC LIMIT 1`
  );
  const pressure = await queryFirst(
    env,
    `SELECT
       COUNT(*) AS current_snapshots,
       SUM(CASE WHEN family_composition_status != 'approved' AND family_composition_due_at <= date('now') THEN 1 ELSE 0 END) AS family_due_count,
       SUM(CASE WHEN critical_watch_count > 0 OR blocked_action_count > 0 OR high_ops_signal_count > 0 THEN 1 ELSE 0 END) AS needs_attention_count,
       SUM(open_watch_count) AS open_watch_count,
       SUM(open_action_count) AS open_action_count
     FROM captain_office_wall_snapshots
     WHERE is_current = 1`
  );
  return { latestRun, pressure };
}

async function wallForProperty(env, propertyId) {
  return await queryFirst(
    env,
    `SELECT *
     FROM captain_office_wall_snapshots
     WHERE property_id = ?
       AND is_current = 1
     ORDER BY snapshot_at DESC
     LIMIT 1`,
    [propertyId]
  );
}

function authorizedManualRun(request, env) {
  if (!env.CAPTAIN_REFRESH_ADMIN_SECRET) return { ok: false, status: 503, error: "manual_secret_unconfigured" };
  const header = request.headers.get("authorization") || "";
  const expected = `Bearer ${env.CAPTAIN_REFRESH_ADMIN_SECRET}`;
  return header === expected ? { ok: true } : { ok: false, status: 401, error: "unauthorized" };
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runRefresh(env, "scheduled"));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({ ok: true, service: "captain-refresh", schemaVersion: SCHEMA_VERSION });
    }

    if (url.pathname === "/v1/captains/refresh/status" && request.method === "GET") {
      return json({ ok: true, ...(await latestStatus(env)) });
    }

    if (url.pathname === "/v1/captains/refresh/run" && request.method === "POST") {
      const auth = authorizedManualRun(request, env);
      if (!auth.ok) return json({ ok: false, error: auth.error }, { status: auth.status });
      return json(await runRefresh(env, "manual"));
    }

    const wallMatch = url.pathname.match(/^\/v1\/captains\/([^/]+)\/wall$/);
    if (wallMatch && request.method === "GET") {
      const propertyId = cleanToken(decodeURIComponent(wallMatch[1]), 120);
      const snapshot = await wallForProperty(env, propertyId);
      return snapshot ? json({ ok: true, snapshot }) : json({ ok: false, error: "snapshot_not_found" }, { status: 404 });
    }

    return json({ ok: false, error: "not_found" }, { status: 404 });
  }
};
