import { describe, expect, it } from 'vitest';
import {
  buildIntentProjectRecipeMergeInputFromPlaybookCandidate,
  buildIntentProjectRecipeMergeInputsFromPlaybookCandidates,
} from '@/lib/intent-e2e-playbook';

describe('intent-e2e-playbook', () => {
  it('builds project recipe merge input from tracked playbook candidate', () => {
    const recipe = buildIntentProjectRecipeMergeInputFromPlaybookCandidate({
      candidateId: 'candidate-1',
      slug: 'intent.business-create-list-verify',
      title: '创建商机后回列表验收',
      scenarioFamily: 'business_create_list_verify',
      targetPath: 'https://example.com/#/business/createbusiness',
      matchedRecipeSlugs: ['business.create'],
      stepTypes: ['ui'],
      preconditions: ['保持登录态稳定'],
      executorPlan: ['创建商机：提交成功后提取 businessId'],
      verifierPlan: ['回列表验收：按 businessId 命中新商机记录'],
      preferredHelpers: ['__e2e.waitForApiResponse', '__e2e.resolvePrimaryRecord'],
      knownPitfalls: ['不要只看 toast'],
      sourceRunIds: ['intent-run-1'],
      successRate: 100,
      lastVerifiedAt: '2026-04-09T12:00:00.000Z',
      promotionStatus: 'candidate',
    });

    expect(recipe).toMatchObject({
      slug: 'intent.business-create-list-verify',
      family: 'business_create_list_verify',
      title: '创建商机后回列表验收',
      matchers: {
        targetUrlIncludes: ['/business/createbusiness'],
        requiredActions: ['find_table_row'],
        preferredHelpers: ['__e2e.waitForApiResponse', '__e2e.resolvePrimaryRecord'],
      },
      requiredContext: ['保持登录态稳定'],
      executorPlan: ['创建商机：提交成功后提取 businessId'],
      verifierPlan: ['回列表验收：按 businessId 命中新商机记录'],
      knownPitfalls: ['不要只看 toast'],
      successRate: 100,
      lastVerifiedAt: '2026-04-09T12:00:00.000Z',
    });
    expect(recipe.description).toContain('通过 run 自动沉淀');
  });

  it('builds recipe merge inputs in batch and keeps untracked family optional', () => {
    const recipes = buildIntentProjectRecipeMergeInputsFromPlaybookCandidates([
      {
        candidateId: 'candidate-2',
        slug: 'intent.modal-save',
        title: '抽屉保存收敛',
        scenarioFamily: 'modal_or_drawer_save',
        targetPath: '/crm/customer',
        matchedRecipeSlugs: [],
        stepTypes: ['ui'],
        preconditions: [],
        executorPlan: ['保存后等待抽屉关闭'],
        verifierPlan: ['确认关键保存接口成功'],
        preferredHelpers: ['__e2e.observeSubmitState'],
        knownPitfalls: [],
        sourceRunIds: ['intent-run-2'],
        successRate: 100,
        lastVerifiedAt: '2026-04-09T12:10:00.000Z',
        promotionStatus: 'candidate',
      },
      {
        candidateId: 'candidate-3',
        slug: 'intent.generic-flow',
        title: '通用流程',
        scenarioFamily: 'generic',
        targetPath: '/generic',
        matchedRecipeSlugs: [],
        stepTypes: ['ui'],
        preconditions: [],
        executorPlan: ['执行动作'],
        verifierPlan: ['确认成功'],
        preferredHelpers: [],
        knownPitfalls: [],
        sourceRunIds: ['intent-run-3'],
        successRate: 100,
        lastVerifiedAt: '2026-04-09T12:20:00.000Z',
        promotionStatus: 'candidate',
      },
    ]);

    expect(recipes).toHaveLength(2);
    expect(recipes[0]).toMatchObject({
      family: 'modal_or_drawer_save',
      matchers: {
        requiredActions: ['observe_submit_state'],
      },
    });
    expect(recipes[1]?.family).toBeUndefined();
  });
});
