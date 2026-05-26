# Stage Model (Preparation Draft)

## Pipeline
1. Context Assembly
2. Draft Generation
3. SEO Logic Pass
4. Refinement Pass
5. Evaluation + Scoring
6. Delivery Packaging

## Stage Contracts (High-Level)
- Input contracts are explicit and versioned.
- Output from each stage must be machine-validated before passing forward.
- Every stage emits trace metadata for auditability.

## Control Plane Expectations
- Sync mode for rapid drafts.
- Async mode for heavier runs and batch campaigns.
- Deterministic retry behavior for failed stages.
