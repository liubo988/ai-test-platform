import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('provider-config', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, ORIGINAL_ENV);
  });

  afterEach(() => {
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it('prefers LLM_* values over legacy OPENAI_* values', async () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.LLM_MODEL = 'chat-gpt5.4';
    process.env.LLM_BASE_URL = 'https://proxy.example.com/v1';
    process.env.LLM_API_KEY = 'llm-key';
    process.env.LLM_API_STYLE = 'responses';
    process.env.LLM_VISION_ENABLED = 'false';
    process.env.LLM_SELF_HEAL_RETRIES = '3';
    process.env.LLM_MAX_PLAN_STEPS = '6';
    process.env.OPENAI_MODEL = 'gpt-4-turbo';

    const { getLLMRuntimeConfig } = await import('@/lib/llm/provider-config');
    const config = getLLMRuntimeConfig();

    expect(config.provider).toBe('openai');
    expect(config.model).toBe('chat-gpt5.4');
    expect(config.baseUrl).toBe('https://proxy.example.com/v1');
    expect(config.apiKey).toBe('llm-key');
    expect(config.apiStyle).toBe('responses');
    expect(config.visionEnabled).toBe(false);
    expect(config.selfHealRetries).toBe(3);
    expect(config.maxPlanSteps).toBe(6);
  });

  it('allows request-level runtime overrides without mutating server env', async () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.LLM_MODEL = 'server-default-model';
    process.env.LLM_BASE_URL = 'https://server.example.com/v1';
    process.env.LLM_VISION_ENABLED = 'true';
    process.env.LLM_SELF_HEAL_RETRIES = '2';
    process.env.LLM_MAX_PLAN_STEPS = '8';

    const { getLLMRuntimeConfig } = await import('@/lib/llm/provider-config');
    const config = getLLMRuntimeConfig({
      provider: 'openai',
      model: 'request-model',
      baseUrl: 'https://request.example.com/v1',
      apiStyle: 'chat',
      visionEnabled: false,
      selfHealRetries: 1,
      maxPlanSteps: 5,
    });

    expect(config.model).toBe('request-model');
    expect(config.baseUrl).toBe('https://request.example.com/v1');
    expect(config.apiStyle).toBe('chat');
    expect(config.visionEnabled).toBe(false);
    expect(config.selfHealRetries).toBe(1);
    expect(config.maxPlanSteps).toBe(5);
    expect(process.env.LLM_MODEL).toBe('server-default-model');
  });

  it('blocks future providers until an adapter is implemented', async () => {
    process.env.LLM_PROVIDER = 'claude';

    const { assertSupportedLLMProvider, getLLMRuntimeConfig } = await import('@/lib/llm/provider-config');
    expect(() => assertSupportedLLMProvider(getLLMRuntimeConfig())).toThrow(/只实现了 openai 适配器/);
  });
});
