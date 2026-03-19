import { NextRequest, NextResponse } from 'next/server';
import { normalizeIntentE2ERequestBody } from '@/lib/ai/intent-e2e-request';
import { runIntentDrivenE2E } from '@/lib/ai/intent-e2e-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = normalizeIntentE2ERequestBody(body);

    if (!request.input) {
      return NextResponse.json({ error: '缺少 input 参数' }, { status: 400 });
    }

    const result = await runIntentDrivenE2E(request, { signal: req.signal });
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI 意图驱动 E2E 执行失败' },
      { status: 500 }
    );
  }
}
