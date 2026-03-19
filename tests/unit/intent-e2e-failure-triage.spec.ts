import { describe, expect, it } from 'vitest';
import { classifyIntentE2EFailure, formatIntentE2EFailureTriage } from '@/lib/ai/intent-e2e-failure-triage';

describe('intent-e2e-failure-triage', () => {
  it('classifies transient environment failures as non-repairable', () => {
    const triage = classifyIntentE2EFailure(
      {
        success: false,
        duration: 1200,
        steps: [
          {
            title: '搜索服务',
            status: 'failed',
            duration: 1200,
            error: '搜索结果接口暂时异常，页面提示“服务开小差了，请稍后重试...”',
          },
        ],
        error: '服务开小差了，请稍后重试...',
      },
      [{ level: 'error', message: '接口暂时异常，建议稍后重试' }]
    );

    expect(triage).toMatchObject({
      failureClass: 'env_transient',
      repairable: false,
    });
    expect(formatIntentE2EFailureTriage(triage!)).toContain('环境阻塞');
    expect(triage?.matchedSignals).toContain('服务开小差');
  });

  it('classifies assertion-driven expect failures as repairable assertion issues', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 900,
      steps: [
        {
          title: '验证保存结果',
          status: 'failed',
          duration: 900,
          error: 'expect(received).toBeTruthy()\n\nReceived: false',
        },
      ],
      error: 'expect(received).toBeTruthy()\n\nReceived: false',
    });

    expect(triage).toMatchObject({
      failureClass: 'assertion_too_strict',
      repairable: true,
    });
  });

  it('classifies locator drift as repairable selector issues', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 800,
      steps: [
        {
          title: '点击提交',
          status: 'failed',
          duration: 800,
          error: 'locator not found',
        },
      ],
      error: 'locator(".ant-btn-primary").first() locator not found',
    });

    expect(triage).toMatchObject({
      failureClass: 'selector_drift',
      repairable: true,
    });
  });

  it('classifies no-result business errors as non-repairable data issues', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 1000,
      steps: [
        {
          title: '搜索目标服务',
          status: 'failed',
          duration: 1000,
          error: '关键词 999999999999 当前未返回任何服务数据',
        },
      ],
      error: '关键词 999999999999 当前未返回任何服务数据',
    });

    expect(triage).toMatchObject({
      failureClass: 'data_missing',
      repairable: false,
    });
    expect(triage?.matchedSignals).toContain('未返回服务数据');
  });
});
