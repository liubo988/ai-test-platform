import type { IntentE2EFailureTriage } from '@/lib/ai/intent-e2e-failure-triage';
import type { IntentE2EAssetReadiness } from '@/lib/intent-e2e-asset-readiness';

export type IntentE2ERepairBudgetReasonCode =
  | 'runtime_limit'
  | 'asset_missing'
  | 'knowledge_no_hit'
  | 'auth_blocked'
  | 'auth_state_invalid'
  | 'permission_blocked'
  | 'env_blocked'
  | 'data_blocked'
  | 'fixture_contract_missing'
  | 'response_missing'
  | 'record_lookup_miss'
  | 'target_row_not_found'
  | 'workflow_gap'
  | 'runtime_syntax_damage'
  | 'repair_non_progress'
  | 'unknown'
  | 'ui_anchor_missing'
  | 'repair_stagnated';

export interface IntentE2ERepairBudget {
  configuredRepairLimit: number;
  maxRepairAttempts: number;
  usedRepairAttempts: number;
  remainingRepairAttempts: number;
  exhausted: boolean;
  reasonCode: IntentE2ERepairBudgetReasonCode;
  stopReason: string;
  summary: string;
}

interface ResolveIntentE2ERepairBudgetInput {
  runtimeSelfHealRetries?: number | null;
  usedRepairAttempts?: number | null;
  assetReadiness?: Pick<IntentE2EAssetReadiness, 'status'> | null;
  triage?: Pick<IntentE2EFailureTriage, 'failureClass' | 'repairable'> | null;
}

function clampCount(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.floor(value));
}

function describeRemainingBudget(maxRepairAttempts: number, usedRepairAttempts: number): string {
  const remainingRepairAttempts = Math.max(0, maxRepairAttempts - usedRepairAttempts);
  if (maxRepairAttempts <= 0) return '当前不会继续进入自动修复。';
  if (remainingRepairAttempts <= 0) return `已达到 ${maxRepairAttempts} 次自动修复上限。`;
  return `当前还可继续 ${remainingRepairAttempts} 次自动修复。`;
}

function describeBudgetSummary(input: {
  reasonCode: IntentE2ERepairBudgetReasonCode;
  maxRepairAttempts: number;
  usedRepairAttempts: number;
}): string {
  const { reasonCode, maxRepairAttempts, usedRepairAttempts } = input;
  const budgetTail = describeRemainingBudget(maxRepairAttempts, usedRepairAttempts);

  switch (reasonCode) {
    case 'asset_missing':
      return `当前项目冷启动资产未就绪，repair budget 已收紧。${budgetTail}`;
    case 'knowledge_no_hit':
      return `当前项目知识未命中，建议尽快补项目知识；当前不再额外收紧 repair budget。${budgetTail}`;
    case 'auth_blocked':
      return `当前失败属于认证阻塞，不继续消耗 repair 配额。${budgetTail}`;
    case 'auth_state_invalid':
      return `当前失败属于登录态失效，不继续消耗 repair 配额。${budgetTail}`;
    case 'permission_blocked':
      return `当前失败属于权限阻塞，不继续消耗 repair 配额。${budgetTail}`;
    case 'env_blocked':
      return `当前失败属于环境阻塞，不继续消耗 repair 配额。${budgetTail}`;
    case 'data_blocked':
      return `当前失败属于数据阻塞，不继续消耗 repair 配额。${budgetTail}`;
    case 'fixture_contract_missing':
      return `当前流程缺少 fixture/data contract，不继续消耗 repair 配额。${budgetTail}`;
    case 'response_missing':
      return `当前失败属于结构化响应证据缺失，repair budget 已收紧，避免继续放宽断言。${budgetTail}`;
    case 'record_lookup_miss':
      return `当前失败落在结构化记录回查未命中，repair budget 已收紧，优先补稳定标识链路。${budgetTail}`;
    case 'target_row_not_found':
      return `当前失败落在目标行回查，repair budget 已收紧，避免继续放宽表格断言。${budgetTail}`;
    case 'workflow_gap':
      return `当前失败更像流程缺口，repair budget 已收紧，优先限制修复次数。${budgetTail}`;
    case 'ui_anchor_missing':
      return `当前失败已判定为页面锚点缺失，继续自动修复收益很低。${budgetTail}`;
    case 'runtime_syntax_damage':
      return `当前失败属于运行时代码损坏，不继续消耗 repair 配额。${budgetTail}`;
    case 'repair_non_progress':
      return `当前 repair 已无明显进展，继续自动修复收益很低。${budgetTail}`;
    case 'repair_stagnated':
      return `当前 run 已触发 repair stagnation 早停，继续自动修复收益很低。${budgetTail}`;
    case 'unknown':
      return `当前失败归因为未分类问题，repair budget 已按保守策略收紧。${budgetTail}`;
    case 'runtime_limit':
    default:
      return maxRepairAttempts > 0
        ? `当前 repair budget 受运行配置约束。${budgetTail}`
        : '当前配置未开启自动修复。';
  }
}

