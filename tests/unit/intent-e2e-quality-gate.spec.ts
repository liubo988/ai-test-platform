import { describe, expect, it } from 'vitest';
import { resolveIntentE2EQualityGate } from '@/lib/intent-e2e-quality-gate';

describe('intent-e2e-quality-gate', () => {
  it('routes missing project assets to bootstrap before auto-run or repair', () => {
    expect(
      resolveIntentE2EQualityGate({
        assetReadiness: { status: 'asset_missing' },
      })
    ).toMatchObject({
      blocked: true,
      launchDecision: 'needs_bootstrap',
      repairBudgetReasonCode: 'asset_missing',
      stopReason: '项目资产未就绪',
    });
  });

  it('routes project knowledge no-hit to draft-only and blocks blind repair', () => {
    expect(
      resolveIntentE2EQualityGate({
        assetReadiness: { status: 'no_hit' },
      })
    ).toMatchObject({
      blocked: true,
      launchDecision: 'draft_only',
      repairBudgetReasonCode: 'knowledge_no_hit',
      stopReason: '项目知识未命中',
    });
  });

  it('maps blocked quality buckets to prerequisite decisions', () => {
    expect(
      resolveIntentE2EQualityGate({
        qualitySplit: { bucket: 'permission_blocked', blockerKind: 'permission' },
      })
    ).toMatchObject({
      blocked: true,
      launchDecision: 'needs_bootstrap',
      repairBudgetReasonCode: 'permission_blocked',
    });

    expect(
      resolveIntentE2EQualityGate({
        failureClass: 'fixture_contract_missing',
      })
    ).toMatchObject({
      blocked: true,
      launchDecision: 'needs_fixture',
      repairBudgetReasonCode: 'fixture_contract_missing',
    });
  });

  it('allows model-quality failures to use the normal repair budget', () => {
    expect(
      resolveIntentE2EQualityGate({
        assetReadiness: { status: 'ready' },
        qualitySplit: { bucket: 'model_quality', blockerKind: '' },
      })
    ).toEqual({
      blocked: false,
      launchDecision: '',
      repairBudgetReasonCode: '',
      stopReason: '',
      summary: '',
    });
  });
});
