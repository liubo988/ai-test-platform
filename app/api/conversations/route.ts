import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getExecution, getTestConfigByUid, listExecutionArtifacts, listExecutionEvents, listLlmConversations } from '@/lib/db/repository';
import {
  buildExecutionConversationArtifactSidecarsByUid,
  buildExecutionConversationSidecarsBySummary,
  hydrateExecutionWorkspaceContextWithFallback,
  resolveExecutionWorkspaceContextFromArtifactMeta,
} from '@/lib/execution-workspace-link-contract';
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

    const configRecord = scene === 'plan_generation' ? await getTestConfigByUid(refUid) : null;
    const executionRecord = scene === 'plan_execution' ? await getExecution(refUid) : null;
    const projectUid =
      scene === 'plan_generation' ? configRecord?.projectUid || '' : executionRecord?.projectUid || '';
    if (!projectUid) {
      return NextResponse.json({ error: scene === 'plan_generation' ? '任务不存在' : '执行任务不存在' }, { status: 404 });
    }
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看对话记录');

    const items = await listLlmConversations(scene, refUid);
    const executionConfig = scene === 'plan_execution' && executionRecord ? await getTestConfigByUid(executionRecord.configUid) : null;
    const executionArtifacts = scene === 'plan_execution' ? await listExecutionArtifacts(refUid) : [];
    const executionEvents = scene === 'plan_execution' ? await listExecutionEvents(refUid) : [];
    const generatedSpecArtifact = executionArtifacts.find((item) => item.artifactType === 'generated_spec') || null;
    const executionContext =
      scene === 'plan_execution' && executionRecord
        ? resolveExecutionWorkspaceContextFromArtifactMeta({
            executionUid: refUid,
            executionProjectUid: executionRecord.projectUid,
            configProjectUid: executionConfig?.projectUid,
            moduleUid: executionConfig?.moduleUid,
            configUid: executionRecord.configUid,
            generatedSpecArtifactMeta: generatedSpecArtifact?.meta,
          })
        : null;
    const conversationSidecarsBySummary = scene === 'plan_execution' ? buildExecutionConversationSidecarsBySummary(executionEvents) : null;
    const conversationArtifactSidecarsByUid =
      scene === 'plan_execution' ? buildExecutionConversationArtifactSidecarsByUid(items, executionArtifacts) : null;
    return applyActorCookie(
      NextResponse.json({
        items:
          executionContext && scene === 'plan_execution'
            ? items.map((item) => {
                const conversationSidecar = conversationSidecarsBySummary?.get(String(item.content || '').trim()) || null;
                return {
                  ...item,
                  executionContext: hydrateExecutionWorkspaceContextWithFallback(
                    conversationSidecar?.executionContext,
                    executionContext
                  ),
                  nextExecutionContext: conversationSidecar?.nextExecutionContext || null,
                  executionEventContext: conversationSidecar?.executionEventContext || null,
                  executionArtifactContext: conversationArtifactSidecarsByUid?.get(item.conversationUid) || null,
                };
              })
            : items,
      }),
      actor.userUid
    );
  } catch (error: unknown) {
    return toErrorResponse(error, '获取对话失败');
  }
}
