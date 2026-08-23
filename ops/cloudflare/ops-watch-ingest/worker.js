const DEFAULT_MAX_BYTES = 1024 * 1024;
const DEFAULT_MAX_RECORDS = 500;
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;
const SCHEMA_VERSION = "ops-watch-ingest-v1";
const VALID_SEVERITIES = new Set(["info", "low", "medium", "high", "critical"]);

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

function safeJson(value, fallback) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function allowedSources(env) {
  return new Set(
    String(env.OPS_WATCH_INGEST_ALLOWED_SOURCES || "")
      .split(",")
      .map((item) => cleanToken(item, 80))
      .filter(Boolean)
  );
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
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

function parseTimestamp(value) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) return null;
  return timestamp;
}

async function verifySignature(request, env, rawBody) {
  if (!env.OPS_WATCH_INGEST_SHARED_SECRET) {
    return { ok: false, status: 503, code: "ingest_secret_unconfigured" };
  }

  const timestampHeader = request.headers.get("x-ops-watch-timestamp");
  const signatureHeader = request.headers.get("x-ops-watch-signature");
  const timestamp = parseTimestamp(timestampHeader);
  if (!timestamp || Math.abs(Date.now() - timestamp) > MAX_CLOCK_SKEW_MS) {
    return { ok: false, status: 401, code: "invalid_or_expired_timestamp" };
  }
  if (!signatureHeader) {
    return { ok: false, status: 401, code: "missing_signature" };
  }

  const expected = await hmacHex(env.OPS_WATCH_INGEST_SHARED_SECRET, `${timestampHeader}.${rawBody}`);
  if (!timingSafeEqual(expected, signatureHeader.toLowerCase())) {
    return { ok: false, status: 401, code: "invalid_signature" };
  }
  return { ok: true };
}

