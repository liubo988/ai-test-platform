import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getExecutionDetail } from '@/lib/services/test-plan-service';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

const ROOT = process.cwd();

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ executionUid: string }> }
) {
  try {
    await ensureDbBootstrap();
    const { executionUid } = await ctx.params;
    const detail = await getExecutionDetail(executionUid);
    if (!detail) {
      return NextResponse.json({ error: '执行任务不存在' }, { status: 404 });
    }
    const { actor } = await requireProjectRole(req, detail.execution.projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看执行回放');

    const sessionId = detail.execution.workerSessionId;
    const framesDir = path.join(ROOT, 'data', 'frames', sessionId);

    // Check if frame param requests a specific frame image
    const frameIndex = req.nextUrl.searchParams.get('frame');
    if (frameIndex) {
      const framePath = path.join(framesDir, `${frameIndex.padStart(6, '0')}.jpg`);
      try {
        const data = await fs.readFile(framePath);
        return applyActorCookie(new NextResponse(data, {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        }), actor.userUid);
      } catch {
        return applyActorCookie(NextResponse.json({ error: '帧不存在' }, { status: 404 }), actor.userUid);
      }
    }

    // List all available frames
    try {
      const files = await fs.readdir(framesDir);
      const frames = files
        .filter((f) => f.endsWith('.jpg'))
        .sort()
        .map((f) => parseInt(f.replace('.jpg', ''), 10));
      return applyActorCookie(NextResponse.json({ sessionId, frames, total: frames.length }), actor.userUid);
    } catch {
      return applyActorCookie(NextResponse.json({ sessionId, frames: [], total: 0 }), actor.userUid);
    }
  } catch (error: unknown) {
    return toErrorResponse(error, '获取帧数据失败');
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ executionUid: string }> }
) {
  try {
    await ensureDbBootstrap();
    const { executionUid } = await ctx.params;
    const detail = await getExecutionDetail(executionUid);
    if (!detail) {
      return NextResponse.json({ error: '执行任务不存在' }, { status: 404 });
    }
    const { actor } = await requireProjectRole(req, detail.execution.projectUid, ['owner', 'editor'], '当前操作者没有权限删除执行回放');

    const sessionId = detail.execution.workerSessionId;
    const framesDir = path.join(ROOT, 'data', 'frames', sessionId);
    await fs.rm(framesDir, { recursive: true }).catch(() => {});
    return applyActorCookie(NextResponse.json({ ok: true }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '删除帧数据失败');
  }
}
