import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getIntentE2ERun, listIntentE2ERunEvents, loadIntentE2ERun, subscribeIntentE2ERun } from '@/lib/ai/intent-e2e-run-registry';
import type { IntentE2EStreamEvent } from '@/lib/ai/intent-e2e-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const SNAPSHOT_POLL_INTERVAL_MS = 1200;

function toSSEPayload(payload: IntentE2EStreamEvent): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function toCursor(req: NextRequest): number {
  const rawCursor = req.nextUrl.searchParams.get('cursor');
  const cursor = rawCursor ? Number(rawCursor) : 0;

  if (!Number.isFinite(cursor) || cursor < 0) {
    return 0;
  }

  return Math.floor(cursor);
}

function isTerminalStatus(status: string): boolean {
  return status === 'passed' || status === 'failed' || status === 'canceled';
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  await ensureDbBootstrap();
  const { runId } = await ctx.params;
  const existingRun = await loadIntentE2ERun(runId);
  const liveRun = getIntentE2ERun(runId);

  if (!existingRun) {
    return NextResponse.json({ error: '运行不存在' }, { status: 404 });
  }

  const cursor = toCursor(req);
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let snapshotPoller: ReturnType<typeof setInterval> | null = null;
  let snapshotPollInFlight = false;
  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let cleanup = () => {};
  let nextCursor = Math.max(0, cursor);

  const stream = new ReadableStream({
    start(controller) {
      cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (snapshotPoller) clearInterval(snapshotPoller);
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        req.signal.removeEventListener('abort', cleanup);
        try {
          controller.close();
        } catch {}
      };

      const send = (payload: IntentE2EStreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(toSSEPayload(payload)));
      };

      const sendComment = (comment: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ${comment}\n\n`));
      };

      const flushBacklog = (events: IntentE2EStreamEvent[]) => {
        if (events.length === 0) return;
        for (const event of events) {
          send(event);
        }
        nextCursor += events.length;
      };

      const flushRunEventsFromCursor = (run: { events: IntentE2EStreamEvent[] }) => {
        if (run.events.length <= nextCursor) return;
        const backlog = run.events.slice(nextCursor).map((event) => ({ ...event }));
        flushBacklog(backlog);
      };

      req.signal.addEventListener('abort', cleanup, { once: true });
      heartbeat = setInterval(() => {
        sendComment('ping');
      }, 15000);

      const backlog = liveRun
        ? listIntentE2ERunEvents(runId, cursor)
        : existingRun.events.slice(Math.max(0, cursor)).map((event) => ({ ...event }));
      flushBacklog(backlog);

      const latestRun = getIntentE2ERun(runId) || existingRun;
      if (!latestRun || isTerminalStatus(latestRun.status)) {
        cleanup();
        return;
      }

      unsubscribe = subscribeIntentE2ERun(runId, (event) => {
        send(event);
        nextCursor += 1;
        if (event.type === 'final_result' || event.type === 'error' || (event.type === 'stage' && event.stage === 'canceled')) {
          cleanup();
          return;
        }

        const currentRun = getIntentE2ERun(runId);
        if (!currentRun || isTerminalStatus(currentRun.status)) {
          cleanup();
        }
      });

      if (!unsubscribe) {
        snapshotPoller = setInterval(async () => {
          if (closed || snapshotPollInFlight) return;
          snapshotPollInFlight = true;
          try {
            const polledRun = await loadIntentE2ERun(runId);
            if (!polledRun) {
              cleanup();
              return;
            }

            flushRunEventsFromCursor(polledRun);
            if (isTerminalStatus(polledRun.status)) {
              cleanup();
            }
          } catch (error: unknown) {
            send({
              type: 'error',
              message: error instanceof Error ? error.message : '恢复自动测试运行流失败',
            });
            cleanup();
          } finally {
            snapshotPollInFlight = false;
          }
        }, SNAPSHOT_POLL_INTERVAL_MS);
        return;
      }

      const catchup = listIntentE2ERunEvents(runId, nextCursor);
      flushBacklog(catchup);
      const currentRun = getIntentE2ERun(runId);
      if (!currentRun || isTerminalStatus(currentRun.status)) {
        cleanup();
      }
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
