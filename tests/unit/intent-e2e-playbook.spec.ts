import { describe, expect, it } from 'vitest';
import {
  aggregateIntentE2EPlaybookCandidates,
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

  it('aggregates duplicated playbook candidates by slug before building recipes', () => {
    const candidates = aggregateIntentE2EPlaybookCandidates([
      {
        candidateId: 'candidate-a',
        slug: 'intent.business-create-list-verify',
        title: '创建商机后回列表',
        scenarioFamily: 'generic',
        targetPath: 'https://example.com/#/business/createbusiness',
        matchedRecipeSlugs: ['business.create'],
        stepTypes: ['ui'],
        preconditions: ['保持登录态稳定'],
        executorPlan: ['创建商机：保存后提取 businessId'],
        verifierPlan: ['回列表：按 businessId 命中记录'],
        preferredHelpers: ['__e2e.waitForApiResponse'],
        knownPitfalls: ['不要只看 toast'],
        sourceRunIds: ['intent-run-a'],
        successRate: 88,
        lastVerifiedAt: '2026-04-09T11:00:00.000Z',
        promotionStatus: 'candidate',
      },
      {
        candidateId: 'candidate-b',
        slug: 'intent.business-create-list-verify',
        title: '创建商机后回列表验收新入库',
        scenarioFamily: 'business_create_list_verify',
        targetPath: '/business/createbusiness',
        matchedRecipeSlugs: ['business.list-ownership-switch'],
        stepTypes: ['assert'],
        preconditions: ['切到我创建的'],
        executorPlan: ['切换我创建的后再回查'],
        verifierPlan: ['单独校验商机进展=新入库'],
        preferredHelpers: ['__e2e.findAntdTableRow'],
        knownPitfalls: ['列表搜索后要等待刷新'],
        sourceRunIds: ['intent-run-b'],
        successRate: 100,
        lastVerifiedAt: '2026-04-09T12:00:00.000Z',
        promotionStatus: 'candidate',
      },
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      slug: 'intent.business-create-list-verify',
      title: '创建商机后回列表验收新入库',
      scenarioFamily: 'business_create_list_verify',
      matchedRecipeSlugs: ['business.create', 'business.list-ownership-switch'],
      stepTypes: ['ui', 'assert'],
      preconditions: ['保持登录态稳定', '切到我创建的'],
      sourceRunIds: ['intent-run-a', 'intent-run-b'],
      successRate: 100,
      lastVerifiedAt: '2026-04-09T12:00:00.000Z',
    });

    const recipes = buildIntentProjectRecipeMergeInputsFromPlaybookCandidates(candidates);
    expect(recipes).toHaveLength(1);
    expect(recipes[0]?.matchers?.preferredHelpers).toEqual(
      expect.arrayContaining(['__e2e.waitForApiResponse', '__e2e.findAntdTableRow'])
    );
  });
});
