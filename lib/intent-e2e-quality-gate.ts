import type { IntentE2EAssetReadiness } from './intent-e2e-asset-readiness';
import {
  normalizeIntentE2EQualitySplit,
  type IntentE2EQualityBucket,
  type IntentE2EQualitySplit,
} from './intent-e2e-quality-split';

export type IntentE2EQualityGateDecision = '' | 'needs_bootstrap' | 'needs_fixture' | 'draft_only';

export type IntentE2EQualityGateRepairBudgetReasonCode =
  | ''
  | 'asset_missing'
  | 'knowledge_no_hit'
  | 'auth_blocked'
  | 'auth_state_invalid'
  | 'permission_blocked'
  | 'env_blocked'
  | 'data_blocked'
  | 'fixture_contract_missing';

export interface IntentE2EQualityGate {
  blocked: boolean;
  launchDecision: IntentE2EQualityGateDecision;
  repairBudgetReasonCode: IntentE2EQualityGateRepairBudgetReasonCode;
  stopReason: string;
  summary: string;
}

export interface ResolveIntentE2EQualityGateInput {
  assetReadiness?: Pick<IntentE2EAssetReadiness, 'status'> | null;
  qualitySplit?: Pick<IntentE2EQualitySplit, 'bucket' | 'blockerKind'> | null;
  failureClass?: string | null;
}

function normalizeFailureClass(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveBucket(input: ResolveIntentE2EQualityGateInput): IntentE2EQualityBucket {
  if (input.qualitySplit?.bucket) {
    return input.qualitySplit.bucket;
  }

  return normalizeIntentE2EQualitySplit(null, {
    status: 'failed',
    failureClass: normalizeFailureClass(input.failureClass),
  }).bucket;
}

function allowGate(): IntentE2EQualityGate {
  return {
    blocked: false,
    launchDecision: '',
    repairBudgetReasonCode: '',
    stopReason: '',
    summary: '',
  };
}

export function resolveIntentE2EQualityGate(input: ResolveIntentE2EQualityGateInput): IntentE2EQualityGate {
  const assetStatus = input.assetReadiness?.status || 'ready';
  const failureClass = normalizeFailureClass(input.failureClass);
  const bucket = resolveBucket(input);

  if (assetStatus === 'asset_missing') {
    return {
      blocked: true,
      launchDecision: 'needs_bootstrap',
      repairBudgetReasonCode: 'asset_missing',
      stopReason: '项目资产未就绪',
      summary: '当前项目冷启动资产未就绪，应先补 onboarding / project knowledge / repair memory，再继续运行。',
    };
  }

  if (assetStatus === 'no_hit') {
    return {
      blocked: true,
      launchDecision: 'draft_only',
      repairBudgetReasonCode: 'knowledge_no_hit',
      stopReason: '项目知识未命中',
      summary: '当前项目知识未命中，应先沉淀或补齐项目知识，避免继续盲目自动修复。',
    };
  }

  if (failureClass === 'auth_state_invalid') {
    return {
      blocked: true,
      launchDecision: 'needs_bootstrap',
      repairBudgetReasonCode: 'auth_state_invalid',
      stopReason: '登录态失效',
      summary: '当前失败属于登录态失效，应先恢复认证态，再重新运行。',
    };
  }

  if (bucket === 'auth_blocked') {
    return {
      blocked: true,
      launchDecision: 'needs_bootstrap',
      repairBudgetReasonCode: 'auth_blocked',
      stopReason: '认证阻塞',
      summary: '当前失败属于认证阻塞，应先补账号、登录方式或认证前置条件。',
    };
  }

  if (bucket === 'permission_blocked') {
    return {
      blocked: true,
      launchDecision: 'needs_bootstrap',
      repairBudgetReasonCode: 'permission_blocked',
      stopReason: '权限阻塞',
      summary: '当前失败属于权限阻塞，应先补权限或切换可访问账号。',
    };
  }

  if (bucket === 'env_blocked') {
    return {
      blocked: true,
      launchDecision: 'needs_bootstrap',
      repairBudgetReasonCode: 'env_blocked',
      stopReason: '环境阻塞',
      summary: '当前失败属于环境阻塞，应先恢复环境或服务可用性。',
    };
  }

  if (bucket === 'data_blocked') {
    return {
      blocked: true,
      launchDecision: 'needs_fixture',
      repairBudgetReasonCode: failureClass === 'fixture_contract_missing' ? 'fixture_contract_missing' : 'data_blocked',
      stopReason: failureClass === 'fixture_contract_missing' ? 'fixture 契约缺口' : '数据阻塞',
      summary: '当前失败属于数据 / fixture 阻塞，应先补测试数据或 fixture contract。',
    };
  }

  return allowGate();
}
