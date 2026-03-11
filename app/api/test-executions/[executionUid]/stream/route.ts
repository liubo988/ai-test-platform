import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getExecution, listExecutionEvents } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function GET(req: NextRequest, ctx: { params: Promise<{ executionUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { executionUid } = await ctx.params;
    const execution = await getExecution(executionUid);
    if (!execution) return NextResponse.json({ error: '执行任务不存在' }, { status: 404 });
    const { actor } = await requireProjectRole(req, execution.projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限订阅执行事件');

    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | null = null;
    let closed = false;
    let cursor = 0;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\\n\\n`));
        };

        timer = setInterval(async () => {
          if (closed) return;
          try {
            const events = await listExecutionEvents(executionUid);
            if (cursor < events.length) {
              for (const event of events.slice(cursor)) {
                send(event);
              }
              cursor = events.length;
            }
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'stream error';
            send({ eventType: 'error', payload: { message }, createdAt: new Date().toISOString() });
          }
        }, 1200);

        send({ eventType: 'connected', payload: { executionUid }, createdAt: new Date().toISOString() });
      },
      cancel() {
        closed = true;
        if (timer) clearInterval(timer);
      },
    });

    return applyActorCookie(new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '订阅执行事件失败');
  }
}
