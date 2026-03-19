import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/llm/workspace-config', () => ({
  getWorkspaceLLMRuntimeOverrides: vi.fn(),
  mergeLLMRuntimeOverrides: vi.fn((base?: Record<string, unknown>, override?: Record<string, unknown>) => ({
    ...(base || {}),
    ...(override || {}),
  })),
}));

vi.mock('@/lib/feedback-loop', () => ({
  handleTestFailure: vi.fn(),
}));

import { POST } from '../../app/api/feedback/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { handleTestFailure } from '@/lib/feedback-loop';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';

describe('POST /api/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses shared llm config when analyzing feedback failures', async () => {
    vi.mocked(getWorkspaceLLMRuntimeOverrides).mockResolvedValue({
      model: 'shared-model',
      apiStyle: 'chat',
    } as never);
    vi.mocked(handleTestFailure).mockResolvedValue({
      saved: false,
      reason: '非业务边缘问题',
    } as never);

    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        testCode: "test('ok')",
        error: 'locator timeout',
        url: 'https://app.example.com/dashboard',
        description: '登录后检查额度信息',
        llmConfig: {
          selfHealRetries: 2,
        },
      }),
    });

    const res = await POST(req);

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(getWorkspaceLLMRuntimeOverrides).toHaveBeenCalledTimes(1);
    expect(mergeLLMRuntimeOverrides).toHaveBeenCalledWith(
      {
        model: 'shared-model',
        apiStyle: 'chat',
      },
      {
        selfHealRetries: 2,
      }
    );
    expect(handleTestFailure).toHaveBeenCalledWith(
      "test('ok')",
      'locator timeout',
      'https://app.example.com/dashboard',
      '登录后检查额度信息',
      {
        model: 'shared-model',
        apiStyle: 'chat',
        selfHealRetries: 2,
      }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      saved: false,
      reason: '非业务边缘问题',
    });
  });
});
