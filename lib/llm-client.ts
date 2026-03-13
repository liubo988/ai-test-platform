import { createResponsesRequest, getOpenAIHeaders } from './openai-responses.js';

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo';
const IS_AZURE = OPENAI_BASE_URL.includes('.openai.azure.com');
const RESPONSES_RETRY_DELAY_MS = Number(process.env.OPENAI_RETRY_DELAY_MS || 350);
const RESPONSES_MAX_ATTEMPTS = Math.max(1, Number(process.env.OPENAI_RESPONSES_MAX_ATTEMPTS || 2));

// gpt-5.3-codex 等 Codex 模型只支持 Responses API，不支持 Chat Completions
const USE_RESPONSES_API = OPENAI_MODEL.includes('codex');

interface StreamChunk {
  type: 'text';
  content: string;
}

function getHeaders(): Record<string, string> {
  return getOpenAIHeaders({ apiKey: OPENAI_API_KEY, isAzure: IS_AZURE });
}

const RESPONSES_REQUEST_OPTIONS = {
  baseUrl: OPENAI_BASE_URL,
  apiKey: OPENAI_API_KEY,
  isAzure: IS_AZURE,
  retryDelayMs: RESPONSES_RETRY_DELAY_MS,
  maxAttempts: RESPONSES_MAX_ATTEMPTS,
};

/** 流式调用 LLM — 自动选择 Responses API 或 Chat Completions API */
export async function* callLLMStream(prompt: string, systemPrompt?: string): AsyncGenerator<StreamChunk> {
  if (USE_RESPONSES_API) {
    yield* callLLMStreamResponses(prompt, systemPrompt);
  } else {
    yield* callLLMStreamChat(prompt, systemPrompt);
  }
}

/** Responses API 流式调用（gpt-5.3-codex 等） */
async function* callLLMStreamResponses(prompt: string, systemPrompt?: string): AsyncGenerator<StreamChunk> {
  const resp = await createResponsesRequest(
    {
      model: OPENAI_MODEL,
      instructions: systemPrompt || 'You are a senior Playwright E2E testing expert.',
      input: prompt,
      stream: true,
      temperature: 0.3,
    },
    RESPONSES_REQUEST_OPTIONS
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
        // Responses API: response.output_text.delta 事件包含 delta 字段
        if (json.type === 'response.output_text.delta' && json.delta) {
          yield { type: 'text', content: json.delta };
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

/** Chat Completions API 流式调用（gpt-4 等标准模型） */
async function* callLLMStreamChat(prompt: string, systemPrompt?: string): AsyncGenerator<StreamChunk> {
  const url = `${OPENAI_BASE_URL}/chat/completions`;
  const messages = [
    { role: 'system', content: systemPrompt || 'You are a senior Playwright E2E testing expert.' },
    { role: 'user', content: prompt },
  ];

  const resp = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ model: OPENAI_MODEL, messages, stream: true, temperature: 0.3 }),
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

/** 非流式调用 LLM — 自动选择 API */
export async function callLLM(prompt: string, systemPrompt?: string): Promise<string> {
  if (USE_RESPONSES_API) {
    return callLLMResponses(prompt, systemPrompt);
  }
  return callLLMChat(prompt, systemPrompt);
}

/** Responses API 非流式调用 */
async function callLLMResponses(prompt: string, systemPrompt?: string): Promise<string> {
  const resp = await createResponsesRequest({
    model: OPENAI_MODEL,
    instructions: systemPrompt || 'You are a helpful assistant.',
    input: prompt,
    temperature: 0.3,
  }, RESPONSES_REQUEST_OPTIONS);

  const data = await resp.json();
  return data?.output_text || data?.output?.[0]?.content?.[0]?.text || '';
}

/** Chat Completions API 非流式调用 */
async function callLLMChat(prompt: string, systemPrompt?: string): Promise<string> {
  const url = `${OPENAI_BASE_URL}/chat/completions`;
  const messages = [
    { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
    { role: 'user', content: prompt },
  ];

  const resp = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ model: OPENAI_MODEL, messages, temperature: 0.3 }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`LLM 请求失败: ${resp.status} ${errText}`);
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content || '';
}
