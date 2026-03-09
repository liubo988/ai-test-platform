import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { listLlmConversations } from '@/lib/db/repository';

export async function GET(req: NextRequest) {
  try {
    await ensureDbBootstrap();
    const { searchParams } = new URL(req.url);
    const scene = searchParams.get('scene');
    const refUid = searchParams.get('refUid');

    if (!scene || !refUid) {
      return NextResponse.json({ error: '缺少参数: scene/refUid' }, { status: 400 });
    }

    if (scene !== 'plan_generation' && scene !== 'plan_execution') {
      return NextResponse.json({ error: 'scene 仅支持 plan_generation/plan_execution' }, { status: 400 });
    }

    const items = await listLlmConversations(scene, refUid);
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取对话失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
