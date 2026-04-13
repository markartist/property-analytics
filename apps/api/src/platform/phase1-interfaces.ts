export type ScopeType = "property" | "cohort" | "portfolio" | "global" | "system";
export type DomainTrustPosture = "trusted" | "stale" | "degraded" | "unavailable";
export type FreshnessPosture = "fresh" | "aging" | "stale" | "expired" | "unknown";
export type ValidationPosture =
  | "validated"
  | "validation_pending"
  | "validation_failed"
  | "validation_blocked"
  | "unknown";
export type MirrorPosture =
  | "active"
  | "lagging"
  | "mirroring"
  | "mirror_failed"
  | "reconciliation_failed"
  | "activation_blocked"
  | "unknown";
export type ActiveBatchPosture = "current" | "lagging" | "missing" | "blocked" | "unknown";
export type ContractPosture = "matched" | "mismatch" | "unsupported" | "unknown";
export type CompatibilityPosture = "compatible" | "mismatch" | "unsupported" | "blocked";
export type BindingStatus = "usable" | "degraded" | "stale" | "excluded" | "unavailable";
export type PromotionMode = "auto" | "review_required" | "hold";

export interface ScopeFields {
  scopeType: ScopeType;
  propertyId?: string | null;
  cohortKey?: string | null;
  portfolioScopeKey?: string | null;
}

export interface ServiceError {
  code:
    | "VALIDATION_ERROR"
    | "POLICY_VIOLATION"
    | "CONTRACT_MISMATCH"
    | "NOT_FOUND"
    | "BLOCKED"
    | "CONSISTENCY_MISMATCH"
    | "DEDUPE_SUPPRESSED"
    | "COOLDOWN_ACTIVE"
    | "INTERNAL_ERROR";
  message: string;
  details?: Record<string, unknown>;
}

export interface MirrorIntakeInput {
  domainKey: string;
  mirrorBatchId: string;
  sourceValidationBatchId: string;
  sourceSnapshotId: string;
  contractBundleId: string;
  schemaBundleVersion: string;
  validatorBundleVersion: string;
  mirrorBundleVersion: string;
  payloadContractVersion: string;
  batchDateStart: string;
  batchDateEnd: string;
  rowCountTotalExpected: number;
  checksumManifest: string;
  payloadSlices: Array<{
    mirrorBatchSliceId: string;
    targetTable: string;
    sliceKey: string;
    rowCountExpected: number;
    sliceChecksumExpected: string;
    recordsJson: string;
  }>;
  sourceHost: string;
  operatorId?: string | null;
}

export interface MirrorIntakeOutput {
  mirrorBatchId: string;
  domainKey: string;
  status: "prepared" | "mirroring" | "mirrored" | "failed";
  persistedSliceCount: number;
  contractBundleId: string;
}

export interface MirrorReconciliationInput {
  domainKey: string;
  mirrorBatchId: string;
  reconciledBy: string;
  reconciliationReason: string;
}

export interface MirrorReconciliationOutput {
  mirrorBatchId: string;
  domainKey: string;
  status: "reconciled" | "quarantined";
  reconciledAt?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}

export interface ActivationInput {
  domainKey: string;
  mirrorBatchId: string;
  activationReason: string;
  activatedBy: string;
}

export interface ActivationOutput {
  domainKey: string;
  mirrorBatchId: string;
  previousMirrorBatchId?: string | null;
  activeAt: string;
}

export interface PipelineHealthBuildInput {
  domainKey: string;
  contractBundleId: string;
  forceRebuild?: boolean;
}

export interface PipelineHealthBuildOutput {
  pipelineHealthSnapshotId: string;
  domainKey: string;
  activeMirrorBatchId?: string | null;
  domainTrustPosture: DomainTrustPosture;
  freshnessPosture: FreshnessPosture;
  validationPosture: ValidationPosture;
  mirrorPosture: MirrorPosture;
  activeBatchPosture: ActiveBatchPosture;
  contractPosture: ContractPosture;
}

export interface ExecutionSnapshotBuildInput extends ScopeFields {
  executionIntent: string;
  executionConsumerType: string;
  executionConsumerId: string;
  triggerType: string;
  triggerSource: string;
  triggerReferenceId?: string | null;
  requestedContractBundleId?: string | null;
  policyId: string;
  createdBy: string;
  operatorId?: string | null;
  requestedBy?: string | null;
}

export interface ExecutionSnapshotBuildOutput {
  executionSnapshotId: string;
  contractBundleId: string;
  bindingInputHash: string;
  pipelineHealthSnapshotSetHash: string;
  domainBindingCount: number;
  bindings: Array<{
    domainKey: string;
    activeMirrorBatchId: string;
    pipelineHealthSnapshotId: string;
    bindingStatus: BindingStatus;
  }>;
}

export interface ResolveContractBundleInput {
  contextType: "mirror_intake" | "snapshot_creation" | "agent_runtime" | "lifecycle_promotion" | "artifact_generation";
  requestedContractBundleId?: string | null;
  requestedBundleAlias?: string | null;
  contextObjectType: string;
  contextObjectId: string;
}

export interface ResolveContractBundleOutput {
  requestedContractBundleId?: string | null;
  resolvedContractBundleId: string;
  compatibilityPosture: CompatibilityPosture;
}

