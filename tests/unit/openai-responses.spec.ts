import { describe, expect, it, vi } from 'vitest';
import { createResponsesRequest, getOpenAIHeaders, isRetryableResponsesFailure } from '@/lib/openai-responses.js';

describe('openai-responses helper', () => {
  it('uses the Azure auth header when requested', () => {
    expect(getOpenAIHeaders({ apiKey: 'azure-key', isAzure: true })).toEqual({
      'api-key': 'azure-key',
      'Content-Type': 'application/json',
    });
  });

  it('retries a reasoning item failure before succeeding', async () => {
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: 'ok' }), { status: 200 }));

    const resp = await createResponsesRequest(
      { model: 'gpt-5.3-codex', input: 'hello' },
      {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        isAzure: false,
        retryDelayMs: 0,
        maxAttempts: 2,
        fetchImpl: fetchMock,
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(resp.ok).toBe(true);
    expect(await resp.json()).toEqual({ output_text: 'ok' });
  });

  it('marks the reasoning item error as retryable', () => {
    expect(
      isRetryableResponsesFailure(
        400,
        "Item 'rs_07beae22e654bada0069b120bfaf4c8194bd6fd36f63192b50' of type 'reasoning' was provided without its required following item."
      )
    ).toBe(true);
  });
});
