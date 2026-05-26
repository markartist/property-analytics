import { createTestD1Database } from "../test/helpers/sqlite-d1";
import { runModelGatewayGoldenCaseEvaluationPass } from "../src/platform/model-gateway/evaluation";

async function main() {
  const { db, close } = await createTestD1Database();
  try {
    const result = await runModelGatewayGoldenCaseEvaluationPass(db, process.env as Record<string, string | undefined>);
    console.log(JSON.stringify({
      config: result.config,
      aggregate: result.aggregate,
      deterministic_results: result.deterministic_results.map((item) => ({
        fixture_id: item.fixture_id,
        structural_validity_score: item.structural_validity_score,
        governance_validity_score: item.governance_validity_score,
        redaction_compliance: item.redaction_compliance,
        semantic_aggregate_status: item.semantic_scorecard.aggregate_status,
        audit_markers: item.deviation_summary,
      })),
      shadow_results: result.shadow_results.map((item) => ({
        fixture_id: item.fixture_id,
        shadow_attempted: item.shadow_attempted,
        shadow_provider_observed: item.shadow_provider_observed,
        shadow_skipped_reason: item.shadow_skipped_reason,
        validation_status: item.validation_status,
        governance_status: item.governance_status,
        redaction_compliance: item.redaction_compliance,
        semantic_aggregate_status: item.semantic_scorecard.aggregate_status,
        audit_markers: item.audit_markers,
        token_usage: item.token_usage,
        cost_estimate: item.cost_estimate,
        latency_ms: item.latency_ms,
        provider_request_id_present: item.provider_request_id_present,
      })),
    }, null, 2));
  } finally {
    close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Model gateway shadow evaluation failed.";
  console.error(JSON.stringify({ error: message }, null, 2));
  process.exit(1);
});