export function resolveIntentE2ERepairBudget(input: ResolveIntentE2ERepairBudgetInput): IntentE2ERepairBudget {
  const configuredRepairLimit = clampCount(input.runtimeSelfHealRetries);
  const usedRepairAttempts = clampCount(input.usedRepairAttempts);
  const assetStatus = input.assetReadiness?.status || 'ready';
  const triage = input.triage || null;

  let reasonCode: IntentE2ERepairBudgetReasonCode = 'runtime_limit';
  let stopReason = configuredRepairLimit > 0 ? '按运行配置继续自动修复' : '当前配置未开启自动修复';
  let resolvedCap = configuredRepairLimit;

  if (triage?.failureClass === 'auth_failed') {
    reasonCode = 'auth_blocked';
    stopReason = '认证阻塞';
    resolvedCap = 0;
  } else if (triage?.failureClass === 'auth_state_invalid') {
    reasonCode = 'auth_state_invalid';
    stopReason = '登录态失效';
    resolvedCap = 0;
  } else if (triage?.failureClass === 'permission_blocked') {
    reasonCode = 'permission_blocked';
    stopReason = '权限阻塞';
    resolvedCap = 0;
  } else if (triage?.failureClass === 'env_transient') {
    reasonCode = 'env_blocked';
    stopReason = '环境阻塞';
    resolvedCap = 0;
  } else if (triage?.failureClass === 'data_missing') {
    reasonCode = 'data_blocked';
    stopReason = '数据阻塞';
    resolvedCap = 0;
  } else if (triage?.failureClass === 'fixture_contract_missing') {
    reasonCode = 'fixture_contract_missing';
    stopReason = 'fixture 契约缺口';
    resolvedCap = 0;
  } else if (triage?.failureClass === 'response_missing') {
    reasonCode = 'response_missing';
    stopReason = '结构化响应证据缺失';
    resolvedCap = Math.min(configuredRepairLimit, 1);
  } else if (triage?.failureClass === 'record_lookup_miss') {
    reasonCode = 'record_lookup_miss';
    stopReason = '结构化记录回查未命中';
    resolvedCap = Math.min(configuredRepairLimit, 1);
  } else if (triage?.failureClass === 'ui_anchor_missing') {
    reasonCode = 'ui_anchor_missing';
    stopReason = '页面锚点缺失';
    resolvedCap = 0;
  } else if (triage?.failureClass === 'runtime_syntax_damage') {
    reasonCode = 'runtime_syntax_damage';
    stopReason = '运行时代码损坏';
    resolvedCap = 0;
  } else if (triage?.failureClass === 'repair_non_progress') {
    reasonCode = 'repair_non_progress';
    stopReason = 'repair 无明显进展';
    resolvedCap = 0;
  } else if (triage?.failureClass === 'repair_stagnated') {
    reasonCode = 'repair_stagnated';
    stopReason = '修复停滞';
    resolvedCap = 0;
  } else if (assetStatus === 'asset_missing') {
    reasonCode = 'asset_missing';
    stopReason = '项目资产未就绪';
    resolvedCap = 0;
  } else if (assetStatus === 'no_hit') {
    reasonCode = 'knowledge_no_hit';
    stopReason = '项目知识未命中';
    resolvedCap = configuredRepairLimit;
  } else if (triage?.failureClass === 'target_row_not_found') {
    reasonCode = 'target_row_not_found';
    stopReason = '目标行未命中';
    resolvedCap = Math.min(configuredRepairLimit, 1);
  } else if (triage?.failureClass === 'workflow_gap') {
    reasonCode = 'workflow_gap';
    stopReason = '流程缺口';
    resolvedCap = Math.min(configuredRepairLimit, 2);
  } else if (triage?.failureClass === 'unknown') {
    reasonCode = 'unknown';
    stopReason = triage.repairable ? '未分类问题' : '当前失败已判定不适合继续自动修复';
    resolvedCap = triage.repairable ? Math.min(configuredRepairLimit, 2) : 0;
  } else if (triage && !triage.repairable) {
    reasonCode = 'unknown';
    stopReason = '当前失败已判定不适合继续自动修复';
    resolvedCap = 0;
  }

  const maxRepairAttempts = Math.max(usedRepairAttempts, resolvedCap);
  const remainingRepairAttempts = Math.max(0, maxRepairAttempts - usedRepairAttempts);
  const exhausted = remainingRepairAttempts <= 0;

  return {
    configuredRepairLimit,
    maxRepairAttempts,
    usedRepairAttempts,
    remainingRepairAttempts,
    exhausted,
    reasonCode,
    stopReason,
    summary: describeBudgetSummary({
      reasonCode,
      maxRepairAttempts,
      usedRepairAttempts,
    }),
  };
}
