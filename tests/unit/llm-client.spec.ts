import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function setResponsesEnv() {
  process.env.OPENAI_MODEL = 'gpt-5.3-codex';
  process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.AZURE_OPENAI_API_KEY = '';
  process.env.OPENAI_RETRY_DELAY_MS = '0';
}

describe('llm-client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    Object.assign(process.env, ORIGINAL_ENV);
    setResponsesEnv();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it('retries a streaming responses request when the first attempt hits the reasoning item error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message:
                "Item 'rs_07beae22e654bada0069b120bfaf4c8194bd6fd36f63192b50' of type 'reasoning' was provided without its required following item.",
              type: 'invalid_request_error',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          [
            `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: '```javascript\\n' })}`,
            `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: "test('ok', async ({ page }) => {\\n" })}`,
            `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: "  await page.goto('https://example.com');\\n" })}`,
            `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: '});\\n```' })}`,
            'data: [DONE]',
            '',
          ].join('\n'),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      );

    vi.stubGlobal('fetch', fetchMock);

    const { callLLMStream } = await import('@/lib/llm-client');
    const chunks: string[] = [];
    for await (const chunk of callLLMStream('repair prompt')) {
      chunks.push(chunk.content);
    }

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(chunks.join('')).toContain("test('ok'");
  });

  it('retries a non-stream responses request and prefers output_text when present', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message:
                "Item 'rs_07beae22e654bada0069b120bfaf4c8194bd6fd36f63192b50' of type 'reasoning' was provided without its required following item.",
              type: 'invalid_request_error',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ output_text: '{"isEdgeCase":false}' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const { callLLM } = await import('@/lib/llm-client');
    const response = await callLLM('analyze prompt');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response).toBe('{"isEdgeCase":false}');
  });
});
