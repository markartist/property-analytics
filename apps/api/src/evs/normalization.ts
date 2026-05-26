import {
  EvsNormalizedResult,
  type EvsCheckResult,
  type EvsDeviceResult,
  type EvsRawDeviceExecution,
  type EvsNormalizationInput,
} from "../../../../packages/shared/src";
import { newId } from "../lib/id";

function categorizeFinding(kind: string): EvsCheckResult["category"] {
  if (kind.includes("portfolio_qa:toggle") || kind.includes("portfolio_qa:expanding")) return "button";
  if (kind.includes("portfolio_qa:route")) return "navigation";
  if (kind.includes("portfolio_qa:external_handoff")) return "conversion_path";
  if (kind.includes("portfolio_qa:carousel")) return "carousel";
  if (kind.includes("portfolio_qa:filter") || kind.includes("portfolio_qa:sort")) return "form_entry";
  if (kind.includes("portfolio_qa:map")) return "rendering";
  if (kind.includes("nav")) return "navigation";
  if (kind.includes("carousel")) return "carousel";
  if (kind.includes("video")) return "video";
  if (kind.includes("tour")) return "tour";
  if (kind.includes("form")) return "form_entry";
  if (kind.includes("button")) return "button";
  if (kind.includes("link")) return "link";
  if (kind.includes("javascript")) return "javascript";
  return "conversion_path";
}

function severityFromStatus(status: EvsCheckResult["status"]): EvsCheckResult["severity"] {
  switch (status) {
    case "fail":
      return "high";
    case "warn":
      return "medium";
    case "skipped":
      return "low";
    default:
      return "info";
  }
}

export function normalizeExecutionResult(input: EvsNormalizationInput) {
  const { request, raw } = input;
  const deviceResults: EvsDeviceResult[] = raw.device_runs.map((deviceRun: EvsRawDeviceExecution) => {
    const checkResults: EvsCheckResult[] = [];

    if (deviceRun.fatal_error) {
      checkResults.push({
        check_id: `${deviceRun.device_profile}-fatal-error`,
        label: "Fatal runtime failure",
        category: "javascript",
        status: "fail",
        severity: "critical",
        message: deviceRun.fatal_error,
        evidence_refs: deviceRun.evidence_refs,
        metadata: {},
      });
    }

    for (const finding of deviceRun.findings) {
      checkResults.push({
        check_id: finding.check_id ?? `${deviceRun.device_profile}-${finding.kind}-${checkResults.length + 1}`,
        label: finding.label,
        category: categorizeFinding(finding.kind),
        status: finding.status,
        severity: severityFromStatus(finding.status),
        message: finding.message,
        target_label: finding.label,
        target_url: finding.href,
        selector_hint: finding.selector_hint,
        evidence_refs: finding.evidence_refs,
        metadata: finding.metadata,
      });
    }

    const status = checkResults.some((check) => check.status === "fail") ? "fail" : "pass";

    return {
      device_profile: deviceRun.device_profile,
      status,
      summary: `${checkResults.length} experiential checks on ${deviceRun.device_profile}`,
      provider: deviceRun.provider,
      duration_ms: deviceRun.duration_ms,
      check_results: checkResults,
      evidence_refs: deviceRun.evidence_refs,
      provider_session_id: deviceRun.provider_session_id,
      provider_job_url: deviceRun.provider_job_url,
    };
  });

  const allChecks = deviceResults.flatMap((deviceResult) => deviceResult.check_results);
  const hasFailure = allChecks.some((check) => check.status === "fail");
  const hasWarning = allChecks.some((check) => check.status === "warn");
  const severity = hasFailure
    ? allChecks.some((check) => check.severity === "critical")
      ? "critical"
      : "high"
    : hasWarning
      ? "medium"
      : "info";
  const status = hasFailure ? "fail" : "pass";
  const summary = hasFailure
    ? `Experiential validation found ${allChecks.filter((check) => check.status === "fail").length} failing checks.`
    : `Experiential validation passed across ${deviceResults.length} device profiles.`;

  const result = {
    result_id: newId(),
    request_id: request.request_id,
    status,
    summary,
    profile: raw.profile,
    environment: request.environment,
    device_results: deviceResults,
    check_results: allChecks,
    evidence_refs: deviceResults.flatMap((deviceResult) => deviceResult.evidence_refs),
    governance_mapping: request.governance_context,
    severity,
    business_impact: hasFailure
      ? "Potential user experience regressions are present on the staging experience."
      : "No blocking user experience regressions were detected in the experiential sweep.",
    recommended_action: hasFailure
      ? "Review failed checks, inspect linked evidence, and resolve the staging regressions before promoting."
      : "Proceed with deeper target-specific validation or release readiness review.",
  };

  return EvsNormalizedResult.parse(result);
}
