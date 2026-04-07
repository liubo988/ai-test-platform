import { describe, expect, it } from 'vitest';
import { normalizeIntentE2ERequestBody } from '@/lib/ai/intent-e2e-request';

describe('intent-e2e-request', () => {
  it('normalizes runtime governance fields with supported enums and trims references', () => {
    const request = normalizeIntentE2ERequestBody({
      input: '  创建订单并验证成功页  ',
      runtimeGovernance: {
        environmentProfile: ' TEST ',
        credential: {
          source: ' request ',
          secretRef: ' vault://qa/order-creator ',
          accountRef: ' account://qa/order-creator ',
          sessionMode: ' ISOLATED ',
        },
        fixture: {
          strategy: ' SETUP_CLEANUP ',
          setupRef: ' fixture://order/setup ',
          cleanupRef: ' fixture://order/cleanup ',
          owner: ' qa-order ',
          idempotencyKey: ' order-create-smoke ',
        },
      },
    });

    expect(request.runtimeGovernance).toEqual({
      environmentProfile: 'test',
      credential: {
        source: 'request',
        secretRef: 'vault://qa/order-creator',
        accountRef: 'account://qa/order-creator',
        sessionMode: 'isolated',
      },
      fixture: {
        strategy: 'setup_cleanup',
        setupRef: 'fixture://order/setup',
        cleanupRef: 'fixture://order/cleanup',
        owner: 'qa-order',
        idempotencyKey: 'order-create-smoke',
      },
    });
  });

  it('drops empty or unsupported runtime governance values', () => {
    const request = normalizeIntentE2ERequestBody({
      input: '查看首页额度',
      runtimeGovernance: {
        environmentProfile: 'prod',
        credential: {
          source: 'unknown',
          secretRef: '   ',
          sessionMode: 'sticky',
        },
        fixture: {
          strategy: 'manual',
          owner: '   ',
        },
      },
    });

    expect(request.runtimeGovernance).toBeUndefined();
  });

  it('normalizes run control priority, timeout, retry limit, and replay linkage', () => {
    const request = normalizeIntentE2ERequestBody({
      input: '  重放一次 checkout smoke  ',
      runControl: {
        priority: ' HIGH ',
        timeoutMs: 12_345.9,
        retryLimit: 3.8,
        replayOfRunId: ' intent-run-prev ',
      },
    });

    expect(request.runControl).toEqual({
      priority: 'high',
      timeoutMs: 30_000,
      retryLimit: 2,
      replayOfRunId: 'intent-run-prev',
    });
  });

  it('drops invalid run control values', () => {
    const request = normalizeIntentE2ERequestBody({
      input: '查看首页额度',
      runControl: {
        priority: 'urgent',
        timeoutMs: -1,
        retryLimit: -3,
        replayOfRunId: '   ',
      },
    });

    expect(request.runControl).toBeUndefined();
  });

  it('normalizes onboarding manifest id and cicd profile', () => {
    const request = normalizeIntentE2ERequestBody({
      input: '  验证供应商门户登录页  ',
      onboardingManifestId: ' vendor_portal_staging ',
      cicdProfile: ' PR_GATE ',
    });

    expect(request.onboardingManifestId).toBe('vendor_portal_staging');
    expect(request.cicdProfile).toBe('pr_gate');
  });

  it('accepts prefilled draft assets for run fast-path reuse', () => {
    const request = normalizeIntentE2ERequestBody({
      input: '  创建商机并验证新入库状态  ',
      intentDraftUid: '  idraft_1  ',
      targetUrl: ' https://example.com/#/business/businesslist ',
      prefilledScenarioCard: {
        title: '  创建商机并验证新入库状态  ',
        taskMode: 'scenario',
        targetUrl: ' https://example.com/#/business/businesslist ',
        featureDescription: '从草稿复用 ScenarioCard',
        flowDefinition: {
          version: 1,
          entryUrl: 'https://example.com/#/business/businesslist',
          sharedVariables: ['businessId'],
          expectedOutcome: '列表出现新记录',
          cleanupNotes: '',
          steps: [],
        },
        successCriteria: ['列表出现新记录'],
        visualAnchors: ['新建商机按钮'],
        notes: ['复用草稿资产'],
      },
      prefilledPlanCode: "test('draft-prefill', async ({ page }) => { await page.goto('https://example.com/#/business/businesslist'); });",
    });

    expect(request.prefilledScenarioCard).toMatchObject({
      title: '创建商机并验证新入库状态',
      targetUrl: 'https://example.com/#/business/businesslist',
      featureDescription: '从草稿复用 ScenarioCard',
    });
    expect(request.intentDraftUid).toBe('idraft_1');
    expect(request.prefilledPlanCode).toContain("test('draft-prefill'");
  });
});
