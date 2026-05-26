import { canonicalJson, sha256Hex } from "../directives/hashing";
import type { ModelGatewayPayload, PayloadRedactionResult } from "./types";

const REDACT_KEYS = [
  /(^|[_-])token$/i,
  /(^|[_-])secret$/i,
  /password/i,
  /api[_-]?key/i,
  /auth[_-]?token/i,
  /authorization/i,
  /credential/i,
];
const REMOVE_KEYS = [/raw_prompt/i, /raw_payload/i, /self_note/i, /private_note/i, /relationship_context/i, /care_metadata/i, /raw_sibling_detail/i];

export class SensitivityClassifier {
  classify(value: unknown, path = ""): string[] {
    if (!value || typeof value !== "object") {
      if (typeof value === "string" && value.length > 600) return [path ? `${path}:long_string` : "root:long_string"];
      return [];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => this.classify(item, `${path}[${index}]`));
    }
    return Object.entries(value as Record<string, unknown>).flatMap(([key, next]) => {
      const nextPath = path ? `${path}.${key}` : key;
      const tags: string[] = [];
      if (REDACT_KEYS.some((pattern) => pattern.test(key))) tags.push(`${nextPath}:secret_like`);
      if (REMOVE_KEYS.some((pattern) => pattern.test(key))) tags.push(`${nextPath}:restricted_context`);
      return [...tags, ...this.classify(next, nextPath)];
    });
  }
}

export class AllowedUseFilter {
  apply(value: unknown): { value: unknown; blockedMemoryRefs: string[] } {
    const blockedMemoryRefs: string[] = [];
    const filtered = visit(value, (path, current) => {
      if (!current || typeof current !== "object" || Array.isArray(current)) return current;
      const record = current as Record<string, unknown>;
      if (Array.isArray(record.allowed_uses) && Array.isArray(record.blocked_uses)) {
        const allowed = record.allowed_uses.map(String);
        const blocked = record.blocked_uses.map(String);
        if (!allowed.includes("captain_reasoning") && !allowed.includes("expert_read_context")) {
          if (typeof record.memory_id === "string") blockedMemoryRefs.push(record.memory_id);
          return undefined;
        }
        if (blocked.includes("captain_reasoning") && blocked.includes("expert_read_context")) {
          if (typeof record.memory_id === "string") blockedMemoryRefs.push(record.memory_id);
          return undefined;
        }
      }
      if (record.memory_class === "agent_self_note" && record.evidence_id) {
        blockedMemoryRefs.push(String(record.evidence_id));
        return undefined;
      }
      if (record.memory_class === "relationship_context") {
        if (typeof record.memory_id === "string") blockedMemoryRefs.push(record.memory_id);
        return undefined;
      }
      if (record.sensitive_context === true || record.visibility === "private" || record.visibility === "restricted") {
        if (typeof record.memory_id === "string") blockedMemoryRefs.push(record.memory_id);
        return undefined;
      }
      if (record.share_as_pattern_only === true && record.raw_detail) {
        const { raw_detail: _rawDetail, ...patternOnly } = record;
        return patternOnly;
      }
      return current;
    });
    return { value: filtered, blockedMemoryRefs };
  }
}

export class PayloadMinimizer {
  constructor(private readonly maxStringLength = 400, private readonly maxArrayItems = 12, private readonly maxDepth = 5) {}

  minimize(value: unknown, depth = 0): unknown {
    if (depth > this.maxDepth) return "[depth-trimmed]";
    if (typeof value === "string") return value.length > this.maxStringLength ? `${value.slice(0, this.maxStringLength)}…` : value;
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.slice(0, this.maxArrayItems).map((item) => this.minimize(item, depth + 1));
    const output: Record<string, unknown> = {};
    for (const [key, next] of Object.entries(value as Record<string, unknown>)) {
      if (REMOVE_KEYS.some((pattern) => pattern.test(key))) continue;
      output[key] = this.minimize(next, depth + 1);
    }
    return output;
  }
}

