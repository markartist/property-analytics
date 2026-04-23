import { queryAll, queryFirst, run } from "../../lib/db";
import { newId } from "../../lib/id";
import { AppError, nowISO, validateSafeText } from "../../lib/validate";
import { stableHash } from "../shared/stable-hash";

export type MemoryScope = "property" | "fleet" | "ledger";
export type MemoryStatus = "active" | "candidate" | "approved" | "deprecated";
export type CandidateStatus = "pending" | "promoted" | "rejected";
export type Role = "admin" | "editor" | "viewer";

export interface EvidenceReferenceInput {
  evidenceType: string;
  evidenceSource: string;
  evidenceRef: string;
  evidenceExcerpt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateCaptainLogEntryInput {
  propertyId: string;
  summary: string;
  structuredPayload?: Record<string, unknown> | null;
  evidence: EvidenceReferenceInput[];
  sourceSystem: string;
  confidence: number;
}

export interface CreateMemoryCandidateInput {
  sourceEntryId: string;
  targetScope: "fleet" | "ledger";
  rationale: string;
  proposedSummary?: string;
  proposedStructuredPayload?: Record<string, unknown> | null;
}

export interface PromoteCandidateInput {
  candidateId: string;
  actionNotes?: string | null;
}

export interface MemoryEvidenceRef {
  id: string;
  memory_entry_id: string;
  evidence_type: string;
  evidence_source: string;
  evidence_ref: string;
  evidence_excerpt: string | null;
  metadata_json: string | null;
  created_at: string;
}

export interface MemoryLineageRef {
  id: string;
  target_entry_id: string;
  source_entry_id: string;
  source_candidate_id: string | null;
  created_at: string;
}

export interface MemoryEntry {
  id: string;
  scope: MemoryScope;
  property_id: string | null;
  fleet_key: string | null;
  ledger_key: string | null;
  summary: string;
  structured_payload_json: string | null;
  source_system: string;
  created_by: string;
  confidence: number;
  status: MemoryStatus;
  dedupe_signature: string;
  parent_entry_id: string | null;
  originating_candidate_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryEntryWithEvidence {
  entry: MemoryEntry;
  evidence: MemoryEvidenceRef[];
  lineage: MemoryLineageRef[];
}

export interface MemoryCandidate {
  id: string;
  source_entry_id: string;
  source_scope: "property" | "fleet";
  target_scope: "fleet" | "ledger";
  property_id: string | null;
  fleet_key: string | null;
  ledger_key: string | null;
  proposed_summary: string;
  proposed_structured_payload_json: string | null;
  rationale: string;
  status: CandidateStatus;
  requested_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdentityBinding {
  id: string;
  scope: MemoryScope;
  property_id: string | null;
  fleet_key: string | null;
  ledger_key: string | null;
  role_family: "Captain" | "Commodore" | "Ledger";
  display_name: string;
  internal_name: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

interface ListOptions {
  includeAll?: boolean;
}

interface PropertyRow {
  id: string;
  name: string;
  region: string | null;
  encasa_short_name: string | null;
}

interface FleetSummaryRow {
  fleet_key: string;
  property_count: number;
  memory_count: number;
  pending_candidates: number;
}

export async function ensureGovernedMemoryTables(db: D1Database): Promise<void> {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS governed_memory_entries (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL CHECK (scope IN ('property', 'fleet', 'ledger')),
      property_id TEXT,
      fleet_key TEXT,
      ledger_key TEXT,
      summary TEXT NOT NULL,
      structured_payload_json TEXT,
      source_system TEXT NOT NULL,
      created_by TEXT NOT NULL,
      confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
      status TEXT NOT NULL CHECK (status IN ('active', 'candidate', 'approved', 'deprecated')),
      dedupe_signature TEXT NOT NULL,
      parent_entry_id TEXT REFERENCES governed_memory_entries(id),
      originating_candidate_id TEXT REFERENCES governed_memory_candidates(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (
        (scope = 'property' AND property_id IS NOT NULL AND fleet_key IS NULL AND ledger_key IS NULL) OR
        (scope = 'fleet' AND property_id IS NULL AND fleet_key IS NOT NULL AND ledger_key IS NULL) OR
        (scope = 'ledger' AND property_id IS NULL AND fleet_key IS NULL AND ledger_key IS NOT NULL)
      )
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS governed_memory_evidence_refs (
      id TEXT PRIMARY KEY,
      memory_entry_id TEXT NOT NULL REFERENCES governed_memory_entries(id) ON DELETE CASCADE,
      evidence_type TEXT NOT NULL,
      evidence_source TEXT NOT NULL,
      evidence_ref TEXT NOT NULL,
      evidence_excerpt TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS governed_memory_candidates (
      id TEXT PRIMARY KEY,
      source_entry_id TEXT NOT NULL REFERENCES governed_memory_entries(id) ON DELETE CASCADE,
      source_scope TEXT NOT NULL CHECK (source_scope IN ('property', 'fleet')),
      target_scope TEXT NOT NULL CHECK (target_scope IN ('fleet', 'ledger')),
      property_id TEXT,
      fleet_key TEXT,
      ledger_key TEXT,
      proposed_summary TEXT NOT NULL,
      proposed_structured_payload_json TEXT,
      rationale TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'promoted', 'rejected')),
      requested_by TEXT NOT NULL,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS governed_memory_promotions (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL REFERENCES governed_memory_candidates(id) ON DELETE CASCADE,
      from_entry_id TEXT NOT NULL REFERENCES governed_memory_entries(id) ON DELETE CASCADE,
      to_entry_id TEXT NOT NULL REFERENCES governed_memory_entries(id),
      from_scope TEXT NOT NULL CHECK (from_scope IN ('property', 'fleet')),
      to_scope TEXT NOT NULL CHECK (to_scope IN ('fleet', 'ledger')),
      action_type TEXT NOT NULL CHECK (action_type IN ('promoted_new', 'promoted_existing')),
      promoted_by TEXT NOT NULL,
      action_notes TEXT,
      evidence_snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS governed_memory_entry_lineage (
      id TEXT PRIMARY KEY,
      target_entry_id TEXT NOT NULL REFERENCES governed_memory_entries(id) ON DELETE CASCADE,
      source_entry_id TEXT NOT NULL REFERENCES governed_memory_entries(id) ON DELETE CASCADE,
      source_candidate_id TEXT REFERENCES governed_memory_candidates(id),
      created_at TEXT NOT NULL,
      UNIQUE (target_entry_id, source_entry_id, source_candidate_id)
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS governed_memory_identity_bindings (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL CHECK (scope IN ('property', 'fleet', 'ledger')),
      property_id TEXT,
      fleet_key TEXT,
      ledger_key TEXT,
      role_family TEXT NOT NULL CHECK (role_family IN ('Captain', 'Commodore', 'Ledger')),
      display_name TEXT NOT NULL,
      internal_name TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (
        (scope = 'property' AND property_id IS NOT NULL AND fleet_key IS NULL AND ledger_key IS NULL) OR
        (scope = 'fleet' AND property_id IS NULL AND fleet_key IS NOT NULL AND ledger_key IS NULL) OR
        (scope = 'ledger' AND property_id IS NULL AND fleet_key IS NULL AND ledger_key IS NOT NULL)
      )
    )`
  );

  const now = nowISO();
  const ledger = await queryFirst<{ id: string }>(
    db,
    `SELECT id FROM governed_memory_identity_bindings WHERE scope = 'ledger' AND ledger_key = 'the-ledger'`
  );
  if (!ledger) {
    await run(
      db,
      `INSERT INTO governed_memory_identity_bindings (
        id, scope, property_id, fleet_key, ledger_key, role_family, display_name, internal_name, metadata_json, created_at, updated_at
      ) VALUES (?, 'ledger', NULL, NULL, 'the-ledger', 'Ledger', 'The Ledger', NULL, ?, ?, ?)`,
      [newId(), JSON.stringify({ personified: false }), now, now]
    );
  }
}

export async function listMemoryProperties(db: D1Database): Promise<
  Array<{
    propertyId: string;
    propertyName: string;
    shortName: string;
    region: string | null;
    fleetKey: string;
    captainDisplayName: string;
    captainInternalName: string;
  }>
> {
  await ensureGovernedMemoryTables(db);
  const rows = await queryAll<PropertyRow & { captain_display_name: string | null; captain_internal_name: string | null }>(
    db,
    `SELECT
      c.id,
      c.name,
      c.region,
      c.encasa_short_name,
      b.display_name AS captain_display_name,
      b.internal_name AS captain_internal_name
     FROM communities c
     LEFT JOIN governed_memory_identity_bindings b
       ON b.scope = 'property' AND b.property_id = c.id
     WHERE c.deleted_at IS NULL
     ORDER BY c.name ASC`
  );

  const items = [];
  for (const row of rows) {
    const shortName = normalizePropertyShortName(row.encasa_short_name || row.name);
    const fleetKey = normalizeFleetKey(row.region, row.id);
    const identity = await ensurePropertyIdentity(db, row.id, shortName);
    items.push({
      propertyId: row.id,
      propertyName: row.name,
      shortName,
      region: row.region,
      fleetKey,
      captainDisplayName: identity.display_name,
      captainInternalName: identity.internal_name ?? identity.display_name,
    });
  }
  return items;
}

export async function listCaptainLog(
  db: D1Database,
  propertyId: string,
  options: ListOptions = {}
): Promise<MemoryEntryWithEvidence[]> {
  await ensureGovernedMemoryTables(db);
  return hydrateEntries(
    db,
    await queryAll<MemoryEntry>(
      db,
      `SELECT *
       FROM governed_memory_entries
       WHERE scope = 'property' AND property_id = ? ${authoritativeStatusClause("property", options)}
       ORDER BY created_at DESC`,
      [propertyId]
    )
  );
}

export async function listFleetBrief(
  db: D1Database,
  fleetKey: string,
  options: ListOptions = {}
): Promise<{ entries: MemoryEntryWithEvidence[]; pendingCandidates: MemoryCandidate[]; identity: IdentityBinding | null }> {
  await ensureGovernedMemoryTables(db);
  const [entries, pendingCandidates, identity] = await Promise.all([
    hydrateEntries(
      db,
      await queryAll<MemoryEntry>(
        db,
        `SELECT *
         FROM governed_memory_entries
         WHERE scope = 'fleet' AND fleet_key = ? ${authoritativeStatusClause("fleet", options)}
         ORDER BY created_at DESC`,
        [fleetKey]
      )
    ),
    queryAll<MemoryCandidate>(
      db,
      `SELECT *
       FROM governed_memory_candidates
       WHERE target_scope = 'fleet' AND fleet_key = ? AND status = 'pending'
       ORDER BY created_at DESC`,
      [fleetKey]
    ),
    queryFirst<IdentityBinding>(
      db,
      `SELECT *
       FROM governed_memory_identity_bindings
       WHERE scope = 'fleet' AND fleet_key = ?`,
      [fleetKey]
    ),
  ]);

  return { entries, pendingCandidates, identity };
}

export async function listFleetSummaries(db: D1Database): Promise<
  Array<{
    fleetKey: string;
    displayName: string;
    propertyCount: number;
    memoryCount: number;
    pendingCandidates: number;
  }>
> {
  await ensureGovernedMemoryTables(db);
  const rows = await queryAll<FleetSummaryRow & { display_name: string | null }>(
    db,
    `WITH fleet_base AS (
      SELECT DISTINCT
        CASE
          WHEN region IS NOT NULL AND TRIM(region) <> '' THEN LOWER(REPLACE(TRIM(region), ' ', '-'))
          ELSE 'property-' || id
        END AS fleet_key,
        COUNT(*) OVER (
          PARTITION BY CASE
            WHEN region IS NOT NULL AND TRIM(region) <> '' THEN LOWER(REPLACE(TRIM(region), ' ', '-'))
            ELSE 'property-' || id
          END
        ) AS property_count
      FROM communities
      WHERE deleted_at IS NULL
    )
    SELECT
      f.fleet_key,
      MAX(f.property_count) AS property_count,
      COALESCE((
        SELECT COUNT(*)
        FROM governed_memory_entries e
        WHERE e.scope = 'fleet' AND e.fleet_key = f.fleet_key AND e.status = 'active'
      ), 0) AS memory_count,
      COALESCE((
        SELECT COUNT(*)
        FROM governed_memory_candidates c
        WHERE c.target_scope = 'fleet' AND c.fleet_key = f.fleet_key AND c.status = 'pending'
      ), 0) AS pending_candidates,
      b.display_name
    FROM fleet_base f
    LEFT JOIN governed_memory_identity_bindings b
      ON b.scope = 'fleet' AND b.fleet_key = f.fleet_key
    GROUP BY f.fleet_key, b.display_name
    ORDER BY f.fleet_key ASC`
  );

  const items = [];
  for (const row of rows) {
    const identity = row.display_name
      ? { display_name: row.display_name }
      : await ensureFleetIdentity(db, row.fleet_key);
    items.push({
      fleetKey: row.fleet_key,
      displayName: identity.display_name,
      propertyCount: row.property_count,
      memoryCount: row.memory_count,
      pendingCandidates: row.pending_candidates,
    });
  }
  return items;
}

export async function listLedger(
  db: D1Database,
  options: ListOptions = {}
): Promise<{ entries: MemoryEntryWithEvidence[]; pendingCandidates: MemoryCandidate[]; identity: IdentityBinding | null }> {
  await ensureGovernedMemoryTables(db);
  const [entries, pendingCandidates, identity] = await Promise.all([
    hydrateEntries(
      db,
      await queryAll<MemoryEntry>(
        db,
        `SELECT *
         FROM governed_memory_entries
         WHERE scope = 'ledger' AND ledger_key = 'the-ledger' ${authoritativeStatusClause("ledger", options)}
         ORDER BY created_at DESC`
      )
    ),
    queryAll<MemoryCandidate>(
      db,
      `SELECT *
       FROM governed_memory_candidates
       WHERE target_scope = 'ledger' AND ledger_key = 'the-ledger' AND status = 'pending'
       ORDER BY created_at DESC`
    ),
    queryFirst<IdentityBinding>(
      db,
      `SELECT *
       FROM governed_memory_identity_bindings
       WHERE scope = 'ledger' AND ledger_key = 'the-ledger'`
    ),
  ]);

  return { entries, pendingCandidates, identity };
}

export async function createCaptainLogEntry(
  db: D1Database,
  input: CreateCaptainLogEntryInput,
  actorUserId: string
): Promise<MemoryEntryWithEvidence> {
  await ensureGovernedMemoryTables(db);
  validateEntryCreateInput(input.summary, input.sourceSystem, input.confidence, input.evidence);
  await ensurePropertyExists(db, input.propertyId);

  const now = nowISO();
  const id = newId();
  const structuredPayloadJson = input.structuredPayload ? JSON.stringify(input.structuredPayload) : null;
  const dedupeSignature = computeDedupeSignature("property", input.summary, { propertyId: input.propertyId });

  await run(
    db,
    `INSERT INTO governed_memory_entries (
      id, scope, property_id, fleet_key, ledger_key, summary, structured_payload_json, source_system,
      created_by, confidence, status, dedupe_signature, parent_entry_id, originating_candidate_id, created_at, updated_at
    ) VALUES (?, 'property', ?, NULL, NULL, ?, ?, ?, ?, ?, 'active', ?, NULL, NULL, ?, ?)`,
    [id, input.propertyId, input.summary.trim(), structuredPayloadJson, input.sourceSystem.trim(), actorUserId, input.confidence, dedupeSignature, now, now]
  );

  await insertEvidence(db, id, input.evidence, now);
  const created = await getEntryWithEvidence(db, id);
  if (!created) {
    throw new AppError(500, "INTERNAL_ERROR", "Captain's Log entry could not be loaded after creation");
  }
  await ensurePropertyIdentity(db, input.propertyId);
  return created;
}

export async function createMemoryCandidate(
  db: D1Database,
  input: CreateMemoryCandidateInput,
  actorUserId: string
): Promise<MemoryCandidate> {
  await ensureGovernedMemoryTables(db);
  validateSafeField(input.rationale, "rationale");

  const source = await queryFirst<MemoryEntry>(
    db,
    `SELECT *
     FROM governed_memory_entries
     WHERE id = ?`,
    [input.sourceEntryId]
  );
  if (!source) {
    throw new AppError(404, "NOT_FOUND", "Source memory entry not found");
  }

  if (source.scope === "property" && input.targetScope !== "fleet") {
    throw new AppError(409, "POLICY_VIOLATION", "Property memory may only be proposed upward as a Fleet Brief candidate");
  }
  if (source.scope === "fleet" && input.targetScope !== "ledger") {
    throw new AppError(409, "POLICY_VIOLATION", "Fleet Brief memory may only be proposed upward as a Ledger candidate");
  }
  if (source.scope === "ledger") {
    throw new AppError(409, "POLICY_VIOLATION", "Ledger entries do not promote upward");
  }

  const evidence = await queryAll<MemoryEvidenceRef>(
    db,
    `SELECT *
     FROM governed_memory_evidence_refs
     WHERE memory_entry_id = ?`,
    [source.id]
  );
  if (evidence.length === 0) {
    throw new AppError(409, "POLICY_VIOLATION", "Promotion candidates require a source entry with evidence references");
  }

  const fleetKey = input.targetScope === "fleet"
    ? await resolveGovernedFleetKeyForSource(db, source)
    : source.fleet_key;
  const ledgerKey = input.targetScope === "ledger" ? "the-ledger" : null;

  if (input.targetScope === "fleet" && !fleetKey) {
    throw new AppError(400, "VALIDATION_ERROR", "Fleet Brief candidates require a fleet key");
  }
  if (input.targetScope === "ledger" && source.scope !== "fleet") {
    throw new AppError(409, "POLICY_VIOLATION", "Only Fleet Brief entries can become Ledger candidates");
  }

  const now = nowISO();
  const id = newId();
  const proposedSummary = (input.proposedSummary ?? source.summary).trim();
  validateSafeField(proposedSummary, "proposedSummary");

  await run(
    db,
    `INSERT INTO governed_memory_candidates (
      id, source_entry_id, source_scope, target_scope, property_id, fleet_key, ledger_key,
      proposed_summary, proposed_structured_payload_json, rationale, status, requested_by, reviewed_by, reviewed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, ?, ?)`,
    [
      id,
      source.id,
      source.scope,
      input.targetScope,
      source.property_id,
      fleetKey ?? null,
      ledgerKey,
      proposedSummary,
      input.proposedStructuredPayload ? JSON.stringify(input.proposedStructuredPayload) : source.structured_payload_json,
      input.rationale.trim(),
      actorUserId,
      now,
      now,
    ]
  );

  if (input.targetScope === "fleet" && fleetKey) {
    await ensureFleetIdentity(db, fleetKey);
  }

  const candidate = await queryFirst<MemoryCandidate>(
    db,
    `SELECT * FROM governed_memory_candidates WHERE id = ?`,
    [id]
  );
  if (!candidate) {
    throw new AppError(500, "INTERNAL_ERROR", "Memory candidate could not be loaded after creation");
  }
  return candidate;
}

export async function promoteCandidate(
  db: D1Database,
  input: PromoteCandidateInput,
  actorUserId: string
): Promise<{ candidate: MemoryCandidate; entry: MemoryEntryWithEvidence; actionType: "promoted_new" | "promoted_existing" }> {
  await ensureGovernedMemoryTables(db);
  const candidate = await queryFirst<MemoryCandidate>(
    db,
    `SELECT *
     FROM governed_memory_candidates
     WHERE id = ?`,
    [input.candidateId]
  );
  if (!candidate) {
    throw new AppError(404, "NOT_FOUND", "Memory candidate not found");
  }
  if (candidate.status !== "pending") {
    throw new AppError(409, "POLICY_VIOLATION", "Only pending candidates may be promoted");
  }

  const source = await queryFirst<MemoryEntry>(
    db,
    `SELECT *
     FROM governed_memory_entries
     WHERE id = ?`,
    [candidate.source_entry_id]
  );
  if (!source) {
    throw new AppError(404, "NOT_FOUND", "Source memory entry not found");
  }

  if (candidate.target_scope === "fleet" && source.scope !== "property") {
    throw new AppError(409, "POLICY_VIOLATION", "Fleet Brief promotions must originate from Captain's Log entries");
  }
  if (candidate.target_scope === "ledger" && source.scope !== "fleet") {
    throw new AppError(409, "POLICY_VIOLATION", "Ledger promotions must originate from Fleet Brief entries");
  }

  const evidence = await queryAll<MemoryEvidenceRef>(
    db,
    `SELECT *
     FROM governed_memory_evidence_refs
     WHERE memory_entry_id = ?`,
    [source.id]
  );
  if (evidence.length === 0) {
    throw new AppError(409, "POLICY_VIOLATION", "Promotions require evidence on the source entry");
  }

  const dedupeSignature = computeDedupeSignature(candidate.target_scope, candidate.proposed_summary, {
    fleetKey: candidate.fleet_key,
    ledgerKey: candidate.ledger_key,
  });
  const existing = await queryFirst<MemoryEntry>(
    db,
    `SELECT *
     FROM governed_memory_entries
     WHERE scope = ? AND dedupe_signature = ? AND status IN ('active', 'approved')
     ORDER BY created_at DESC
     LIMIT 1`,
    [candidate.target_scope, dedupeSignature]
  );

  const now = nowISO();
  let targetEntryId: string;
  let actionType: "promoted_new" | "promoted_existing";
  if (existing) {
    targetEntryId = existing.id;
    actionType = "promoted_existing";
    await attachLineage(db, targetEntryId, source.id, candidate.id, now);
  } else {
    targetEntryId = newId();
    actionType = "promoted_new";
    await run(
      db,
      `INSERT INTO governed_memory_entries (
        id, scope, property_id, fleet_key, ledger_key, summary, structured_payload_json, source_system,
        created_by, confidence, status, dedupe_signature, parent_entry_id, originating_candidate_id, created_at, updated_at
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetEntryId,
        candidate.target_scope,
        candidate.target_scope === "fleet" ? candidate.fleet_key : null,
        candidate.target_scope === "ledger" ? "the-ledger" : null,
        candidate.proposed_summary,
        candidate.proposed_structured_payload_json,
        source.source_system,
        actorUserId,
        source.confidence,
        candidate.target_scope === "ledger" ? "approved" : "active",
        dedupeSignature,
        source.id,
        candidate.id,
        now,
        now,
      ]
    );
    await insertEvidence(
      db,
      targetEntryId,
      evidence.map((item) => ({
        evidenceType: item.evidence_type,
        evidenceSource: item.evidence_source,
        evidenceRef: item.evidence_ref,
        evidenceExcerpt: item.evidence_excerpt,
        metadata: safeParseJson(item.metadata_json),
      })),
      now
    );
    await attachLineage(db, targetEntryId, source.id, candidate.id, now);
  }

  await run(
    db,
    `UPDATE governed_memory_candidates
     SET status = 'promoted', reviewed_by = ?, reviewed_at = ?, updated_at = ?
     WHERE id = ?`,
    [actorUserId, now, now, candidate.id]
  );

  await run(
    db,
    `INSERT INTO governed_memory_promotions (
      id, candidate_id, from_entry_id, to_entry_id, from_scope, to_scope, action_type,
      promoted_by, action_notes, evidence_snapshot_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      candidate.id,
      source.id,
      targetEntryId,
      source.scope,
      candidate.target_scope,
      actionType,
      actorUserId,
      input.actionNotes?.trim() || null,
      JSON.stringify(evidence),
      now,
    ]
  );

  const refreshedCandidate = await queryFirst<MemoryCandidate>(
    db,
    `SELECT * FROM governed_memory_candidates WHERE id = ?`,
    [candidate.id]
  );
  const refreshedEntry = await getEntryWithEvidence(db, targetEntryId);
  if (!refreshedCandidate || !refreshedEntry) {
    throw new AppError(500, "INTERNAL_ERROR", "Promotion result could not be loaded");
  }
  return { candidate: refreshedCandidate, entry: refreshedEntry, actionType };
}

export async function getMemoryContextForProperty(
  db: D1Database,
  propertyId: string,
  options: ListOptions = {}
): Promise<{
  propertyId: string;
  fleetKey: string;
  identity: IdentityBinding;
  captainLog: MemoryEntryWithEvidence[];
  fleetBrief: MemoryEntryWithEvidence[];
  ledger: MemoryEntryWithEvidence[];
}> {
  await ensureGovernedMemoryTables(db);
  const property = await getPropertyRow(db, propertyId);
  if (!property) {
    throw new AppError(404, "NOT_FOUND", "Property not found");
  }
  const fleetKey = normalizeFleetKey(property.region, property.id);
  const identity = await ensurePropertyIdentity(db, property.id, normalizePropertyShortName(property.encasa_short_name || property.name));
  const [captainLog, fleetBrief, ledger] = await Promise.all([
    listCaptainLog(db, propertyId, options),
    hydrateEntries(
      db,
      await queryAll<MemoryEntry>(
        db,
        `SELECT *
         FROM governed_memory_entries
         WHERE scope = 'fleet' AND fleet_key = ? ${authoritativeStatusClause("fleet", options)}
         ORDER BY created_at DESC
         LIMIT 10`,
        [fleetKey]
      )
    ),
    hydrateEntries(
      db,
      await queryAll<MemoryEntry>(
        db,
        `SELECT *
         FROM governed_memory_entries
         WHERE scope = 'ledger' AND ledger_key = 'the-ledger' ${authoritativeStatusClause("ledger", options)}
         ORDER BY created_at DESC
         LIMIT 10`
      )
    ),
  ]);

  return { propertyId, fleetKey, identity, captainLog, fleetBrief, ledger };
}

export async function getFleetContext(db: D1Database, fleetKey: string, options: ListOptions = {}) {
  await ensureGovernedMemoryTables(db);
  return {
    fleetKey,
    ...(await listFleetBrief(db, fleetKey, options)),
  };
}

export async function getLedgerContext(db: D1Database, options: ListOptions = {}) {
  await ensureGovernedMemoryTables(db);
  return {
    ledgerKey: "the-ledger",
    ...(await listLedger(db, options)),
  };
}

async function getPropertyRow(db: D1Database, propertyId: string): Promise<PropertyRow | null> {
  const direct = await queryFirst<PropertyRow>(
    db,
    `SELECT id, name, region, encasa_short_name
     FROM communities
     WHERE id = ? AND deleted_at IS NULL`,
    [propertyId]
  );
  if (direct) return direct;

  try {
    return await queryFirst<PropertyRow>(
      db,
      `SELECT
         p.property_id AS id,
         p.property_name AS name,
         c.region AS region,
         c.encasa_short_name AS encasa_short_name
       FROM intelligence_pilot_properties p
       LEFT JOIN communities c
         ON c.id = p.property_id
        AND c.deleted_at IS NULL
       WHERE p.property_id = ?
          OR lower(p.property_name) = lower(?)`,
      [propertyId, propertyId.replace(/[-_]+/g, " ")]
    );
  } catch (error: any) {
    const message = String(error?.message ?? "");
    if (message.includes("no such table")) return null;
    throw error;
  }
}

async function ensurePropertyExists(db: D1Database, propertyId: string): Promise<void> {
  const row = await getPropertyRow(db, propertyId);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "Property not found");
  }
}

async function resolveGovernedFleetKeyForSource(
  db: D1Database,
  source: MemoryEntry
): Promise<string> {
  if (source.scope !== "property" || !source.property_id) {
    throw new AppError(409, "POLICY_VIOLATION", "Fleet Brief candidates must originate from property memory");
  }

  const property = await getPropertyRow(db, source.property_id);
  if (!property) {
    throw new AppError(404, "NOT_FOUND", "Property not found for governed fleet resolution");
  }

  const governedFleetKey = normalizeFleetKey(property.region, property.id);
  return governedFleetKey;
}

async function ensurePropertyIdentity(
  db: D1Database,
  propertyId: string,
  shortNameOverride?: string
): Promise<IdentityBinding> {
  const existing = await queryFirst<IdentityBinding>(
    db,
    `SELECT *
     FROM governed_memory_identity_bindings
     WHERE scope = 'property' AND property_id = ?`,
    [propertyId]
  );
  if (existing) return existing;

  const property = await getPropertyRow(db, propertyId);
  if (!property) {
    throw new AppError(404, "NOT_FOUND", "Property not found");
  }
  const shortName = shortNameOverride ?? normalizePropertyShortName(property.encasa_short_name || property.name);
  const now = nowISO();
  const displayName = `${shortName}'s Captain`;
  const internalName = `${shortName}'s Captain (Meridian)`;
  const id = newId();
  await run(
    db,
    `INSERT INTO governed_memory_identity_bindings (
      id, scope, property_id, fleet_key, ledger_key, role_family, display_name, internal_name, metadata_json, created_at, updated_at
    ) VALUES (?, 'property', ?, NULL, NULL, 'Captain', ?, ?, ?, ?, ?)`,
    [id, propertyId, displayName, internalName, JSON.stringify({ propertyName: property.name }), now, now]
  );
  return {
    id,
    scope: "property",
    property_id: propertyId,
    fleet_key: null,
    ledger_key: null,
    role_family: "Captain",
    display_name: displayName,
    internal_name: internalName,
    metadata_json: JSON.stringify({ propertyName: property.name }),
    created_at: now,
    updated_at: now,
  };
}

async function ensureFleetIdentity(db: D1Database, fleetKey: string): Promise<IdentityBinding> {
  const existing = await queryFirst<IdentityBinding>(
    db,
    `SELECT *
     FROM governed_memory_identity_bindings
     WHERE scope = 'fleet' AND fleet_key = ?`,
    [fleetKey]
  );
  if (existing) return existing;

  const now = nowISO();
  const displayName = `Commodore · ${humanizeFleetKey(fleetKey)}`;
  const id = newId();
  await run(
    db,
    `INSERT INTO governed_memory_identity_bindings (
      id, scope, property_id, fleet_key, ledger_key, role_family, display_name, internal_name, metadata_json, created_at, updated_at
    ) VALUES (?, 'fleet', NULL, ?, NULL, 'Commodore', ?, NULL, ?, ?, ?)`,
    [id, fleetKey, displayName, JSON.stringify({ fleetKey }), now, now]
  );
  return {
    id,
    scope: "fleet",
    property_id: null,
    fleet_key: fleetKey,
    ledger_key: null,
    role_family: "Commodore",
    display_name: displayName,
    internal_name: null,
    metadata_json: JSON.stringify({ fleetKey }),
    created_at: now,
    updated_at: now,
  };
}

async function hydrateEntries(db: D1Database, entries: MemoryEntry[]): Promise<MemoryEntryWithEvidence[]> {
  const items = [];
  for (const entry of entries) {
    const enriched = await getEntryWithEvidence(db, entry.id);
    if (enriched) items.push(enriched);
  }
  return items;
}

async function getEntryWithEvidence(db: D1Database, entryId: string): Promise<MemoryEntryWithEvidence | null> {
  const entry = await queryFirst<MemoryEntry>(
    db,
    `SELECT *
     FROM governed_memory_entries
     WHERE id = ?`,
    [entryId]
  );
  if (!entry) return null;
  const directEvidence = await queryAll<MemoryEvidenceRef>(
    db,
    `SELECT *
     FROM governed_memory_evidence_refs
     WHERE memory_entry_id = ?
     ORDER BY created_at ASC`,
    [entryId]
  );
  const lineage = await queryAll<MemoryLineageRef>(
    db,
    `SELECT *
     FROM governed_memory_entry_lineage
     WHERE target_entry_id = ?
     ORDER BY created_at ASC`,
    [entryId]
  );

  const evidenceByKey = new Map<string, MemoryEvidenceRef>();
  for (const item of directEvidence) {
    evidenceByKey.set(`${item.memory_entry_id}:${item.evidence_type}:${item.evidence_source}:${item.evidence_ref}`, item);
  }

  if (lineage.length > 0) {
    const lineageSourceIds = Array.from(new Set(lineage.map((item) => item.source_entry_id)));
    const lineageEvidence = await queryAll<MemoryEvidenceRef>(
      db,
      `SELECT *
       FROM governed_memory_evidence_refs
       WHERE memory_entry_id IN (${lineageSourceIds.map(() => "?").join(",")})
       ORDER BY created_at ASC`,
      lineageSourceIds
    );
    for (const item of lineageEvidence) {
      evidenceByKey.set(`${item.memory_entry_id}:${item.evidence_type}:${item.evidence_source}:${item.evidence_ref}`, item);
    }
  }

  return { entry, evidence: Array.from(evidenceByKey.values()), lineage };
}

async function attachLineage(
  db: D1Database,
  targetEntryId: string,
  sourceEntryId: string,
  sourceCandidateId: string,
  now: string
): Promise<void> {
  await insertLineageRow(db, targetEntryId, sourceEntryId, sourceCandidateId, now);
  const inherited = await queryAll<MemoryLineageRef>(
    db,
    `SELECT *
     FROM governed_memory_entry_lineage
     WHERE target_entry_id = ?`,
    [sourceEntryId]
  );
  for (const item of inherited) {
    await insertLineageRow(db, targetEntryId, item.source_entry_id, item.source_candidate_id, now);
  }
}

async function insertLineageRow(
  db: D1Database,
  targetEntryId: string,
  sourceEntryId: string,
  sourceCandidateId: string | null,
  now: string
): Promise<void> {
  const existing = await queryFirst<{ id: string }>(
    db,
    `SELECT id
     FROM governed_memory_entry_lineage
     WHERE target_entry_id = ?
       AND source_entry_id = ?
       AND ((source_candidate_id IS NULL AND ? IS NULL) OR source_candidate_id = ?)`,
    [targetEntryId, sourceEntryId, sourceCandidateId, sourceCandidateId]
  );
  if (existing) return;
  await run(
    db,
    `INSERT INTO governed_memory_entry_lineage (
      id, target_entry_id, source_entry_id, source_candidate_id, created_at
    ) VALUES (?, ?, ?, ?, ?)`,
    [newId(), targetEntryId, sourceEntryId, sourceCandidateId, now]
  );
}

async function insertEvidence(
  db: D1Database,
  entryId: string,
  evidence: EvidenceReferenceInput[],
  now: string
): Promise<void> {
  for (const item of evidence) {
    validateSafeField(item.evidenceType, "evidenceType");
    validateSafeField(item.evidenceSource, "evidenceSource");
    validateSafeField(item.evidenceRef, "evidenceRef");
    if (item.evidenceExcerpt) validateSafeField(item.evidenceExcerpt, "evidenceExcerpt");
    await run(
      db,
      `INSERT INTO governed_memory_evidence_refs (
        id, memory_entry_id, evidence_type, evidence_source, evidence_ref, evidence_excerpt, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        entryId,
        item.evidenceType.trim(),
        item.evidenceSource.trim(),
        item.evidenceRef.trim(),
        item.evidenceExcerpt?.trim() ?? null,
        item.metadata ? JSON.stringify(item.metadata) : null,
        now,
      ]
    );
  }
}

function validateEntryCreateInput(
  summary: string,
  sourceSystem: string,
  confidence: number,
  evidence: EvidenceReferenceInput[]
) {
  validateSafeField(summary, "summary");
  validateSafeField(sourceSystem, "sourceSystem");
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new AppError(400, "VALIDATION_ERROR", "confidence must be a number between 0 and 1");
  }
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "At least one evidence reference is required");
  }
}

function validateSafeField(value: string, fieldName: string) {
  const message = validateSafeText(value, fieldName);
  if (message) {
    throw new AppError(400, "VALIDATION_ERROR", message);
  }
  if (!value.trim()) {
    throw new AppError(400, "VALIDATION_ERROR", `${fieldName} is required`);
  }
}

function authoritativeStatusClause(scope: MemoryScope, options: ListOptions): string {
  if (options.includeAll) return "";
  if (scope === "ledger") return ` AND status = 'approved'`;
  return ` AND status = 'active'`;
}

function computeDedupeSignature(
  scope: MemoryScope | "fleet" | "ledger",
  summary: string,
  ids: { propertyId?: string | null; fleetKey?: string | null; ledgerKey?: string | null }
) {
  return stableHash([
    scope,
    ids.propertyId ?? "",
    ids.fleetKey ?? "",
    ids.ledgerKey ?? "",
    summary.trim().toLowerCase().replace(/\s+/g, " "),
  ]);
}

function normalizePropertyShortName(value: string): string {
  return value
    .replace(/^the\s+/i, "")
    .replace(/\bat\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFleetKey(region: string | null | undefined, fallbackPropertyId: string): string {
  const normalizedRegion = region?.trim();
  if (normalizedRegion) {
    return normalizedRegion.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  return `property-${fallbackPropertyId}`;
}

function humanizeFleetKey(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function safeParseJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}
