import { NextRequest } from 'next/server';
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

vi.mock('@/lib/test-generator', () => ({
  generateTest: vi.fn(),
}));

import { POST } from '../../app/api/generate/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { generateTest } from '@/lib/test-generator';

async function* createGenerateStream() {
  yield { type: 'thinking' as const, content: '正在生成' };
  yield { type: 'complete' as const, content: "test('ok', async () => {});" };
}

describe('POST /api/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges shared llm config before generating a script', async () => {
    vi.mocked(getWorkspaceLLMRuntimeOverrides).mockResolvedValue({
      model: 'shared-model',
      apiStyle: 'chat',
    } as never);
    vi.mocked(generateTest).mockReturnValue(createGenerateStream() as never);

    const snapshot = {
      url: 'https://app.example.com/dashboard',
      title: 'Dashboard',
      bodyTextExcerpt: '额度信息',
      forms: [],
      buttons: [],
      links: [],
      frames: [],
    };
    const req = new NextRequest('http://localhost/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        snapshot,
        description: '  登录后校验首页额度信息  ',
        auth: {
          loginUrl: 'https://login.example.com',
          username: 'owner@example.com',
          password: 'secret',
          loginDescription: '统一密码登录',
        },
        llmConfig: {
          selfHealRetries: 3,
        },
      }),
    });

    const res = await POST(req);
    const text = await res.text();

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(getWorkspaceLLMRuntimeOverrides).toHaveBeenCalledTimes(1);
    expect(mergeLLMRuntimeOverrides).toHaveBeenCalledWith(
      {
        model: 'shared-model',
        apiStyle: 'chat',
      },
      {
        selfHealRetries: 3,
      }
    );
    expect(generateTest).toHaveBeenCalledWith(
      snapshot,
      '登录后校验首页额度信息',
      {
        loginUrl: 'https://login.example.com',
        username: 'owner@example.com',
        password: 'secret',
        loginDescription: '统一密码登录',
      },
      undefined,
      {
        model: 'shared-model',
        apiStyle: 'chat',
        selfHealRetries: 3,
      }
    );
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(text).toContain('"type":"complete"');
  });
});
