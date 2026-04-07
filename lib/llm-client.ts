import { createResponsesRequest, getOpenAIHeaders } from './openai-responses.js';
import {
  assertSupportedLLMProvider,
  getLLMRuntimeConfig,
  type LLMRuntimeConfig,
  type LLMRuntimeOverrides,
} from './llm/provider-config';

interface StreamChunk {
  type: 'text';
  content: string;
}

export interface StructuredLLMRequest<T> {
  prompt: string;
  systemPrompt?: string;
  schemaName: string;
  schema: Record<string, unknown>;
  imageDataUrls?: string[];
  temperature?: number;
  maxOutputTokens?: number;
}

class StructuredLLMParseError extends Error {
  rawPreview: string;

  constructor(label: string, raw: string, cause?: unknown) {
    const preview = String(raw || '').trim().slice(0, 240);
    const causeMessage = cause instanceof Error && cause.message ? `: ${cause.message}` : '';
    super(`${label} 返回的内容不是合法 JSON${causeMessage}${preview ? `；片段=${preview}` : ''}`);
    this.name = 'StructuredLLMParseError';
    this.rawPreview = preview;
  }
}

function getRuntimeConfig(runtimeOverrides?: LLMRuntimeOverrides): LLMRuntimeConfig {
  const config = getLLMRuntimeConfig(runtimeOverrides);
  assertSupportedLLMProvider(config);
  return config;
}

function getHeaders(config: LLMRuntimeConfig): Record<string, string> {
  return getOpenAIHeaders({ apiKey: config.apiKey, isAzure: config.isAzure });
}

function prefersResponsesApi(config: LLMRuntimeConfig): boolean {
  if (config.apiStyle === 'responses') return true;
  if (config.apiStyle === 'chat') return false;
  return /codex/i.test(config.model);
}

function getResponsesRequestOptions(config: LLMRuntimeConfig, signal?: AbortSignal) {
  return {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    isAzure: config.isAzure,
    retryDelayMs: config.responsesRetryDelayMs,
    maxAttempts: config.responsesMaxAttempts,
    signal,
  };
}

function buildResponsesInput(prompt: string, imageDataUrls?: string[]) {
  const images = (imageDataUrls || []).filter(Boolean);
  if (images.length === 0) return prompt;

  return [
    {
      role: 'user',
      content: [
        { type: 'input_text', text: prompt },
        ...images.map((imageUrl) => ({
          type: 'input_image' as const,
          image_url: imageUrl,
          detail: 'high' as const,
        })),
      ],
    },
  ];
}

function buildChatUserContent(prompt: string, imageDataUrls?: string[]) {
  const images = (imageDataUrls || []).filter(Boolean);
  if (images.length === 0) return prompt;

  return [
    { type: 'text', text: prompt },
    ...images.map((imageUrl) => ({
      type: 'image_url' as const,
      image_url: {
        url: imageUrl,
        detail: 'high' as const,
      },
    })),
  ];
}

function parseJsonCandidate<T>(candidate: string, label: string, raw: string): T {
  try {
    return JSON.parse(candidate) as T;
  } catch (error) {
    throw new StructuredLLMParseError(label, raw, error);
  }
}

function parseJsonFromText<T>(raw: string, label: string): T {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new StructuredLLMParseError(label, raw);
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      return parseJsonCandidate<T>(match[0], label, raw);
    }
    throw new StructuredLLMParseError(label, raw);
  }
}

function resolveStructuredRetryMaxOutputTokens(request: StructuredLLMRequest<unknown>, attempt: number): number | undefined {
  if (attempt <= 1) {
    return request.maxOutputTokens;
  }

  const baseMaxOutputTokens = Math.max(1, Number(request.maxOutputTokens ?? 1600));
  return Math.max(baseMaxOutputTokens * 2, baseMaxOutputTokens + 1600);
}

function extractResponsesText(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (typeof block?.text === 'string' && block.text.trim()) {
        return block.text;
      }
    }
  }

  return '';
}

function buildLLMRequestTimeoutMessage(timeoutMs: number): string {
  return `LLM 请求超时 (${timeoutMs}ms)`;
}

