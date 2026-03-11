import { describe, expect, it } from 'vitest';
import { buildPrompt } from '../../lib/test-generator';
import { buildFlowSummary } from '../../lib/task-flow';

describe('test-generator prompt builder', () => {
  it('emphasizes exact field metadata and detailed scenario steps', () => {
    const prompt = buildPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [
          {
            action: '',
            method: 'GET',
            fields: [
              {
                type: 'text',
                name: '',
                id: 'createBusinessBaseInfo_contactInfo[0].people',
                placeholder: '请输入商机联系人',
                required: true,
                label: '商机联系人',
              },
            ],
          },
        ],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '验证创建商机主链路',
      {
        loginUrl: 'https://uat.example.com/#/',
        loginDescription: '选择短信验证码登陆tab页，“获取验证码”输入框 输入登陆密码，然后点击登陆。',
      },
      [],
      '',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        sharedVariables: ['contactPhone'],
        expectedOutcome: '创建成功并可在列表检索',
        cleanupNotes: '记录商机ID供人工清理',
        scenarioSummary: buildFlowSummary(
          {
            version: 1,
            entryUrl: 'https://uat.example.com/#/business/createbusiness',
            sharedVariables: ['contactPhone'],
            expectedOutcome: '创建成功并可在列表检索',
            cleanupNotes: '记录商机ID供人工清理',
            steps: [
              {
                stepUid: 'step-1',
                stepType: 'ui',
                title: '填写第一页',
                target: 'https://uat.example.com/#/business/createbusiness',
                instruction: '选择商机来源=抖音，填写商机联系人、商机联系方式、性别',
                expectedResult: '进入第二页',
                extractVariable: 'contactPhone',
              },
            ],
          },
          { includeInstruction: true, includeExpectedResult: true, includeExtractVariable: true }
        ),
      }
    );

    expect(prompt).toContain('placeholder=请输入商机联系人');
    expect(prompt).toContain('动作: 选择商机来源=抖音，填写商机联系人、商机联系方式、性别');
    expect(prompt).toContain('必须原样使用');
    expect(prompt).toContain('不要退化成“请输入联系人”');
  });
});
