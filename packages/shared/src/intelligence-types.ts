export interface IntelligenceClaim {
  id: string;
  property_id: string | null;
  cohort_key: string | null;
  claim_text: string;
  source: "intelligence_office" | "derived" | "migration" | "other";
  confidence: number;
  applicable_scope: "property" | "cohort" | "global";
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface IntelligenceEvidence {
  id: string;
  evidence_type: string;
  source_system: string;
  reference: string;
  summary: string;
  timestamp: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface IntelligenceClaimEvidence {
  id: string;
  claim_id: string;
  evidence_id: string;
  created_at: string;
}

export interface BriefReadiness {
  property_id: string;
  completeness_score: number;
  completeness_status: "incomplete" | "partial" | "ready";
  missing_components: string[];
  captain_log_count: number;
  claim_count: number;
  evidence_count: number;
  confidence: number | null;
  last_updated_at: string | null;
  migration_candidates: string[];
}