function validatePayload(payload, env) {
  const sourceSystem = cleanToken(payload?.source || payload?.source_system, 80);
  const runId = cleanToken(payload?.run_id, 160);
  const generatedAt = cleanText(payload?.generated_at, 80);
  const sourceSet = allowedSources(env);
  const maxRecords = parsePositiveInt(env.OPS_WATCH_INGEST_MAX_RECORDS, DEFAULT_MAX_RECORDS);
  const errors = [];

  if (!sourceSystem) errors.push("source is required");
  if (sourceSet.size && !sourceSet.has(sourceSystem)) errors.push("source is not allowed");
  if (!runId) errors.push("run_id is required");
  if (!generatedAt || !parseTimestamp(generatedAt)) errors.push("generated_at must be an ISO timestamp");
  if (!Array.isArray(payload?.records)) errors.push("records must be an array");
  if (Array.isArray(payload?.records) && payload.records.length > maxRecords) {
    errors.push(`records exceeds max ${maxRecords}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    sourceSystem,
    runId,
    generatedAt,
    records: Array.isArray(payload?.records) ? payload.records : []
  };
}

function normalizeRecord(record, sourceSystem) {
  const sourceId = cleanText(record?.source_id || record?.id, 160);
  const title = cleanText(record?.title || record?.summary || record?.name, 240);
  const signalType = cleanToken(record?.signal_type || record?.type || "general", 80) || "general";
  const severityCandidate = cleanToken(record?.severity || "medium", 20).toLowerCase();
  const severity = VALID_SEVERITIES.has(severityCandidate) ? severityCandidate : "medium";
  const propertyRefs = Array.isArray(record?.property_refs)
    ? record.property_refs.map((item) => cleanToken(item, 80)).filter(Boolean).slice(0, 50)
    : [];
  const allowedNextActions = Array.isArray(record?.allowed_next_actions)
    ? record.allowed_next_actions.map((item) => cleanToken(item, 80)).filter(Boolean).slice(0, 25)
    : [];

  const errors = [];
  if (!sourceId) errors.push("source_id is required");
  if (!title) errors.push("title is required");

  return {
    ok: errors.length === 0,
    errors,
    value: {
      sourceSystem,
      sourceId,
      sourceUrl: cleanNullableText(record?.source_url || record?.url, 1000),
      title,
      status: cleanNullableText(record?.status, 120),
      owner: cleanNullableText(record?.owner || record?.assignee, 160),
      updatedAt: cleanNullableText(record?.updated_at, 80),
      propertyRefs,
      severity,
      signalType,
      summary: cleanNullableText(record?.summary || record?.description, 1200),
      allowedNextActions,
      rawRecordJson: safeJson(record, {})
    }
  };
}

async function ingest(request, env) {
  if (String(env.OPS_WATCH_INGEST_ENABLED || "true").toLowerCase() !== "true") {
    return json({ ok: false, error: "ingest_disabled" }, { status: 503 });
  }

  const maxBytes = parsePositiveInt(env.OPS_WATCH_INGEST_MAX_BYTES, DEFAULT_MAX_BYTES);
  const contentLength = Number.parseInt(request.headers.get("content-length") || "0", 10);
  if (contentLength > maxBytes) {
    return json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
    return json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }

  const auth = await verifySignature(request, env, rawBody);
  if (!auth.ok) {
    return json({ ok: false, error: auth.code }, { status: auth.status });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const validation = validatePayload(payload, env);
  if (!validation.ok) {
    return json({ ok: false, error: "invalid_payload", details: validation.errors }, { status: 400 });
  }

  const receivedAt = new Date().toISOString();
  const payloadSha = await sha256Hex(rawBody);
  const safeSource = validation.sourceSystem;
  const safeRunId = validation.runId;
  const r2Key = `ops-watch/ingest/${safeSource}/${safeRunId}.json`;
  const sourceLabel = cleanNullableText(payload.source_label, 160);
  const producer = cleanNullableText(payload.producer, 160);
  const schemaVersion = cleanText(payload.schema_version || env.OPS_WATCH_INGEST_SCHEMA_VERSION || SCHEMA_VERSION, 80);

  const accepted = [];
  const rejected = [];
  for (const [index, record] of validation.records.entries()) {
    const normalized = normalizeRecord(record, safeSource);
    if (normalized.ok) {
      accepted.push(normalized.value);
    } else {
      rejected.push({ index, errors: normalized.errors });
    }
  }

  await env.POP_BRIEF_UPLOADS.put(r2Key, rawBody, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: {
      source_system: safeSource,
      run_id: safeRunId,
      payload_sha256: payloadSha,
      received_at: receivedAt
    }
  });

  await env.POP_BRIEF_DB.prepare(
    `INSERT OR REPLACE INTO ops_watch_ingest_runs (
      run_id, source_system, source_label, generated_at, received_at,
      record_count, accepted_count, rejected_count, r2_key, payload_sha256,
      producer, schema_version, status, error_text, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      safeRunId,
      safeSource,
      sourceLabel,
      validation.generatedAt,
      receivedAt,
      validation.records.length,
      accepted.length,
      rejected.length,
      r2Key,
      payloadSha,
      producer,
      schemaVersion,
      accepted.length ? "accepted" : "rejected",
      rejected.length ? safeJson(rejected.slice(0, 25), []) : null,
      receivedAt
    )
    .run();

  for (const record of accepted) {
    const signalId = `ops_watch_signal_${(await sha256Hex(`${record.sourceSystem}:${record.sourceId}:${record.signalType}`)).slice(0, 32)}`;
    await env.POP_BRIEF_DB.prepare(
      `INSERT INTO ops_watch_signals (
        signal_id, run_id, source_system, source_id, source_url, title, status,
        owner, source_updated_at, property_refs_json, severity, signal_type, summary,
        allowed_next_actions_json, raw_record_json, first_seen_at, last_seen_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_system, source_id, signal_type) DO UPDATE SET
        signal_id = excluded.signal_id,
        run_id = excluded.run_id,
        source_url = excluded.source_url,
        title = excluded.title,
        status = excluded.status,
        owner = excluded.owner,
        source_updated_at = excluded.source_updated_at,
        property_refs_json = excluded.property_refs_json,
        severity = excluded.severity,
        summary = excluded.summary,
        allowed_next_actions_json = excluded.allowed_next_actions_json,
        raw_record_json = excluded.raw_record_json,
        last_seen_at = excluded.last_seen_at,
        updated_at = excluded.updated_at`
    )
      .bind(
        signalId,
        safeRunId,
        record.sourceSystem,
        record.sourceId,
        record.sourceUrl,
        record.title,
        record.status,
        record.owner,
        record.updatedAt,
        safeJson(record.propertyRefs, []),
        record.severity,
        record.signalType,
        record.summary,
        safeJson(record.allowedNextActions, []),
        record.rawRecordJson,
        receivedAt,
        receivedAt,
        receivedAt
      )
      .run();
  }

  return json({
    ok: true,
    run_id: safeRunId,
    source_system: safeSource,
    record_count: validation.records.length,
    accepted_count: accepted.length,
    rejected_count: rejected.length,
    r2_key: r2Key,
    payload_sha256: payloadSha
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        status: "ok",
        service: "ops-watch-ingest",
        ingest_enabled: String(env.OPS_WATCH_INGEST_ENABLED || "true").toLowerCase() === "true"
      });
    }

    if (request.method === "POST" && url.pathname === "/v1/ops-watch/ingest") {
      return ingest(request, env);
    }

    return json({ ok: false, error: "not_found" }, { status: 404 });
  }
};
