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

function parseJsonFromText<T>(raw: string, label: string): T {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${label} 返回为空`);
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]) as T;
    }
    throw new Error(`${label} 返回的内容不是合法 JSON: ${trimmed.slice(0, 240)}`);
  }
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
  const resp = await createResponsesRequest(
    {
      model: config.model,
      instructions: systemPrompt || 'You are a senior Playwright E2E testing expert.',
      input: prompt,
      stream: true,
      temperature: 0.3,
    },
    getResponsesRequestOptions(config, signal)
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

  const resp = await fetch(url, {
    method: 'POST',
    headers: getHeaders(config),
    body: JSON.stringify({ model: config.model, messages, stream: true, temperature: 0.3 }),
    signal,
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
  const resp = await createResponsesRequest(
    {
      model: config.model,
      instructions: systemPrompt || 'You are a helpful assistant.',
      input: prompt,
      temperature: 0.3,
    },
    getResponsesRequestOptions(config, signal)
  );

  const data = await resp.json();
  return extractResponsesText(data);
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

  const resp = await fetch(url, {
    method: 'POST',
    headers: getHeaders(config),
    body: JSON.stringify({ model: config.model, messages, temperature: 0.3 }),
    signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`LLM 请求失败: ${resp.status} ${errText}`);
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content || '';
}

export async function callLLMStructured<T>(
  request: StructuredLLMRequest<T>,
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal
): Promise<T> {
  const config = getRuntimeConfig(runtimeOverrides);
  if (prefersResponsesApi(config)) {
    return callLLMStructuredResponses<T>(request, config, signal);
  }
  return callLLMStructuredChat<T>(request, config, signal);
}

async function callLLMStructuredResponses<T>(
  request: StructuredLLMRequest<T>,
  config: LLMRuntimeConfig,
  signal?: AbortSignal
): Promise<T> {
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
    getResponsesRequestOptions(config, signal)
  );

  const data = await resp.json();
  return parseJsonFromText<T>(extractResponsesText(data), '结构化 LLM');
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
    signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`LLM 请求失败: ${resp.status} ${errText}`);
  }

  const json = await resp.json();
  return parseJsonFromText<T>(json.choices?.[0]?.message?.content || '', '结构化 LLM');
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
