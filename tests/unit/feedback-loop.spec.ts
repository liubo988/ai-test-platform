import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/llm-client', () => ({
  callLLM: vi.fn(),
}));

import { callLLM } from '@/lib/llm-client';
import { handleTestFailure } from '../../lib/feedback-loop';

describe('feedback-loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes runtime overrides through to the llm client', async () => {
    vi.mocked(callLLM).mockResolvedValue('{"isEdgeCase":false,"reason":"定位器失败"}');

    const result = await handleTestFailure(
      "test('ok', async () => {});",
      'locator timeout',
      'https://app.example.com/dashboard',
      '登录后检查额度信息',
      {
        model: 'shared-model',
        apiStyle: 'chat',
      }
    );

    expect(callLLM).toHaveBeenCalledWith(
      expect.stringContaining('分析以下 Playwright E2E 测试失败'),
      undefined,
      {
        model: 'shared-model',
        apiStyle: 'chat',
      }
    );
    expect(result).toEqual({
      saved: false,
      reason: '定位器失败',
    });
  });
});
