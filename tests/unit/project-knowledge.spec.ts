import { describe, expect, it } from 'vitest';
import { applyCapabilitySelectionToRecipe, draftRecipeFromRequirement, scoreTextMatch } from '../../lib/project-knowledge';

describe('project knowledge recipe drafting', () => {
  it('does not score trigger phrases that only exist inside the candidate text', () => {
    expect(scoreTextMatch('创建商机', '这是一个短信登录能力说明', ['登录']).score).toBe(0);
  });

  it('expands dependent capabilities before the matched business action', () => {
    const recipe = draftRecipeFromRequirement({
      requirement: '创建商机并完成主链路提交',
      includeAuthCapability: false,
      capabilities: [
        {
          slug: 'auth.sms-login',
          name: '短信登录',
          description: '完成登录',
          capabilityType: 'auth',
          entryUrl: 'https://example.com/#/',
          triggerPhrases: ['登录'],
          preconditions: [],
          steps: ['登录系统'],
          assertions: ['登录成功'],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 10,
        },
        {
          slug: 'navigation.business-create',
          name: '打开创建商机页',
          description: '打开新增商机页面',
          capabilityType: 'navigation',
          entryUrl: 'https://example.com/#/business/create',
          triggerPhrases: ['打开创建商机'],
          preconditions: ['已登录'],
          steps: ['进入创建商机页'],
          assertions: ['创建商机页可见'],
          cleanupNotes: '',
          dependsOn: ['auth.sms-login'],
          sortOrder: 20,
        },
        {
          slug: 'business.create-core',
          name: '创建商机主链路',
          description: '填写主链路最小必填并提交',
          capabilityType: 'action',
          entryUrl: 'https://example.com/#/business/create',
          triggerPhrases: ['创建商机', '主链路提交'],
          preconditions: ['已进入创建商机页'],
          steps: ['填写最小必填并提交'],
          assertions: ['提交成功'],
          cleanupNotes: '',
          dependsOn: ['navigation.business-create'],
          sortOrder: 30,
        },
      ],
      knowledgeChunks: [],
    });

    expect(recipe.matchedCapabilities.map((item) => item.slug)).toEqual([
      'auth.sms-login',
      'navigation.business-create',
      'business.create-core',
    ]);
    expect(recipe.executionRecipe.steps.map((item) => item.capabilitySlug)).toEqual([
      'auth.sms-login',
      'navigation.business-create',
      'business.create-core',
    ]);
    expect(recipe.requirementCoverage.uncoveredClauses).toEqual([]);
  });

  it('flags uncovered requirement clauses instead of silently dropping them', () => {
    const recipe = draftRecipeFromRequirement({
      requirement: '创建商机并生成订单',
      includeAuthCapability: false,
      capabilities: [
        {
          slug: 'business.create-core',
          name: '创建商机主链路',
          description: '填写主链路最小必填并提交',
          capabilityType: 'action',
          entryUrl: 'https://example.com/#/business/create',
          triggerPhrases: ['创建商机', '主链路提交'],
          preconditions: ['已进入创建商机页'],
          steps: ['填写最小必填并提交'],
          assertions: ['提交成功'],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 30,
        },
      ],
      knowledgeChunks: [],
    });

    expect(recipe.matchedCapabilities.map((item) => item.slug)).toEqual(['business.create-core']);
    expect(recipe.requirementCoverage.clauses).toEqual([
      expect.objectContaining({
        text: '创建商机',
        covered: true,
        matchedCapabilitySlugs: ['business.create-core'],
      }),
      expect.objectContaining({
        text: '生成订单',
        covered: false,
        matchedCapabilitySlugs: [],
      }),
    ]);
    expect(recipe.requirementCoverage.uncoveredClauses).toEqual(['生成订单']);
  });

  it('prefers a dedicated composite capability and suppresses superseded lower-level matches', () => {
    const recipe = draftRecipeFromRequirement({
      requirement: '创建商机并生成订单',
      includeAuthCapability: false,
      capabilities: [
        {
          slug: 'business.create-no-attachment',
          name: '创建商机并空附件提交',
          description: '填写最小必填并提交商机',
          capabilityType: 'action',
          entryUrl: 'https://example.com/#/business/create',
          triggerPhrases: ['创建商机', '空附件提交'],
          preconditions: ['已进入创建商机页'],
          steps: ['填写最小必填并提交'],
          assertions: ['提交成功'],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 30,
        },
        {
          slug: 'composite.business-create-to-order',
          name: '创建商机并生成订单',
          description: '创建商机后在商机列表生成订单，并等待 createOrder 成功。',
          capabilityType: 'composite',
          entryUrl: 'https://example.com/#/business/create',
          triggerPhrases: ['创建商机并生成订单', '商机转订单', '生成订单'],
          preconditions: ['已登录系统'],
          steps: ['创建商机', '生成订单'],
          assertions: ['createOrder 成功'],
          cleanupNotes: '记录商机ID供人工清理',
          dependsOn: [],
          sortOrder: 25,
          meta: {
            supersedes: ['business.create-no-attachment'],
          },
        },
      ],
      knowledgeChunks: [],
    });

    expect(recipe.matchedCapabilities.map((item) => item.slug)).toEqual(['composite.business-create-to-order']);
    expect(recipe.executionRecipe.steps.map((item) => item.capabilitySlug)).toEqual(['composite.business-create-to-order']);
    expect(recipe.requirementCoverage.uncoveredClauses).toEqual([]);
  });

  it('prefers a dedicated batch-add-contacts composite capability for contact enrollment tasks', () => {
    const recipe = draftRecipeFromRequirement({
      requirement: '商机列表批量加入通讯录并在我的通讯录按手机号校验结果',
      includeAuthCapability: false,
      capabilities: [
        {
          slug: 'navigation.business-list-page',
          name: '进入商机列表页',
          description: '打开商机列表并等待筛选区可见',
          capabilityType: 'navigation',
          entryUrl: 'https://example.com/#/business/list',
          triggerPhrases: ['商机列表', '打开商机列表'],
          preconditions: ['已登录系统'],
          steps: ['打开商机列表页'],
          assertions: ['商机列表加载完成'],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 20,
        },
        {
          slug: 'composite.business-list-batch-add-contacts',
          name: '商机列表批量加入通讯录并校验结果',
          description: '随机勾选一条商机后批量加入通讯录，并在我的通讯录按手机号检索确认可见。',
          capabilityType: 'composite',
          entryUrl: 'https://example.com/#/business/list',
          triggerPhrases: ['批量加入通讯录', '我的通讯录', '通讯录校验', '加入通讯录'],
          preconditions: ['已登录系统', '商机列表存在带手机号的记录'],
          steps: ['随机勾选一条商机', '点击批量加入通讯录', '进入我的通讯录按手机号检索'],
          assertions: ['我的通讯录可以检索到目标手机号'],
          cleanupNotes: '如需清理，请由业务侧手工删除联系人。',
          dependsOn: [],
          sortOrder: 10,
          meta: {
            supersedes: ['navigation.business-list-page'],
          },
        },
      ],
      knowledgeChunks: [],
    });

    expect(recipe.matchedCapabilities.map((item) => item.slug)).toEqual(['composite.business-list-batch-add-contacts']);
    expect(recipe.executionRecipe.steps.map((item) => item.capabilitySlug)).toEqual([
      'composite.business-list-batch-add-contacts',
    ]);
    expect(recipe.requirementCoverage.uncoveredClauses).toEqual([]);
  });

  it('prefers execution-verified capabilities over knowledge-derived ones when requirement match score is tied', () => {
    const recipe = draftRecipeFromRequirement({
      requirement: '按手机号检索商机',
      includeAuthCapability: false,
      capabilities: [
        {
          slug: 'query.knowledge-derived',
          name: '商机列表按手机号检索',
          description: '根据知识块自动提炼的检索能力',
          capabilityType: 'query',
          entryUrl: 'https://example.com/#/business/list',
          triggerPhrases: ['按手机号检索', '商机列表'],
          preconditions: [],
          steps: ['输入手机号并搜索'],
          assertions: ['列表展示匹配商机'],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 20,
          meta: {
            source: 'knowledge_chunk_auto',
            verificationStatus: 'knowledge_inferred',
          },
        },
        {
          slug: 'query.execution-verified',
          name: '商机列表按手机号检索',
          description: '经过执行验证的检索能力',
          capabilityType: 'query',
          entryUrl: 'https://example.com/#/business/list',
          triggerPhrases: ['按手机号检索', '商机列表'],
          preconditions: [],
          steps: ['输入手机号并搜索'],
          assertions: ['列表展示匹配商机'],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 30,
          meta: {
            source: 'validated-plan',
            executionUid: 'exec_1',
          },
        },
      ],
      knowledgeChunks: [],
    });

    expect(recipe.matchedCapabilities.map((item) => item.slug)).toEqual([
      'query.execution-verified',
      'query.knowledge-derived',
    ]);
  });

  it('recomputes coverage, steps, and assertions from the user-selected capability subset', () => {
    const recipe = draftRecipeFromRequirement({
      requirement: '登录并创建商机',
      includeAuthCapability: false,
      capabilities: [
        {
          slug: 'auth.sms-login',
          name: '短信登录',
          description: '完成登录',
          capabilityType: 'auth',
          entryUrl: 'https://example.com/#/',
          triggerPhrases: ['登录'],
          preconditions: [],
          steps: ['登录系统'],
          assertions: ['登录成功'],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 10,
        },
        {
          slug: 'business.create-core',
          name: '创建商机主链路',
          description: '填写主链路最小必填并提交',
          capabilityType: 'action',
          entryUrl: 'https://example.com/#/business/create',
          triggerPhrases: ['创建商机'],
          preconditions: ['已登录'],
          steps: ['填写最小必填并提交'],
          assertions: ['提交成功'],
          cleanupNotes: '',
          dependsOn: ['auth.sms-login'],
          sortOrder: 20,
        },
      ],
      knowledgeChunks: [
        {
          heading: '登录',
          content: '切换到短信验证码登录页签，输入手机号和验证码后点击登录。',
          keywords: ['短信验证码登录', '手机号', '登录'],
          sourceLineStart: 1,
          sourceLineEnd: 2,
          tokenEstimate: 20,
        },
        {
          heading: '新增商机',
          content: '填写商机来源和联系人信息后点击保存并继续，再提交商机。',
          keywords: ['新增商机', '保存并继续', '提交商机'],
          sourceLineStart: 3,
          sourceLineEnd: 4,
          tokenEstimate: 24,
        },
      ],
    });

    const selectedRecipe = applyCapabilitySelectionToRecipe({
      recipe,
      selectedCapabilitySlugs: ['auth.sms-login'],
    });

    expect(selectedRecipe.matchedCapabilities.map((item) => item.slug)).toEqual(['auth.sms-login']);
    expect(selectedRecipe.executionRecipe.steps.map((item) => item.capabilitySlug)).toEqual(['auth.sms-login']);
    expect(selectedRecipe.executionRecipe.assertions).toEqual(['登录成功']);
    expect(selectedRecipe.requirementCoverage.clauses).toEqual([
      expect.objectContaining({
        text: '登录',
        covered: true,
        matchedCapabilitySlugs: ['auth.sms-login'],
      }),
      expect.objectContaining({
        text: '创建商机',
        covered: false,
        matchedCapabilitySlugs: [],
      }),
    ]);
    expect(selectedRecipe.requirementCoverage.uncoveredClauses).toEqual(['创建商机']);
    expect(selectedRecipe.supportingKnowledge.map((item) => item.heading)).toEqual(['登录']);
  });

  it('returns an empty execution recipe when the user clears all matched capabilities', () => {
    const recipe = draftRecipeFromRequirement({
      requirement: '登录并创建商机',
      includeAuthCapability: false,
      capabilities: [
        {
          slug: 'auth.sms-login',
          name: '短信登录',
          description: '完成登录',
          capabilityType: 'auth',
          entryUrl: 'https://example.com/#/',
          triggerPhrases: ['登录'],
          preconditions: [],
          steps: ['登录系统'],
          assertions: ['登录成功'],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 10,
        },
        {
          slug: 'business.create-core',
          name: '创建商机主链路',
          description: '填写主链路最小必填并提交',
          capabilityType: 'action',
          entryUrl: 'https://example.com/#/business/create',
          triggerPhrases: ['创建商机'],
          preconditions: ['已登录'],
          steps: ['填写最小必填并提交'],
          assertions: ['提交成功'],
          cleanupNotes: '',
          dependsOn: ['auth.sms-login'],
          sortOrder: 20,
        },
      ],
      knowledgeChunks: [
        {
          heading: '登录',
          content: '切换到短信验证码登录页签，输入手机号和验证码后点击登录。',
          keywords: ['短信验证码登录', '手机号', '登录'],
          sourceLineStart: 1,
          sourceLineEnd: 2,
          tokenEstimate: 20,
        },
        {
          heading: '新增商机',
          content: '填写商机来源和联系人信息后点击保存并继续，再提交商机。',
          keywords: ['新增商机', '保存并继续', '提交商机'],
          sourceLineStart: 3,
          sourceLineEnd: 4,
          tokenEstimate: 24,
        },
      ],
    });

    const selectedRecipe = applyCapabilitySelectionToRecipe({
      recipe,
      selectedCapabilitySlugs: [],
    });

    expect(selectedRecipe.matchedCapabilities).toEqual([]);
    expect(selectedRecipe.executionRecipe.steps).toEqual([]);
    expect(selectedRecipe.executionRecipe.assertions).toEqual([]);
    expect(selectedRecipe.executionRecipe.cleanupNotes).toEqual([]);
    expect(selectedRecipe.requirementCoverage.uncoveredClauses).toEqual(['登录', '创建商机']);
    expect(selectedRecipe.supportingKnowledge).toEqual([]);
  });
});
