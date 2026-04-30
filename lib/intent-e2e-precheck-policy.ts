import type { ScenarioCard } from '@/lib/ai/scenario-card';
import type { PageAccessPrecheckFailureClass } from '@/lib/page-analyzer';

export type IntentE2EPrecheckPolicyKind =
  | 'default'
  | 'create_entry_allows_empty_state'
  | 'recoverable_list_empty_state';

export interface IntentE2EPrecheckPolicy {
  kind: IntentE2EPrecheckPolicyKind;
  ignoreFailureClasses: PageAccessPrecheckFailureClass[];
  policyNotes: string[];
}

const CREATE_ENTRY_EMPTY_STATE_POLICY_NOTE =
  '前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断，继续确认是否存在可用新建入口。';
const RECOVERABLE_LIST_EMPTY_STATE_POLICY_NOTE =
  '前置检查策略：已声明“结果为空时切换到有数据列表视角”的场景允许列表页空态绕过 data_missing 阻断，继续执行显式切换步骤。';

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function normalizeIntentE2EPrecheckUrl(targetUrl: string): string {
  try {
    const parsed = new URL(targetUrl);
    const hash = parsed.hash.replace(/^#/, '').replace(/\/+$/, '');
    if (hash) return hash.startsWith('/') ? hash : `/${hash}`;
    return parsed.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return targetUrl.replace(/https?:\/\/[^/]+/i, '').replace(/\/+$/, '') || targetUrl;
  }
}

function looksLikeCreateFlowEmptyStateBypass(card: ScenarioCard, targetUrl: string, precheckUrl: string): boolean {
  if (card.taskMode !== 'scenario') return false;

  const normalizedTargetUrl = normalizeIntentE2EPrecheckUrl(targetUrl);
  const normalizedPrecheckUrl = normalizeIntentE2EPrecheckUrl(precheckUrl);
  const normalizedEntryUrl = normalizeIntentE2EPrecheckUrl(card.flowDefinition.entryUrl || '');
  if (!normalizedTargetUrl || !normalizedPrecheckUrl) {
    return false;
  }

  if (normalizedEntryUrl !== normalizedPrecheckUrl) {
    return false;
  }

  const earlyStepText = card.flowDefinition.steps
    .slice(0, 3)
    .flatMap((step) => [step.title, step.target, step.instruction, step.expectedResult])
    .join('\n');
  const fullFlowText = [
    card.title,
    card.featureDescription,
    card.flowDefinition.expectedOutcome,
    ...card.successCriteria,
    ...card.flowDefinition.steps.flatMap((step) => [step.title, step.target, step.instruction, step.expectedResult]),
  ].join('\n');

  return /(新建|创建|新增|添加)/i.test(earlyStepText) && /(保存|提交|保存并继续|提交并继续)/i.test(fullFlowText);
}

function looksLikeRecoverableListEmptyStateBypass(card: ScenarioCard, targetUrl: string, precheckUrl: string): boolean {
  if (card.taskMode !== 'scenario') return false;

  const normalizedTargetUrl = normalizeIntentE2EPrecheckUrl(targetUrl);
  const normalizedPrecheckUrl = normalizeIntentE2EPrecheckUrl(precheckUrl);
  const normalizedEntryUrl = normalizeIntentE2EPrecheckUrl(card.flowDefinition.entryUrl || '');
  if (!normalizedTargetUrl || !normalizedPrecheckUrl) {
    return false;
  }

  if (normalizedEntryUrl !== normalizedPrecheckUrl || normalizedTargetUrl !== normalizedPrecheckUrl) {
    return false;
  }

  const fullFlowText = [
    card.title,
    card.featureDescription,
    card.flowDefinition.expectedOutcome,
    ...card.successCriteria,
    ...card.flowDefinition.steps.flatMap((step) => [step.title, step.target, step.instruction, step.expectedResult]),
  ].join('\n');

  const mentionsRecoverableEmptyState =
    /(若当前筛选结果为空|如果当前筛选结果为空|若当前结果为空|如果当前结果为空|筛选结果为空|当前结果为空|暂无数据|空态)/i.test(
      fullFlowText
    );
  const mentionsExplicitDatafulSwitch =
    /(切换到当前有数量|切换到有数量|切换到.*有数量|切换到.*有数据|切换到.*非空|切换.*到.*有数量|切换.*到.*有数据|切换.*到.*非空|切换.*至少\s*1\s*条|切换.*可勾选|切换.*可操作|切到.*有数量|切到.*有数据|改到.*有数量|选择.*有数量)/i.test(
      fullFlowText
    );
  const mentionsFollowupSelectionOrVerification =
    /(随机选择|选择一条|勾选|目标行|手机号|联系人|批量加入通讯录|检索|搜索)/i.test(fullFlowText);

  return mentionsRecoverableEmptyState && mentionsExplicitDatafulSwitch && mentionsFollowupSelectionOrVerification;
}

export function resolveIntentE2EPrecheckPolicy(input: {
  scenarioCard: ScenarioCard;
  targetUrl: string;
  precheckUrl: string;
}): IntentE2EPrecheckPolicy {
  if (looksLikeCreateFlowEmptyStateBypass(input.scenarioCard, input.targetUrl, input.precheckUrl)) {
    return {
      kind: 'create_entry_allows_empty_state',
      ignoreFailureClasses: ['data_missing'],
      policyNotes: [CREATE_ENTRY_EMPTY_STATE_POLICY_NOTE],
    };
  }

  if (looksLikeRecoverableListEmptyStateBypass(input.scenarioCard, input.targetUrl, input.precheckUrl)) {
    return {
      kind: 'recoverable_list_empty_state',
      ignoreFailureClasses: ['data_missing'],
      policyNotes: [RECOVERABLE_LIST_EMPTY_STATE_POLICY_NOTE],
    };
  }

  return {
    kind: 'default',
    ignoreFailureClasses: [],
    policyNotes: [],
  };
}

export function mergeIntentE2EPrecheckPolicyNotes(...groups: Array<Array<string | null | undefined> | null | undefined>): string[] {
  return uniqueStrings(groups.flatMap((group) => group || []));
}
