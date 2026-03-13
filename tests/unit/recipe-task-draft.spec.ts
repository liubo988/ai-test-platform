import { describe, expect, it } from 'vitest';
import { buildTaskDraftFromRecipe } from '../../lib/recipe-task-draft';

describe('recipe task draft builder', () => {
  it('converts a recipe into a scenario task draft with extracted variables', () => {
    const draft = buildTaskDraftFromRecipe({
      moduleUid: 'mod_business',
      recipe: {
        title: '创建商机并校验落库',
        requirement: '创建商机并校验落库',
        requirementKeywords: ['创建商机', '落库'],
        matchedCapabilities: [
          {
            slug: 'business.list-search-by-phone',
            name: '商机列表按手机号检索',
            capabilityType: 'query',
            entryUrl: 'https://uat.example.com/#/business/list',
            score: 12,
            matchedPhrases: ['商机列表'],
            preconditions: [],
            suggestedSteps: ['按手机号搜索并读取商机ID'],
            suggestedAssertions: ['列表展示商机ID和联系人手机号'],
            cleanupNotes: '',
            dependsOn: [],
            sortOrder: 10,
          },
        ],
        supportingKnowledge: [],
        requirementCoverage: {
          clauses: [
            {
              text: '创建商机',
              covered: true,
              matchedCapabilitySlugs: ['business.list-search-by-phone'],
              matchedCapabilityNames: ['商机列表按手机号检索'],
            },
          ],
          uncoveredClauses: [],
        },
        executionRecipe: {
          steps: [
            {
              capabilitySlug: 'business.list-search-by-phone',
              capabilityName: '商机列表按手机号检索',
              capabilityType: 'query',
              reason: '命中: 商机列表',
              entryUrl: 'https://uat.example.com/#/business/list',
              preconditions: [],
              actions: ['输入联系人手机号进行搜索', '读取商机ID并校验字段'],
            },
          ],
          assertions: ['列表展示商机ID和联系人手机号', '商机进展为新入库'],
          cleanupNotes: ['记录商机ID供人工清理'],
        },
      },
    });

    expect(draft.moduleUid).toBe('mod_business');
    expect(draft.taskMode).toBe('scenario');
    expect(draft.targetUrl).toBe('https://uat.example.com/#/business/list');
    expect(draft.flowDefinition.steps).toHaveLength(1);
    expect(draft.flowDefinition.steps[0]).toMatchObject({
      stepType: 'extract',
      title: '商机列表按手机号检索',
      extractVariable: 'businessId',
    });
    expect(draft.flowDefinition.sharedVariables).toEqual(['businessId']);
    expect(draft.featureDescription).toContain('建议能力链：商机列表按手机号检索');
  });

  it('expands preserved composite capability flows instead of collapsing them into a single step', () => {
    const draft = buildTaskDraftFromRecipe({
      moduleUid: 'mod_business',
      recipe: {
        title: '创建商机并生成订单',
        requirement: '创建商机并生成订单',
        requirementKeywords: ['创建商机', '生成订单'],
        matchedCapabilities: [
          {
            slug: 'auth.sms-password-login',
            name: '短信密码登录',
            capabilityType: 'auth',
            entryUrl: 'https://uat.example.com/#/',
            score: 5,
            matchedPhrases: ['统一登录前置'],
            preconditions: [],
            suggestedSteps: ['登录系统'],
            suggestedAssertions: ['登录成功'],
            cleanupNotes: '',
            dependsOn: [],
            sortOrder: 10,
          },
          {
            slug: 'composite.business-create-to-order',
            name: '创建商机并生成订单',
            capabilityType: 'composite',
            entryUrl: 'https://uat.example.com/#/business/create',
            score: 20,
            matchedPhrases: ['创建商机并生成订单'],
            preconditions: ['已登录系统'],
            suggestedSteps: ['创建商机', '生成订单'],
            suggestedAssertions: ['createOrder 成功'],
            cleanupNotes: '记录商机ID供人工清理',
            dependsOn: ['auth.sms-password-login'],
            sortOrder: 20,
            meta: {
              sourceTaskMode: 'scenario',
              flowDefinition: {
                version: 1,
                entryUrl: 'https://uat.example.com/#/business/create',
                sharedVariables: ['contactPhone', 'businessId', 'signedCountAfter'],
                expectedOutcome: '创建商机后可成功生成订单',
                cleanupNotes: '记录商机ID供人工清理',
                steps: [
                  {
                    stepUid: 'flow_1',
                    stepType: 'ui',
                    title: '填写商机必填',
                    target: 'https://uat.example.com/#/business/create',
                    instruction: '填写第一页和第二页必填后提交',
                    expectedResult: '商机提交成功',
                    extractVariable: 'contactPhone',
                  },
                  {
                    stepUid: 'flow_2',
                    stepType: 'api',
                    title: '确认生成订单',
                    target: 'https://uat.example.com/#/business/list',
                    instruction: '等待 createOrder 成功响应',
                    expectedResult: 'createOrder 成功且 Drawer 关闭',
                    extractVariable: 'businessId,signedCountAfter',
                  },
                ],
              },
            },
          },
        ],
        supportingKnowledge: [],
        requirementCoverage: {
          clauses: [
            {
              text: '创建商机',
              covered: true,
              matchedCapabilitySlugs: ['composite.business-create-to-order'],
              matchedCapabilityNames: ['创建商机并生成订单'],
            },
            {
              text: '生成订单',
              covered: true,
              matchedCapabilitySlugs: ['composite.business-create-to-order'],
              matchedCapabilityNames: ['创建商机并生成订单'],
            },
          ],
          uncoveredClauses: [],
        },
        executionRecipe: {
          steps: [
            {
              capabilitySlug: 'auth.sms-password-login',
              capabilityName: '短信密码登录',
              capabilityType: 'auth',
              reason: '统一登录前置',
              entryUrl: 'https://uat.example.com/#/',
              preconditions: [],
              actions: ['登录系统'],
            },
            {
              capabilitySlug: 'composite.business-create-to-order',
              capabilityName: '创建商机并生成订单',
              capabilityType: 'composite',
              reason: '命中: 创建商机并生成订单',
              entryUrl: 'https://uat.example.com/#/business/create',
              preconditions: ['已登录系统'],
              actions: ['创建商机', '生成订单'],
            },
          ],
          assertions: ['创建商机后可成功生成订单'],
          cleanupNotes: ['记录商机ID供人工清理'],
        },
      },
    });

    expect(draft.targetUrl).toBe('https://uat.example.com/#/business/create');
    expect(draft.flowDefinition.entryUrl).toBe('https://uat.example.com/#/business/create');
    expect(draft.flowDefinition.steps).toHaveLength(3);
    expect(draft.flowDefinition.steps.map((item) => item.title)).toEqual(['短信密码登录', '填写商机必填', '确认生成订单']);
    expect(draft.flowDefinition.sharedVariables).toEqual(['contactPhone', 'businessId', 'signedCountAfter']);
    expect(draft.flowDefinition.expectedOutcome).toContain('创建商机后可成功生成订单');
    expect(draft.flowDefinition.cleanupNotes).toContain('记录商机ID供人工清理');
  });
});
