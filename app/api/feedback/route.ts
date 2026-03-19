import { NextRequest, NextResponse } from 'next/server';
import { normalizeIntentE2ERequestBody } from '@/lib/ai/intent-e2e-request';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { handleTestFailure } from '@/lib/feedback-loop';

export async function POST(req: NextRequest) {
  try {
    const body = ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;
    const { llmConfig } = normalizeIntentE2ERequestBody({
      llmConfig: body.llmConfig,
    });

    await ensureDbBootstrap();
    const result = await handleTestFailure(
      String(body.testCode || ''),
      String(body.error || ''),
      String(body.url || ''),
      String(body.description || ''),
      mergeLLMRuntimeOverrides(await getWorkspaceLLMRuntimeOverrides(), llmConfig)
    );
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
