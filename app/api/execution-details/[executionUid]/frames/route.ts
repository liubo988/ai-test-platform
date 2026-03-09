import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getExecutionDetail } from '@/lib/services/test-plan-service';

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

    const sessionId = detail.execution.workerSessionId;
    const framesDir = path.join(ROOT, 'data', 'frames', sessionId);

    // Check if frame param requests a specific frame image
    const frameIndex = req.nextUrl.searchParams.get('frame');
    if (frameIndex) {
      const framePath = path.join(framesDir, `${frameIndex.padStart(6, '0')}.jpg`);
      try {
        const data = await fs.readFile(framePath);
        return new NextResponse(data, {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      } catch {
        return NextResponse.json({ error: '帧不存在' }, { status: 404 });
      }
    }

    // List all available frames
    try {
      const files = await fs.readdir(framesDir);
      const frames = files
        .filter((f) => f.endsWith('.jpg'))
        .sort()
        .map((f) => parseInt(f.replace('.jpg', ''), 10));
      return NextResponse.json({ sessionId, frames, total: frames.length });
    } catch {
      return NextResponse.json({ sessionId, frames: [], total: 0 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取帧数据失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ executionUid: string }> }
) {
  try {
    await ensureDbBootstrap();
    const { executionUid } = await ctx.params;
    const detail = await getExecutionDetail(executionUid);
    if (!detail) {
      return NextResponse.json({ error: '执行任务不存在' }, { status: 404 });
    }

    const sessionId = detail.execution.workerSessionId;
    const framesDir = path.join(ROOT, 'data', 'frames', sessionId);
    await fs.rm(framesDir, { recursive: true }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '删除帧数据失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