export class PayloadRedactor {
  redact(value: unknown, path = "", removedPaths: string[] = [], redactedPaths: string[] = []): { value: unknown; removedPaths: string[]; redactedPaths: string[] } {
    if (!value || typeof value !== "object") {
      if (typeof value === "string" && REDACT_KEYS.some((pattern) => pattern.test(path))) {
        redactedPaths.push(path || "root");
        return { value: "[redacted]", removedPaths, redactedPaths };
      }
      return { value, removedPaths, redactedPaths };
    }
    if (Array.isArray(value)) {
      const next = value.map((item, index) => this.redact(item, `${path}[${index}]`, removedPaths, redactedPaths).value).filter((item) => item !== undefined);
      return { value: next, removedPaths, redactedPaths };
    }
    const output: Record<string, unknown> = {};
    for (const [key, next] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (REMOVE_KEYS.some((pattern) => pattern.test(key))) {
        removedPaths.push(nextPath);
        continue;
      }
      if (REDACT_KEYS.some((pattern) => pattern.test(key))) {
        redactedPaths.push(nextPath);
        output[key] = "[redacted]";
        continue;
      }
      output[key] = this.redact(next, nextPath, removedPaths, redactedPaths).value;
    }
    return { value: output, removedPaths, redactedPaths };
  }
}

export class PayloadHashBuilder {
  async build(value: unknown): Promise<string> {
    return sha256Hex(value);
  }
}

export async function minimizeAndRedactPayload(payload: ModelGatewayPayload): Promise<PayloadRedactionResult> {
  const allowedUseFilter = new AllowedUseFilter();
  const minimizer = new PayloadMinimizer();
  const redactor = new PayloadRedactor();
  const classifier = new SensitivityClassifier();
  const filtered = allowedUseFilter.apply(payload);
  const minimized = minimizer.minimize(filtered.value) as ModelGatewayPayload;
  const redacted = redactor.redact(minimized);
  const redactedPayload = withRequiredPayloadBuckets(redacted.value as Partial<ModelGatewayPayload>);
  const estimatedTokens = estimateTokenCount(redactedPayload);
  const rebuilt: ModelGatewayPayload = {
    ...redactedPayload,
    estimated_tokens: estimatedTokens,
    redaction_summary: {
      removed_paths: redacted.removedPaths,
      redacted_paths: redacted.redactedPaths,
      blocked_memory_refs: filtered.blockedMemoryRefs,
      sensitivity_flags: classifier.classify(payload),
      estimated_input_tokens: estimatedTokens,
    },
    payload_hash: await sha256Hex(redactedPayload),
  };
  return {
    redactedPayload: rebuilt,
    redactedPayloadHash: await sha256Hex(canonicalJson(rebuilt)),
    summary: rebuilt.redaction_summary as PayloadRedactionResult["summary"],
  };
}

function withRequiredPayloadBuckets(payload: Partial<ModelGatewayPayload>): ModelGatewayPayload {
  return {
    payload_id: payload.payload_id ?? "redacted_payload",
    request_id: payload.request_id ?? "redacted_request",
    system_instructions: Array.isArray(payload.system_instructions) ? payload.system_instructions : [],
    runtime_context: isRecord(payload.runtime_context) ? payload.runtime_context : {},
    evidence_summary: isRecord(payload.evidence_summary) ? payload.evidence_summary : {},
    awareness_summary: isRecord(payload.awareness_summary) ? payload.awareness_summary : {},
    directive_summary: isRecord(payload.directive_summary) ? payload.directive_summary : {},
    output_schema: isRecord(payload.output_schema) ? payload.output_schema : {},
    redaction_summary: isRecord(payload.redaction_summary) ? payload.redaction_summary : {},
    payload_hash: payload.payload_hash,
    estimated_tokens: payload.estimated_tokens,
    created_at: payload.created_at ?? new Date().toISOString(),
  } as ModelGatewayPayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function estimateTokenCount(value: unknown): number {
  const text = canonicalJson(value);
  return Math.max(1, Math.ceil(text.length / 4));
}

function visit(value: unknown, fn: (path: string, current: unknown) => unknown, path = ""): unknown {
  const transformed = fn(path, value);
  if (transformed === undefined) return undefined;
  if (!transformed || typeof transformed !== "object") return transformed;
  if (Array.isArray(transformed)) {
    return transformed.map((item, index) => visit(item, fn, `${path}[${index}]`)).filter((item) => item !== undefined);
  }
  const output: Record<string, unknown> = {};
  for (const [key, next] of Object.entries(transformed as Record<string, unknown>)) {
    const visited = visit(next, fn, path ? `${path}.${key}` : key);
    if (visited !== undefined) output[key] = visited;
  }
  return output;
}
