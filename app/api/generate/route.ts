import { NextRequest, NextResponse } from 'next/server';
import { normalizeIntentE2ERequestBody } from '@/lib/ai/intent-e2e-request';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import type { LLMRuntimeOverrides } from '@/lib/llm/provider-config';
import type { AuthConfig, PageSnapshot } from '@/lib/page-analyzer';
import { generateTest } from '@/lib/test-generator';

export async function POST(req: NextRequest) {
  let snapshot: PageSnapshot | undefined;
  let description = '';
  let auth: AuthConfig | undefined;
  let llmConfig: LLMRuntimeOverrides | undefined;

  try {
    const body = ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;
    const normalized = normalizeIntentE2ERequestBody({
      input: body.description,
      auth: body.auth,
      llmConfig: body.llmConfig,
    });

    snapshot = body.snapshot as PageSnapshot | undefined;
    description = normalized.input;
    auth = normalized.auth;
    await ensureDbBootstrap();
    llmConfig = mergeLLMRuntimeOverrides(await getWorkspaceLLMRuntimeOverrides(), normalized.llmConfig);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '初始化测试脚本生成失败' },
      { status: 500 }
    );
  }

  if (!snapshot) {
    return NextResponse.json({ error: '缺少 snapshot 参数' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generateTest(snapshot, description, auth, undefined, llmConfig)) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      } catch (err: any) {
        const data = `data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`;
        controller.enqueue(encoder.encode(data));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
