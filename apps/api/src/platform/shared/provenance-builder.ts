import { newId } from "../../lib/id";
import { run } from "../../lib/db";
import { nowISO } from "../../lib/validate";
import type {
  ProvenanceBuilder,
  ProvenanceEnvelopeInput,
  ProvenanceEnvelopeOutput,
} from "../phase1-interfaces";

export function createProvenanceBuilder(db: D1Database): ProvenanceBuilder {
  return {
    async build(input: ProvenanceEnvelopeInput): Promise<ProvenanceEnvelopeOutput> {
      const provenanceEnvelopeId = newId();
      await run(
        db,
        `INSERT INTO provenance_envelopes (
          provenance_envelope_id, object_type, object_id, contract_bundle_id, source_batch_ids_json,
          execution_snapshot_id, agent_contract_id, agent_id, pipeline_health_snapshot_ids_json,
          upstream_object_refs_json, created_by_type, created_by_id, metadata_json, artifact_uri, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          provenanceEnvelopeId,
          input.objectType,
          input.objectId,
          input.contractBundleId,
          JSON.stringify(input.sourceBatchIds),
          input.executionSnapshotId ?? null,
          input.agentContractId ?? null,
          input.agentId ?? null,
          JSON.stringify(input.pipelineHealthSnapshotIds),
          JSON.stringify(input.upstreamObjectRefs),
          input.createdByType,
          input.createdById,
          input.metadata ? JSON.stringify(input.metadata) : null,
          input.artifactUri ?? null,
          nowISO(),
        ]
      );

      return {
        provenanceEnvelopeId,
        objectType: input.objectType,
        objectId: input.objectId,
      };
    },
  };
}

