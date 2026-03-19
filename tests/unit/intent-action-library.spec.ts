import { describe, expect, it } from 'vitest';
import { renderIntentActionLibrary, selectIntentActionLibrary } from '@/lib/intent-action-library';
import { buildIntentActionDSL } from '@/lib/intent-action-dsl';

describe('intent-action-library', () => {
  it('selects matching capabilities from DSL, auth, and iframe snapshot', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/business/list',
      featureDescription: '登录后在 iframe 里筛选商机并生成订单',
      expectedOutcome: 'createOrder 接口成功',
      sharedVariables: ['businessId'],
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'ui',
          title: '筛选商机',
          target: 'https://example.com/business/list',
          instruction: '在 iframe 内通过下拉选择来源=抖音，并在目标行点击生成订单',
          expectedResult: '目标商机进入生成订单流程',
          extractVariable: 'businessId',
        },
      ],
    });

    const library = selectIntentActionLibrary({
      dsl,
      auth: {
        loginUrl: 'https://example.com/login',
        username: '13800138000',
        password: '123456',
        loginDescription: '密码登录',
      },
      snapshot: {
        url: 'https://example.com/business/list',
        title: '商机列表',
        frames: [
          {
            name: 'bizFrame',
            url: 'https://frame.example.com/list',
            elementId: 'biz-frame',
            elementName: '',
            selectorHint: '#biz-frame',
            forms: [],
            buttons: [],
            tooltipElements: [],
            links: [],
            headings: [],
            bodyTextExcerpt: '',
          },
        ],
      },
    });

    const slugs = library.capabilities.map((item) => item.slug);
    expect(slugs).toContain('auth.login-with-env-credentials');
    expect(slugs).toContain('ui.select-antd-option');
    expect(slugs).toContain('ui.click-antd-row-action');
    expect(slugs).toContain('navigation.enter-iframe-context');
    expect(slugs).toContain('assert.wait-for-api-response');
    expect(slugs).toContain('extract.capture-shared-variable');
  });

  it('allows project knowledge to force specific capabilities into the library', () => {
    const library = selectIntentActionLibrary({
      dsl: buildIntentActionDSL({
        taskMode: 'page',
        targetUrl: 'https://example.com/home',
        featureDescription: '访问首页并查看概览',
        expectedOutcome: '概览可见',
      }),
      snapshot: { url: 'https://example.com/home', title: '首页', frames: [] },
      preferredCapabilitySlugs: ['ui.select-antd-option', 'assert.wait-for-api-response'],
    });

    const slugs = library.capabilities.map((item) => item.slug);
    expect(slugs).toContain('ui.select-antd-option');
    expect(slugs).toContain('assert.wait-for-api-response');
  });

  it('renders helper examples for prompt injection', () => {
    const rendered = renderIntentActionLibrary(
      selectIntentActionLibrary({
        dsl: buildIntentActionDSL({
          taskMode: 'scenario',
          targetUrl: 'https://example.com/checkout',
          featureDescription: '选择来源并提交',
          expectedOutcome: '提交成功',
          steps: [
            {
              stepUid: 'step_1',
              stepType: 'ui',
              title: '填写结算信息',
              target: 'https://example.com/checkout',
              instruction: '通过下拉选择来源=抖音并提交',
              expectedResult: '提交成功',
              extractVariable: '',
            },
          ],
        }),
        auth: {
          loginUrl: 'https://example.com/login',
          username: '13800138000',
          password: '123456',
          loginDescription: '短信登录',
        },
        snapshot: { url: 'https://example.com/checkout', title: '结算页', frames: [] },
      })
    );

    expect(rendered).toContain('## 高频动作库（优先复用）');
    expect(rendered).toContain('__e2e.ensureLoggedIn');
    expect(rendered).toContain('__e2e.selectAntdOption');
    expect(rendered).toContain('示例骨架');
  });
});
