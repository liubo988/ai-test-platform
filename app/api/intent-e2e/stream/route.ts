import { NextRequest, NextResponse } from 'next/server';
import { normalizeIntentE2ERequestBody } from '@/lib/ai/intent-e2e-request';
import { runIntentDrivenE2EStream, type IntentE2EStreamEvent } from '@/lib/ai/intent-e2e-service';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { resolveIntentE2EProjectAuth } from '@/lib/server/intent-e2e-project-auth';
import { applyActorCookie, toErrorResponse } from '@/lib/server/project-actor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toSSEPayload(payload: IntentE2EStreamEvent): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function createAbortError(message = '当前自动测试已取消'): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export async function POST(req: NextRequest) {
  let request;
  let actorUserUid: string | undefined;

  try {
    request = normalizeIntentE2ERequestBody(await req.json());
  } catch {
    return NextResponse.json({ error: '请求体必须是合法 JSON' }, { status: 400 });
  }

  if (!request.input) {
    return NextResponse.json({ error: '缺少 input 参数' }, { status: 400 });
  }

  try {
    await ensureDbBootstrap();
    request = {
      ...request,
      llmConfig: mergeLLMRuntimeOverrides(await getWorkspaceLLMRuntimeOverrides(), request.llmConfig),
    };
    ({ request, actorUserUid } = await resolveIntentE2EProjectAuth(req, request));
  } catch (error: unknown) {
    return toErrorResponse(error, '启动 AI 意图驱动 E2E 流失败');
  }

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const onRequestAbort = () => abortController.abort(createAbortError('客户端已中断当前自动测试'));
  req.signal.addEventListener('abort', onRequestAbort, { once: true });

  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: IntentE2EStreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(toSSEPayload(payload)));
      };

      const sendComment = (comment: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ${comment}\n\n`));
      };

      heartbeat = setInterval(() => {
        sendComment('ping');
      }, 15000);

      try {
        send({
          type: 'stage',
          stage: 'received',
          message: '请求已收到，正在启动 AI E2E 流程…',
        });

        await runIntentDrivenE2EStream(
          request,
          async (event) => {
            send(event);
          },
          { signal: abortController.signal }
        );
      } catch (error: unknown) {
        const aborted = abortController.signal.aborted || req.signal.aborted || (error instanceof Error && error.name === 'AbortError');
        if (!aborted) {
          send({
            type: 'error',
            message: error instanceof Error ? error.message : 'AI 意图驱动 E2E 执行失败',
          });
        }
      } finally {
        req.signal.removeEventListener('abort', onRequestAbort);
        if (heartbeat) clearInterval(heartbeat);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {}
        }
      }
    },
    cancel() {
      closed = true;
      abortController.abort(createAbortError('客户端已关闭流式连接'));
      req.signal.removeEventListener('abort', onRequestAbort);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  const response = new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });

  return actorUserUid ? applyActorCookie(response, actorUserUid) : response;
}
