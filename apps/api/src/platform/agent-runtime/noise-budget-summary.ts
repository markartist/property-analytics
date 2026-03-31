import { AppError } from "../../lib/validate";
import {
  getAgentContract,
  getAgentIdentity,
  getNoiseBudgetPolicy,
  listNoiseBudgetUsageSummary,
} from "./repository";

function utcDayWindow(day: string): { start: string; end: string } {
  const start = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    throw new AppError(400, "VALIDATION_ERROR", "Noise-budget summary day must be YYYY-MM-DD");
  }
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export interface NoiseBudgetSummaryInput {
  agentId: string;
  day?: string | null;
}

export interface NoiseBudgetSummaryOutput {
  agentId: string;
  agentContractId: string;
  noiseBudgetPolicyId: string;
  day: string;
  usage: {
    watchStates: {
      total: number;
      suppressed: number;
      remaining: number;
      limit: number;
    };
    escalationCandidates: {
      total: number;
      suppressed: number;
      remaining: number;
      limit: number;
    };
    escalationCandidatesByIssueFamily: Array<{
      issueFamilyKey: string;
      total: number;
      suppressed: number;
      remaining: number;
      limit: number;
    }>;
  };
}

export function createNoiseBudgetSummaryService(db: D1Database) {
  return {
    async getSummary(input: NoiseBudgetSummaryInput): Promise<NoiseBudgetSummaryOutput> {
      const agent = await getAgentIdentity(db, input.agentId);
      if (!agent) {
        throw new AppError(404, "NOT_FOUND", "Agent not found for noise-budget summary");
      }

      const contract = await getAgentContract(db, agent.agent_contract_id);
      if (!contract) {
        throw new AppError(404, "NOT_FOUND", "Agent contract not found for noise-budget summary");
      }

      const policy = await getNoiseBudgetPolicy(db, contract.noise_budget_policy_id);
      if (!policy) {
        throw new AppError(400, "BLOCKED", "Noise-budget policy not found for agent contract");
      }

      const day = input.day ?? new Date().toISOString().slice(0, 10);
      const { start, end } = utcDayWindow(day);
      const rows = await listNoiseBudgetUsageSummary(db, {
        agentId: input.agentId,
        dayStartIso: start,
        dayEndIso: end,
      });

      let watchTotal = 0;
      let watchSuppressed = 0;
      let escalationTotal = 0;
      let escalationSuppressed = 0;
      const byIssueFamily = new Map<string, { total: number; suppressed: number }>();

      for (const row of rows) {
        const count = Number(row.count ?? 0);
        if (row.object_type === "watch_state") {
          watchTotal += count;
          if (row.status === "suppressed") {
            watchSuppressed += count;
          }
          continue;
        }

        escalationTotal += count;
        if (row.status === "suppressed") {
          escalationSuppressed += count;
        }
        const issueFamilyKey = row.issue_family_key ?? "unknown";
        const existing = byIssueFamily.get(issueFamilyKey) ?? { total: 0, suppressed: 0 };
        existing.total += count;
        if (row.status === "suppressed") {
          existing.suppressed += count;
        }
        byIssueFamily.set(issueFamilyKey, existing);
      }

      return {
        agentId: input.agentId,
        agentContractId: contract.agent_contract_id,
        noiseBudgetPolicyId: policy.noise_budget_policy_id,
        day,
        usage: {
          watchStates: {
            total: watchTotal,
            suppressed: watchSuppressed,
            remaining: Math.max(0, policy.max_watch_states_per_day - watchTotal),
            limit: policy.max_watch_states_per_day,
          },
          escalationCandidates: {
            total: escalationTotal,
            suppressed: escalationSuppressed,
            remaining: Math.max(0, policy.max_escalation_candidates_per_day - escalationTotal),
            limit: policy.max_escalation_candidates_per_day,
          },
          escalationCandidatesByIssueFamily: [...byIssueFamily.entries()]
            .map(([issueFamilyKey, stats]) => ({
              issueFamilyKey,
              total: stats.total,
              suppressed: stats.suppressed,
              remaining: Math.max(
                0,
                policy.max_escalation_candidates_per_issue_family_per_day - stats.total
              ),
              limit: policy.max_escalation_candidates_per_issue_family_per_day,
            }))
            .sort((a, b) => a.issueFamilyKey.localeCompare(b.issueFamilyKey)),
        },
      };
    },
  };
}