function createLLMRequestTimeoutContext(config: LLMRuntimeConfig, parentSignal?: AbortSignal): {
  signal?: AbortSignal;
  didTimeout: () => boolean;
  cleanup: () => void;
} {
  const timeoutMs = Math.max(0, Number(config.requestTimeoutMs || 0));
  if (timeoutMs <= 0) {
    return {
      signal: parentSignal,
      didTimeout: () => false,
      cleanup: () => {},
    };
  }

  const controller = new AbortController();
  let timedOut = false;

  const abortWithReason = (reason?: unknown) => {
    if (controller.signal.aborted) return;
    try {
      controller.abort(reason);
    } catch {
      controller.abort();
    }
  };

  const onParentAbort = () => {
    abortWithReason(parentSignal?.reason);
  };

  if (parentSignal?.aborted) {
    onParentAbort();
  } else {
    parentSignal?.addEventListener('abort', onParentAbort, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    abortWithReason(new Error(buildLLMRequestTimeoutMessage(timeoutMs)));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener('abort', onParentAbort);
    },
  };
}

function normalizeLLMRequestError(error: unknown, config: LLMRuntimeConfig, didTimeout: boolean): unknown {
  if (didTimeout) {
    return new Error(buildLLMRequestTimeoutMessage(Math.max(0, Number(config.requestTimeoutMs || 0))));
  }
  return error;
}

export async function* callLLMStream(
  prompt: string,
  systemPrompt?: string,
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  const config = getRuntimeConfig(runtimeOverrides);
  if (prefersResponsesApi(config)) {
    yield* callLLMStreamResponses(prompt, systemPrompt, config, signal);
  } else {
    yield* callLLMStreamChat(prompt, systemPrompt, config, signal);
  }
}

async function* callLLMStreamResponses(
  prompt: string,
  systemPrompt: string | undefined,
  config: LLMRuntimeConfig,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  const timeoutContext = createLLMRequestTimeoutContext(config, signal);
  try {
    const resp = await createResponsesRequest(
      {
        model: config.model,
        instructions: systemPrompt || 'You are a senior Playwright E2E testing expert.',
        input: prompt,
        stream: true,
        temperature: 0.3,
      },
      getResponsesRequestOptions(config, timeoutContext.signal)
    );

    const reader = resp.body?.getReader();
    if (!reader) throw new Error('LLM 响应无可读流');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          if (json.type === 'response.output_text.delta' && json.delta) {
            yield { type: 'text', content: json.delta };
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }
  } catch (error) {
    throw normalizeLLMRequestError(error, config, timeoutContext.didTimeout());
  } finally {
    timeoutContext.cleanup();
  }
}

async function* callLLMStreamChat(
  prompt: string,
  systemPrompt: string | undefined,
  config: LLMRuntimeConfig,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  const url = `${config.baseUrl}/chat/completions`;
  const messages = [
    { role: 'system', content: systemPrompt || 'You are a senior Playwright E2E testing expert.' },
    { role: 'user', content: prompt },
  ];

  const timeoutContext = createLLMRequestTimeoutContext(config, signal);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: getHeaders(config),
      body: JSON.stringify({ model: config.model, messages, stream: true, temperature: 0.3 }),
      signal: timeoutContext.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`LLM 请求失败: ${resp.status} ${errText}`);
    }

    const reader = resp.body?.getReader();
    if (!reader) throw new Error('LLM 响应无可读流');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) yield { type: 'text', content };
        } catch {
          // ignore malformed chunks
        }
      }
    }
  } catch (error) {
    throw normalizeLLMRequestError(error, config, timeoutContext.didTimeout());
  } finally {
    timeoutContext.cleanup();
  }
}

export async function callLLM(
  prompt: string,
  systemPrompt?: string,
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal
): Promise<string> {
  const config = getRuntimeConfig(runtimeOverrides);
  if (prefersResponsesApi(config)) {
    return callLLMResponses(prompt, systemPrompt, config, signal);
  }
  return callLLMChat(prompt, systemPrompt, config, signal);
}

async function callLLMResponses(
  prompt: string,
  systemPrompt: string | undefined,
  config: LLMRuntimeConfig,
  signal?: AbortSignal
): Promise<string> {
  const timeoutContext = createLLMRequestTimeoutContext(config, signal);
  try {
    const resp = await createResponsesRequest(
      {
        model: config.model,
        instructions: systemPrompt || 'You are a helpful assistant.',
        input: prompt,
        temperature: 0.3,
      },
      getResponsesRequestOptions(config, timeoutContext.signal)
    );

    const data = await resp.json();
    return extractResponsesText(data);
  } catch (error) {
    throw normalizeLLMRequestError(error, config, timeoutContext.didTimeout());
  } finally {
    timeoutContext.cleanup();
  }
}

