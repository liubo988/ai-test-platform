import { describe, expect, it, vi } from 'vitest';
import { callLLMStructured } from '@/lib/llm-client';
import {
  EMPTY_INTENT_ATTACHMENT_OCR_SUMMARY,
  extractIntentAttachmentOcrSummary,
} from '@/lib/ai/intent-attachment-ocr';

vi.mock('@/lib/llm-client', () => ({
  callLLMStructured: vi.fn(),
}));

describe('intent-attachment-ocr', () => {
  it('returns an empty summary without attachments', async () => {
    const result = await extractIntentAttachmentOcrSummary({
      requestInput: '核对客户信息',
      attachments: [],
    });

    expect(result).toEqual(EMPTY_INTENT_ATTACHMENT_OCR_SUMMARY);
    expect(vi.mocked(callLLMStructured)).not.toHaveBeenCalled();
  });

  it('extracts normalized OCR anchors from attachments', async () => {
    vi.mocked(callLLMStructured).mockResolvedValue({
      visualAnchors: ['客户列表搜索框', '客户详情抽屉', '客户详情抽屉'],
      textSnippets: ['客户详情抽屉标题', '当前页展示客户信息', '客户详情抽屉标题'],
    } as never);

    const result = await extractIntentAttachmentOcrSummary({
      requestInput: '核对客户信息',
      targetUrlHint: 'https://example.com/#/customer/list',
      attachments: [
        {
          name: 'customer.png',
          purpose: '详情截图',
          dataUrl: 'data:image/png;base64,aaa',
        },
      ],
    });

    expect(vi.mocked(callLLMStructured)).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: 'intent_attachment_ocr_summary',
        imageDataUrls: ['data:image/png;base64,aaa'],
        prompt: expect.stringContaining('客户信息'),
      }),
      undefined,
      undefined
    );
    expect(result).toEqual({
      visualAnchors: ['客户列表搜索框', '客户详情抽屉'],
      textSnippets: ['客户详情抽屉标题', '当前页展示客户信息'],
    });
  });
});
