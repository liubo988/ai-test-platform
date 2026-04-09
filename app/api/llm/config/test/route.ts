import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { toWorkspaceLLMSettingsInput } from '@/lib/llm/admin-config';
import { callLLMStructured, getPublicLLMConfig } from '@/lib/llm-client';
import { toWorkspaceLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { applyActorCookie, getRequestActor, RequestError, toErrorResponse } from '@/lib/server/project-actor';

function toPreview(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 240) return trimmed;
  return `${trimmed.slice(0, 240)}...`;
}

type LLMConfigProbeResult = {
  status: 'ok';
  summary: string;
};

export async function POST(req: NextRequest) {
  try {
    await ensureDbBootstrap();
    const actor = await getRequestActor(req);
    const body = (await req.json()) as Record<string, unknown> | null;

    if (!body) {
      throw new RequestError(400, '请求体不能为空');
    }

    const settingsInput = toWorkspaceLLMSettingsInput(body);
    if (settingsInput.provider !== 'openai') {
      throw new RequestError(400, '当前仅 openai provider 已实现在线测试');
    }
    if (!settingsInput.model) {
      throw new RequestError(400, '请先填写 model 再测试');
    }
    if (!settingsInput.baseUrl) {
      throw new RequestError(400, '请先填写 Base URL 再测试');
    }
    const runtimeOverrides = toWorkspaceLLMRuntimeOverrides(settingsInput);

    const startedAt = Date.now();
    const output = await callLLMStructured<LLMConfigProbeResult>(
      {
        prompt: '验证当前配置可用于结构化意图生成。返回 status=ok，summary 用不超过 12 个字说明已成功响应。',
        systemPrompt: '你是团队共享 LLM 配置连通性探针。只返回严格 JSON。',
        schemaName: 'llm_config_probe_result',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['status', 'summary'],
          properties: {
            status: {
              type: 'string',
              enum: ['ok'],
            },
            summary: {
              type: 'string',
              minLength: 1,
              maxLength: 12,
            },
          },
        },
        temperature: 0,
        maxOutputTokens: 120,
      },
      runtimeOverrides
    );

    return applyActorCookie(
      NextResponse.json({
        ok: true,
        llm: getPublicLLMConfig(runtimeOverrides),
        outputPreview: toPreview(JSON.stringify(output)),
        durationMs: Date.now() - startedAt,
      }),
      actor.userUid
    );
  } catch (error: unknown) {
    return toErrorResponse(error, '测试 LLM 配置失败');
  }
}