async function callLLMChat(
  prompt: string,
  systemPrompt: string | undefined,
  config: LLMRuntimeConfig,
  signal?: AbortSignal
): Promise<string> {
  const url = `${config.baseUrl}/chat/completions`;
  const messages = [
    { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
    { role: 'user', content: prompt },
  ];
  const timeoutContext = createLLMRequestTimeoutContext(config, signal);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: getHeaders(config),
      body: JSON.stringify({ model: config.model, messages, temperature: 0.3 }),
      signal: timeoutContext.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`LLM 请求失败: ${resp.status} ${errText}`);
    }

    const json = await resp.json();
    return json.choices?.[0]?.message?.content || '';
  } catch (error) {
    throw normalizeLLMRequestError(error, config, timeoutContext.didTimeout());
  } finally {
    timeoutContext.cleanup();
  }
}

export async function callLLMStructured<T>(
  request: StructuredLLMRequest<T>,
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal
): Promise<T> {
  const config = getRuntimeConfig(runtimeOverrides);
  const maxParseAttempts = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxParseAttempts; attempt += 1) {
    try {
      const effectiveRequest =
        attempt <= 1
          ? request
          : {
              ...request,
              maxOutputTokens: resolveStructuredRetryMaxOutputTokens(request, attempt),
            };
      const runner = prefersResponsesApi(config)
        ? () => callLLMStructuredResponses<T>(effectiveRequest, config, signal)
        : () => callLLMStructuredChat<T>(effectiveRequest, config, signal);
      return await runner();
    } catch (error) {
      if (error instanceof StructuredLLMParseError && attempt < maxParseAttempts) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('结构化 LLM 调用失败');
}

async function callLLMStructuredResponses<T>(
  request: StructuredLLMRequest<T>,
  config: LLMRuntimeConfig,
  signal?: AbortSignal
): Promise<T> {
  const timeoutContext = createLLMRequestTimeoutContext(config, signal);
  try {
    const resp = await createResponsesRequest(
      {
        model: config.model,
        instructions: request.systemPrompt || 'You are a strict JSON generator.',
        input: buildResponsesInput(request.prompt, config.visionEnabled ? request.imageDataUrls : []),
        text: {
          format: {
            type: 'json_schema',
            name: request.schemaName,
            strict: true,
            schema: request.schema,
          },
        },
        temperature: request.temperature ?? 0.2,
        max_output_tokens: request.maxOutputTokens ?? 1600,
      },
      getResponsesRequestOptions(config, timeoutContext.signal)
    );

    const data = await resp.json();
    return parseJsonFromText<T>(extractResponsesText(data), '结构化 LLM');
  } catch (error) {
    throw normalizeLLMRequestError(error, config, timeoutContext.didTimeout());
  } finally {
    timeoutContext.cleanup();
  }
}

async function callLLMStructuredChat<T>(
  request: StructuredLLMRequest<T>,
  config: LLMRuntimeConfig,
  signal?: AbortSignal
): Promise<T> {
  const url = `${config.baseUrl}/chat/completions`;
  const messages = [
    { role: 'system', content: request.systemPrompt || 'You are a strict JSON generator.' },
    { role: 'user', content: buildChatUserContent(request.prompt, config.visionEnabled ? request.imageDataUrls : []) },
  ];
  const timeoutContext = createLLMRequestTimeoutContext(config, signal);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: getHeaders(config),
      body: JSON.stringify({
        model: config.model,
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: request.schemaName,
            strict: true,
            schema: request.schema,
          },
        },
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxOutputTokens ?? 1600,
      }),
      signal: timeoutContext.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`LLM 请求失败: ${resp.status} ${errText}`);
    }

    const json = await resp.json();
    return parseJsonFromText<T>(json.choices?.[0]?.message?.content || '', '结构化 LLM');
  } catch (error) {
    throw normalizeLLMRequestError(error, config, timeoutContext.didTimeout());
  } finally {
    timeoutContext.cleanup();
  }
}

export function getPublicLLMConfig(runtimeOverrides?: LLMRuntimeOverrides) {
  const config = getLLMRuntimeConfig(runtimeOverrides);
  return {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    apiStyle: config.apiStyle,
    visionEnabled: config.visionEnabled,
    selfHealRetries: config.selfHealRetries,
    maxPlanSteps: config.maxPlanSteps,
    providerImplemented: config.provider === 'openai',
  };
}
