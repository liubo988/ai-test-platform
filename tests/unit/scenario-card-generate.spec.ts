import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callLLMStructured } from '@/lib/llm-client';
import { getLLMRuntimeConfig } from '@/lib/llm/provider-config';
import { generateScenarioCard } from '@/lib/ai/scenario-card';

vi.mock('@/lib/llm-client', () => ({
  callLLMStructured: vi.fn(),
}));

vi.mock('@/lib/llm/provider-config', () => ({
  getLLMRuntimeConfig: vi.fn(),
}));

describe('scenario-card generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLLMRuntimeConfig).mockReturnValue({
      provider: 'openai',
      model: 'chat-gpt5.4',
      visionEnabled: true,
      maxPlanSteps: 6,
    } as never);
  });

  it('injects OCR anchors into prompt generation and final normalized card', async () => {
    vi.mocked(callLLMStructured)
      .mockResolvedValueOnce({
        visualAnchors: ['客户列表搜索框', '客户详情抽屉'],
        textSnippets: ['客户详情抽屉标题清晰可见'],
      } as never)
      .mockResolvedValueOnce({
        version: 1,
        title: '核对客户信息',
        taskMode: 'scenario',
        targetUrl: 'https://example.com/#/customer/list',
        featureDescription: '核对目标客户的详情信息',
        successCriteria: ['目标客户信息可见'],
        visualAnchors: [],
        notes: [],
        flowDefinition: {
          version: 1,
          entryUrl: 'https://example.com/#/customer/list',
          sharedVariables: [],
          expectedOutcome: '看到目标客户信息',
          cleanupNotes: '',
          steps: [
            {
              stepUid: 'step_search_customer',
              stepType: 'ui',
              title: '搜索客户',
              target: '当前页面',
              instruction: '输入客户编号后查询目标客户',
              expectedResult: '结果区出现目标客户',
              extractVariable: '',
            },
            {
              stepUid: 'step_open_customer',
              stepType: 'ui',
              title: '打开客户详情',
              target: '目标记录',
              instruction: '打开目标客户详情',
              expectedResult: '客户详情可见',
              extractVariable: '',
            },
          ],
        },
      } as never);

    const result = await generateScenarioCard({
      input: '核对客户信息',
      targetUrlHint: 'https://example.com/#/customer/list',
      attachments: [
        {
          name: 'customer.png',
          purpose: '详情截图',
          dataUrl: 'data:image/png;base64,aaa',
        },
      ],
    });

    expect(vi.mocked(callLLMStructured)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(callLLMStructured).mock.calls[0]?.[0]).toMatchObject({
      schemaName: 'intent_attachment_ocr_summary',
    });
    expect(vi.mocked(callLLMStructured).mock.calls[1]?.[0]).toMatchObject({
      schemaName: 'scenario_card',
      prompt: expect.stringContaining('截图 OCR 文字锚点'),
    });
    expect(result.card.visualAnchors).toEqual(expect.arrayContaining(['客户列表搜索框', '客户详情抽屉']));
    expect(result.card.notes.some((note) => note.includes('附件文字锚点：'))).toBe(true);
    expect(result.card.notes.some((note) => note.includes('不要搜索后直接点击第一行'))).toBe(true);
    expect(result.card.flowDefinition.steps[0]?.instruction).toContain('等待表格刷新并重新定位目标行');
  });
});
