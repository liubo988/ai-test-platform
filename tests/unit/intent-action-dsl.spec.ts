import { describe, expect, it } from 'vitest';
import { buildIntentActionDSL, renderIntentActionDSL } from '@/lib/intent-action-dsl';

describe('intent-action-dsl', () => {
  it('builds dropdown and row-action helper constraints from scenario steps', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/business/list',
      featureDescription: '在商机列表选择来源并点击生成订单',
      expectedOutcome: 'createOrder 接口成功',
      successCriteria: ['createOrder 接口返回 200', '订单 Drawer 关闭'],
      sharedVariables: ['businessId'],
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'ui',
          title: '筛选并操作目标商机',
          target: 'https://example.com/business/list',
          instruction: '在列表中通过下拉选择来源=抖音，并在目标行点击生成订单',
          expectedResult: '目标商机进入生成订单流程',
          extractVariable: 'businessId',
        },
      ],
    });

    expect(dsl.steps[0].allowedActions).toContain('select_option');
    expect(dsl.steps[0].allowedActions).toContain('click_row_action');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.selectAntdOption');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.clickAntdRowAction');
    expect(dsl.globalRules.join('\n')).toContain('共享变量只能来自真实页面/API 提取');
  });

  it('renders a readable DSL section for prompt injection', () => {
    const rendered = renderIntentActionDSL(
      buildIntentActionDSL({
        taskMode: 'page',
        targetUrl: 'https://example.com/checkout',
        featureDescription: '填写手机号后提交并看到成功页',
        expectedOutcome: '成功页出现',
      })
    );

    expect(rendered).toContain('## 执行动作约束 DSL');
    expect(rendered).toContain('推荐原语：');
    expect(rendered).toContain('输出契约：');
    expect(rendered).toContain('DSL Step 1');
  });
});
