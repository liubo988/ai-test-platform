import { describe, expect, it } from 'vitest';
import {
  buildIntentCapabilityPreset,
  buildIntentCapabilityWorkbenchHref,
  getIntentCapabilityFlowDefinition,
  parseIntentCapabilityPreset,
  serializeIntentCapabilityPreset,
} from '../../lib/intent-capability-preset';

describe('intent capability preset helpers', () => {
  it('builds a composite capability preset from a scenario task', () => {
    const preset = buildIntentCapabilityPreset({
      sourceLabel: '任务「多节点 Demo：订单批量入账到入账管理核对」',
      name: '多节点 Demo：订单批量入账到入账管理核对',
      targetUrl: 'https://uat-service.yikaiye.com/#/order/list',
      featureDescription: '批量入账后进入入账管理核对结果，避免人工回看遗漏。',
      taskMode: 'scenario',
      authSource: 'project',
      flowDefinition: {
        version: 1,
        entryUrl: 'https://uat-service.yikaiye.com/#/order/list',
        sharedVariables: ['orderIds'],
        expectedOutcome: '批量入账成功，入账管理页能检索到对应记录。',
        cleanupNotes: '记录订单号和提交时间供人工核对。',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '批量勾选订单',
            target: 'https://uat-service.yikaiye.com/#/order/list',
            instruction: '勾选待入账订单并点击批量入账按钮。',
            expectedResult: '弹出批量入账确认弹窗。',
            extractVariable: '',
          },
          {
            stepUid: 'step-2',
            stepType: 'ui',
            title: '提交批量入账',
            target: 'https://uat-service.yikaiye.com/#/order/list',
            instruction: '确认提交，记录返回的订单号。',
            expectedResult: '页面提示批量入账成功。',
            extractVariable: 'orderIds',
          },
          {
            stepUid: 'step-3',
            stepType: 'ui',
            title: '入账管理核对',
            target: 'https://uat-service.yikaiye.com/#/account/manage',
            instruction: '进入入账管理页，用订单号检索刚提交的记录。',
            expectedResult: '列表出现对应入账记录。',
            extractVariable: '',
          },
        ],
      },
    });
    const parsed = parseIntentCapabilityPreset(serializeIntentCapabilityPreset(preset));

    expect(preset.capabilityType).toBe('composite');
    expect(preset.slug).toMatch(/^composite\.order-list\./);
    expect(preset.entryUrl).toBe('https://uat-service.yikaiye.com/#/order/list');
    expect(preset.preconditions).toEqual(['已登录系统']);
    expect(preset.steps).toEqual([
      '批量勾选订单：勾选待入账订单并点击批量入账按钮。',
      '提交批量入账：确认提交，记录返回的订单号。',
      '入账管理核对：进入入账管理页，用订单号检索刚提交的记录。',
    ]);
    expect(preset.meta).toMatchObject({
      sourceTaskMode: 'scenario',
    });
    expect(getIntentCapabilityFlowDefinition(preset.meta, preset.entryUrl)?.steps).toHaveLength(3);
    expect(getIntentCapabilityFlowDefinition(parsed?.meta, parsed?.entryUrl || '')?.steps).toHaveLength(3);
    expect(preset.assertions).toEqual([
      '批量入账成功，入账管理页能检索到对应记录。',
      '弹出批量入账确认弹窗。',
      '页面提示批量入账成功。',
      '列表出现对应入账记录。',
    ]);
  });

  it('builds a tokenized capability workbench href', () => {
    const preset = buildIntentCapabilityPreset({
      sourceLabel: '任务「创建商机并在商机列表按手机号校验落库」',
      name: '创建商机并在商机列表按手机号校验落库',
      targetUrl: 'https://uat-service.yikaiye.com/#/business/createbusiness',
      featureDescription: '创建商机后，在商机列表按手机号检索并核对落库结果。',
      taskMode: 'page',
      authSource: 'task',
      flowDefinition: null,
    });

    const serialized = serializeIntentCapabilityPreset(preset);
    const parsed = parseIntentCapabilityPreset(serialized);
    const href = buildIntentCapabilityWorkbenchHref({
      projectUid: 'proj_default',
      moduleUid: 'mod_business',
      preset,
      token: 'preset-1',
    });

    expect(parsed).toEqual(preset);
    expect(getIntentCapabilityFlowDefinition(parsed?.meta, parsed?.entryUrl || '')).toBeNull();
    expect(href).toContain('/projects/proj_default?');
    expect(href).toContain('module=mod_business');
    expect(href).toContain('intentView=capability');
    expect(href).toContain('intentToken=preset-1');
    expect(href).not.toContain('capabilityPreset=');
  });
});
