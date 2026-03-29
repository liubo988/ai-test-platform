import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('llm-client structured', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    Object.assign(process.env, ORIGINAL_ENV);
    process.env.LLM_PROVIDER = 'openai';
    process.env.LLM_MODEL = 'chat-gpt5.4';
    process.env.LLM_BASE_URL = 'https://api.openai.com/v1';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_API_STYLE = 'responses';
    process.env.OPENAI_RETRY_DELAY_MS = '0';
    process.env.OPENAI_RESPONSES_MAX_ATTEMPTS = '1';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it('sends json_schema and image input when requesting a structured response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ output_text: '{"title":"ok","passed":true}' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const { callLLMStructured } = await import('@/lib/llm-client');
    const result = await callLLMStructured<{ title: string; passed: boolean }>({
      prompt: '根据图片总结场景卡',
      schemaName: 'demo_card',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'passed'],
        properties: {
          title: { type: 'string' },
          passed: { type: 'boolean' },
        },
      },
      imageDataUrls: ['data:image/png;base64,abc123'],
    });

    const [, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(init?.body || '{}'));

    expect(result).toEqual({ title: 'ok', passed: true });
    expect(payload.text.format.type).toBe('json_schema');
    expect(payload.text.format.name).toBe('demo_card');
    expect(Array.isArray(payload.input)).toBe(true);
    expect(payload.input[0].content[1].type).toBe('input_image');
  });

  it('retries once when structured JSON parsing fails before succeeding', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ output_text: '{"title":"broken","passed":tru' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ output_text: '{"title":"recovered","passed":true}' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const { callLLMStructured } = await import('@/lib/llm-client');
    const result = await callLLMStructured<{ title: string; passed: boolean }>({
      prompt: '返回严格 JSON',
      schemaName: 'retry_demo',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'passed'],
        properties: {
          title: { type: 'string' },
          passed: { type: 'boolean' },
        },
      },
    });

    expect(result).toEqual({ title: 'recovered', passed: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, firstInit] = fetchMock.mock.calls[0];
    const [, secondInit] = fetchMock.mock.calls[1];
    const firstPayload = JSON.parse(String(firstInit?.body || '{}'));
    const secondPayload = JSON.parse(String(secondInit?.body || '{}'));

    expect(secondPayload.max_output_tokens).toBeGreaterThan(firstPayload.max_output_tokens);
  });
});
