import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getExecution, getTestConfigByUid, listLlmConversations } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

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

    const projectUid =
      scene === 'plan_generation'
        ? (await getTestConfigByUid(refUid))?.projectUid || ''
        : (await getExecution(refUid))?.projectUid || '';
    if (!projectUid) {
      return NextResponse.json({ error: scene === 'plan_generation' ? '任务不存在' : '执行任务不存在' }, { status: 404 });
    }
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看对话记录');

    const items = await listLlmConversations(scene, refUid);
    return applyActorCookie(NextResponse.json({ items }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '获取对话失败');
  }
}
