import { NextRequest } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { listExecutionEvents } from '@/lib/db/repository';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ executionUid: string }> }) {
  await ensureDbBootstrap();
  const { executionUid } = await ctx.params;
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

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