export interface AgentRuntimeStartInput extends ScopeFields {
  agentId: string;
  executionSnapshotId: string;
  triggerType: string;
}

export interface AgentRuntimeStartOutput {
  agentRuntimeBindingId: string;
  agentId: string;
  agentContractId: string;
  executionSnapshotId: string;
  contractBundleId: string;
}

export interface LifecycleEmissionInput extends ScopeFields {
  objectType: "watch_state" | "escalation_candidate";
  issueFamilyKey: string;
  severity: string;
  confidence: number;
  reason: string;
  sourceType: string;
  sourceActorId: string;
  executionSnapshotId: string;
  contractBundleId: string;
  agentContractId?: string | null;
  promotionMode?: PromotionMode;
  firstObservedAt: string;
  lastObservedAt: string;
  dedupeContext: {
    normalizedReasonCodes: string[];
    normalizedSeverityBucket: string;
  };
}

export interface LifecycleEmissionOutput {
  objectType: "watch_state" | "escalation_candidate";
  objectId: string;
  status:
    | "open"
    | "under_review"
    | "held"
    | "suppressed"
    | "promoted"
    | "rejected"
    | "closed"
    | "expired";
  dedupeKey: string;
  suppressionReason?: string | null;
}

export interface ScopeValidationResult {
  valid: boolean;
  normalized: ScopeFields;
  error?: ServiceError;
}

export interface DedupeSignatureInput extends ScopeFields {
  objectType: "watch_state" | "escalation_candidate" | "issue";
  issueFamilyKey: string;
  normalizedSeverityBucket: string;
  normalizedReasonCodes?: string[];
}

export interface ProvenanceEnvelopeInput {
  objectType: string;
  objectId: string;
  contractBundleId: string;
  sourceBatchIds: string[];
  executionSnapshotId?: string | null;
  agentContractId?: string | null;
  agentId?: string | null;
  pipelineHealthSnapshotIds: string[];
  upstreamObjectRefs: Array<{ objectType: string; objectId: string }>;
  createdByType: string;
  createdById: string;
  metadata?: Record<string, unknown>;
  artifactUri?: string | null;
}

export interface ProvenanceEnvelopeOutput {
  provenanceEnvelopeId: string;
  objectType: string;
  objectId: string;
}

export interface ExecutionSnapshotHashInput extends ScopeFields {
  contractBundleId: string;
  executionIntent: string;
  triggerType: string;
  triggerReferenceId?: string | null;
  snapshotTime: string;
  bindings: Array<{
    domainKey: string;
    activeMirrorBatchId: string;
    pipelineHealthSnapshotId: string;
  }>;
}

export interface MemoryConsumptionCheckInput {
  consumerType: string;
  consumerId: string;
  memoryPatternId: string;
  allowedConsumptionClass: "reference_only" | "decision_support" | "operational_default";
  attemptedConsumptionClass: "reference_only" | "decision_support" | "operational_default";
}

export interface MemoryConsumptionCheckOutput {
  allowed: boolean;
  violationCode?: "MEMORY_CONSUMPTION_BLOCKED";
}

export interface IssueFamilyScopeValidationInput extends ScopeFields {
  issueFamilyKey: string;
}

export interface IssueFamilyScopeValidationOutput {
  valid: boolean;
  defaultPromotionMode?: PromotionMode;
  error?: ServiceError;
}

export interface ContractBundleResolver {
  resolve(input: ResolveContractBundleInput): Promise<ResolveContractBundleOutput>;
}

export interface MirrorIntakeService {
  ingest(input: MirrorIntakeInput): Promise<MirrorIntakeOutput>;
}

export interface ActivationService {
  activate(input: ActivationInput): Promise<ActivationOutput>;
}

export interface MirrorReconciliationService {
  reconcile(input: MirrorReconciliationInput): Promise<MirrorReconciliationOutput>;
}

export interface PipelineHealthBuilder {
  build(input: PipelineHealthBuildInput): Promise<PipelineHealthBuildOutput>;
}

export interface ExecutionSnapshotBuilder {
  create(input: ExecutionSnapshotBuildInput): Promise<ExecutionSnapshotBuildOutput>;
}

export interface AgentRuntimeGateway {
  start(input: AgentRuntimeStartInput): Promise<AgentRuntimeStartOutput>;
}

export interface LifecycleEngine {
  emit(input: LifecycleEmissionInput): Promise<LifecycleEmissionOutput>;
}

export interface ScopeValidator {
  validate(input: ScopeFields, opts?: { allowPropertyCohortContext?: boolean }): ScopeValidationResult;
}

export interface DedupeSignatureGenerator {
  generate(input: DedupeSignatureInput): string;
}

export interface ProvenanceBuilder {
  build(input: ProvenanceEnvelopeInput): Promise<ProvenanceEnvelopeOutput>;
}

export interface ExecutionSnapshotHashCalculator {
  calculate(input: ExecutionSnapshotHashInput): string;
}

export interface MemoryConsumptionChecker {
  check(input: MemoryConsumptionCheckInput): MemoryConsumptionCheckOutput;
}

export interface IssueFamilyRegistryValidator {
  validate(input: IssueFamilyScopeValidationInput): Promise<IssueFamilyScopeValidationOutput>;
}
