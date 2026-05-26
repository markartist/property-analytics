import type { ExpertLaneContract, ExpertLaneId } from "./types";

const commonSections = [
  "specialist_summary",
  "adjustment_point",
  "evidence_used",
  "findings",
  "recommendations",
  "proof_metrics",
  "do_not_do_rules",
  "confidence",
  "freshness",
  "conflicts",
  "escalation_recommendation",
  "publishability_assessment",
];

const commonBlocked = [
  "canonical_fact_mutation",
  "memory_promotion",
  "final_artifact_publication",
  "external_message_without_fleet_scribe",
  "unsupported_publishable_claim",
];

export const EXPERT_LANE_CONTRACTS: Record<ExpertLaneId, ExpertLaneContract> = {
  quartermaster: contract("quartermaster", "Quartermaster", "Source confidence, freshness, conflicts, and publication readiness", ["source caveats", "blocked lanes", "conflict path"], ["Data Pond", "source freshness", "directive runtime snapshot"], ["source_integrity_bypass", "stale_source_as_current"]),
  navigator: contract("navigator", "Navigator", "Website, copy, metadata, GBP, and local content action quality", ["content/copy/metadata/GBP action", "evidence reason", "proof source"], ["DataForSEO", "website evidence", "GBP", "competitor market evidence"], ["unverified_local_claim_as_public_copy", "invented_usp"]),
  revenue_advisor: contract("revenue_advisor", "Revenue Advisor", "Exposure, pricing, concessions, value, and recovery math", ["exposure/value read", "pricing/concession posture", "recovery math", "proof metric"], ["operating metrics", "availability", "pricing", "competitor market evidence"], ["pricing_without_exposure_evidence", "spend_or_concession_without_value_context"]),
  signals_officer: contract("signals_officer", "Signals Officer", "Channel quality, spend posture, and source-by-source action", ["source-by-source action", "budget posture", "channel quality", "do-not-scale gate"], ["spend workbook", "source performance", "downstream funnel output"], ["defend_spend_without_output", "scale_without_downstream_proof"]),
  market_scout: contract("market_scout", "Market Scout", "Competitor rent, specials, USP, and visible market pressure", ["market pressure", "competitor advantage", "value risk"], ["competitor market evidence", "subject rent", "subject special"], ["competitor_claim_without_source"]),
  product_readiness_officer: contract("product_readiness_officer", "Product Readiness Officer", "Available product, readiness, unit mix, and operational blockers", ["readiness read", "primary recovery lane", "blocker list", "proof metric"], ["unit feed", "availability", "make-ready", "floorplan pressure"], ["readiness_claim_without_unit_feed"]),
  reputation_officer: contract("reputation_officer", "Reputation Officer", "Review voice, sentiment, complaint themes, and reputation proof/risk", ["trust read", "theme risk", "review proof"], ["GBP reviews", "Reputation.com", "sentiment rows"], ["generic_reputation_copy_without_current_voice"]),
  resident_experience_officer: contract("resident_experience_officer", "Resident Experience Officer", "Resident friction, service pressure, tickets, and experience blockers", ["resident friction", "service blocker", "closure proof"], ["SmartDesk", "tickets", "reviews", "resident issues"], ["resident_issue_as_fact_without_service_evidence"]),
  engineer: contract("engineer", "Engineer", "Website technical health, PSI/CWV, broken paths, and technical blockers", ["technical blocker", "conversion risk", "validation path"], ["PSI", "CWV", "GSC", "site checks"], ["technical_claim_without_test_evidence"]),
  seasonality_demand_timing_advisor: contract("seasonality_demand_timing_advisor", "Seasonality And Demand Timing Advisor", "Demand timing, seasonality, and market timing risk", ["timing read", "seasonality risk", "timing action"], ["T30/T90 funnel", "historical demand", "calendar timing"], ["seasonality_claim_without_history"]),
  unit_type_fit_advisor: contract("unit_type_fit_advisor", "Unit-Type Fit Advisor", "Demand-to-available-unit fit by bedroom/floorplan", ["unit-type demand match", "mismatch risk", "floorplan action"], ["guest cards by unit type", "available units", "PQ by unit type"], ["generic_inventory_read_when_unit_mix_is_known"]),
  market_elasticity_advisor: contract("market_elasticity_advisor", "Market Elasticity Advisor", "Sensitivity of demand to rent, concession, value copy, and comp pressure", ["elasticity read", "pricing pressure", "test condition"], ["rent history", "competitor market evidence", "demand trend"], ["elasticity_claim_without_market_or_trend_evidence"]),
  operational_capacity_advisor: contract("operational_capacity_advisor", "Operational Capacity Advisor", "Team capacity, follow-up, service load, and execution feasibility", ["capacity read", "execution risk", "support ask"], ["actions", "tickets", "follow-up", "staffing/context notes"], ["action_plan_without_capacity_check"]),
  trust_and_proof_advisor: contract("trust_and_proof_advisor", "Trust And Proof Advisor", "Credible claims, proof gaps, USP risk, and message integrity", ["credible claims", "proof gaps", "message risk"], ["reviews", "website evidence", "competitor evidence", "Data Pond facts"], ["unsupported_usp", "claim_without_proof"]),
  peer_borrowing_advisor: contract("peer_borrowing_advisor", "Peer Borrowing Advisor", "Borrowable peer tactics across region and portfolio families", ["peer tactic", "peer relevance", "proof of fit"], ["regional comparisons", "peer property memory", "Commodore review"], ["borrow_peer_tactic_without_comparable_conditions"]),
  leasing_performance_advisor: contract("leasing_performance_advisor", "Leasing Performance Advisor", "Funnel leakage, conversion, follow-up, and leasing execution", ["funnel leak", "conversion action", "proof metric"], ["T30/T90 funnel", "source performance", "closing ratio", "applications/PQ"], ["lead_volume_answer_when_conversion_gap_is_primary"]),
};

export function getExpertLaneContract(laneId: ExpertLaneId): ExpertLaneContract {
  const contract = EXPERT_LANE_CONTRACTS[laneId];
  if (!contract) throw new Error(`Unknown Expert Read lane: ${laneId}`);
  return contract;
}

export function isExpertLaneId(value: string): value is ExpertLaneId {
  return value in EXPERT_LANE_CONTRACTS;
}

function contract(
  lane_id: ExpertLaneId,
  display_name: string,
  adjustment_point: string,
  additionalSections: string[],
  required_evidence_sources: string[],
  blocked_patterns: string[]
): ExpertLaneContract {
  return {
    lane_id,
    display_name,
    adjustment_point,
    required_output_sections: Array.from(new Set([...commonSections, ...additionalSections])),
    required_evidence_sources,
    blocked_patterns: Array.from(new Set([...commonBlocked, ...blocked_patterns])),
    default_do_not_do_rules: [
      "Do not mutate Data Pond facts.",
      "Do not promote memory.",
      "Do not publish artifacts.",
      "Do not turn unsupported claims into publishable recommendations.",
      "Do not bypass Fleet Scribe or Quartermaster controls.",
    ],
  };
}
