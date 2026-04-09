import { callLLMStructured } from '@/lib/llm-client';
import type { LLMRuntimeOverrides } from '@/lib/llm/provider-config';

export interface IntentAttachmentOcrAttachment {
  name?: string;
  dataUrl: string;
  purpose?: string;
}

export interface IntentAttachmentOcrSummary {
  visualAnchors: string[];
  textSnippets: string[];
}

export const EMPTY_INTENT_ATTACHMENT_OCR_SUMMARY: IntentAttachmentOcrSummary = {
  visualAnchors: [],
  textSnippets: [],
};

function normalizeStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of value) {
    const item = typeof raw === 'string' ? raw.trim() : '';
    if (!item || seen.has(item)) continue;
    seen.add(item);
    items.push(item);
    if (items.length >= max) break;
  }

  return items;
}

function normalizeIntentAttachmentOcrSummary(raw: unknown): IntentAttachmentOcrSummary {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    visualAnchors: normalizeStringArray(source.visualAnchors, 6),
    textSnippets: normalizeStringArray(source.textSnippets, 4),
  };
}

function buildIntentAttachmentOcrPrompt(input: {
  requestInput: string;
  targetUrlHint?: string;
  attachments: IntentAttachmentOcrAttachment[];
}): string {
  const attachmentMeta = input.attachments
    .map((item, index) => `- 图片 ${index + 1}: 名称=${item.name || `attachment-${index + 1}`}；用途=${item.purpose || '未标注'}`)
    .join('\n');

  return [
    '你是一个用于 Intent E2E 场景规划前置处理的轻量 OCR / 视觉文字摘要器。',
    '',
    '目标：',
    '1. 只提取截图里稳定、可见、对页面识别有帮助的文字锚点。',
    '2. 优先提取：页面标题、tab 名、按钮名、抽屉/弹层标题、表格列名、筛选标签、状态文案。',
    '3. 不要猜测不可见内容，不要编造业务数据，不要输出执行步骤。',
    '4. visualAnchors 输出短语级锚点；textSnippets 输出 1-4 条更完整的文字摘要。',
    '',
    `目标 URL Hint: ${input.targetUrlHint?.trim() || '未提供'}`,
    '',
    '用户输入：',
    input.requestInput.trim(),
    '',
    '图片附件：',
    attachmentMeta || '- 无',
  ].join('\n');
}

function buildIntentAttachmentOcrSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['visualAnchors', 'textSnippets'],
    properties: {
      visualAnchors: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 6,
      },
      textSnippets: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 4,
      },
    },
  };
}

export async function extractIntentAttachmentOcrSummary(
  input: {
    requestInput: string;
    targetUrlHint?: string;
    attachments?: IntentAttachmentOcrAttachment[];
  },
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal
): Promise<IntentAttachmentOcrSummary> {
  const attachments = (input.attachments || []).filter((item) => typeof item?.dataUrl === 'string' && item.dataUrl.trim()).slice(0, 4);
  if (attachments.length === 0) {
    return EMPTY_INTENT_ATTACHMENT_OCR_SUMMARY;
  }

  const raw = await callLLMStructured<IntentAttachmentOcrSummary>(
    {
      prompt: buildIntentAttachmentOcrPrompt({
        requestInput: input.requestInput,
        targetUrlHint: input.targetUrlHint,
        attachments,
      }),
      systemPrompt: 'You extract only visible textual anchors from screenshots for downstream E2E scenario planning.',
      schemaName: 'intent_attachment_ocr_summary',
      schema: buildIntentAttachmentOcrSchema(),
      imageDataUrls: attachments.map((item) => item.dataUrl),
      temperature: 0,
      maxOutputTokens: 600,
    },
    runtimeOverrides,
    signal
  );

  return normalizeIntentAttachmentOcrSummary(raw);
}
