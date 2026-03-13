import fs from 'node:fs';
import path from 'node:path';
import { createResponsesRequest } from '../lib/openai-responses.js';

const root = process.cwd();
const casesPath = path.join(root, 'edge-cases', 'cases.json');
const outDir = path.join(root, 'tests', 'integration', 'generated');

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'api-proxy-codex/gpt-5.3-codex';
const RESPONSES_RETRY_DELAY_MS = Number(process.env.OPENAI_RETRY_DELAY_MS || 350);
const RESPONSES_MAX_ATTEMPTS = Math.max(1, Number(process.env.OPENAI_RESPONSES_MAX_ATTEMPTS || 2));

if (!fs.existsSync(casesPath)) {
  console.error('cases.json not found');
  process.exit(1);
}

const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const grouped = new Map();
for (const c of cases) {
  if (c.status !== 'new' && c.status !== 'active') continue;
  if (!c.module) continue;
  if (!grouped.has(c.module)) grouped.set(c.module, []);
  grouped.get(c.module).push(c);
}

function safeName(input) {
  return String(input).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function inferFallbackSpec(moduleName, moduleCases) {
  const imports = `import { describe, it, expect } from 'vitest';\nimport { validateCheckoutPhone } from '../../../src/checkout.js';\n`;
  const body = moduleCases
    .map((c) => {
      const phone = c?.input?.phone ?? '';
      const shouldPass = String(c.expected || '').includes('通过校验');
      return `  it(${JSON.stringify(`${c.id} ${c.title}`)}, () => {\n    const result = validateCheckoutPhone(${JSON.stringify(phone)});\n    expect(result.ok).toBe(${shouldPass});\n  });`;
    })
    .join('\n\n');

  return `${imports}\ndescribe(${JSON.stringify(`generated edge cases: ${moduleName}`)}, () => {\n${body}\n});\n`;
}

function extractCode(text) {
  if (!text) return '';
  const fenced = text.match(/```(?:ts|typescript)?\n([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : text.trim();
}

const RESPONSES_REQUEST_OPTIONS = {
  baseUrl: OPENAI_BASE_URL,
  apiKey: OPENAI_API_KEY,
  isAzure: OPENAI_BASE_URL.includes('.openai.azure.com'),
  retryDelayMs: RESPONSES_RETRY_DELAY_MS,
  maxAttempts: RESPONSES_MAX_ATTEMPTS,
};

async function generateWithOpenAI(moduleName, moduleCases) {
  const prompt = [
    'You generate ONLY executable Vitest TypeScript spec code.',
    'Return a single test file and nothing else.',
    'Rules:',
    "1) Use: import { describe, it, expect } from 'vitest'",
    '2) Keep tests deterministic and side-effect free',
    '3) Do not modify source files',
    "4) If module/function path is unknown, assume: import { validateCheckoutPhone } from '../../../src/checkout.js'",
    '5) Use clear describe/it names that include edge-case ids',
    '',
    `Module: ${moduleName}`,
    `Edge cases JSON:\n${JSON.stringify(moduleCases, null, 2)}`,
  ].join('\n');

  const resp = await createResponsesRequest({
    model: OPENAI_MODEL,
    temperature: 0.1,
    instructions: 'You are a senior SDET generating high-quality Vitest tests.',
    input: prompt,
  }, RESPONSES_REQUEST_OPTIONS);

  const data = await resp.json();
  const content = data?.output_text || data?.output?.[0]?.content?.[0]?.text;
  const code = extractCode(content);
  if (!code.includes('describe(') || !code.includes('it(')) {
    throw new Error('LLM returned non-test content');
  }
  return `${code.trim()}\n`;
}

let llmUsed = false;
for (const [moduleName, moduleCases] of grouped.entries()) {
  let spec;
  try {
    if (OPENAI_API_KEY) {
      spec = await generateWithOpenAI(moduleName, moduleCases);
      llmUsed = true;
    } else {
      spec = inferFallbackSpec(moduleName, moduleCases);
    }
  } catch (err) {
    console.warn(`[warn] LLM generation failed for ${moduleName}, fallback used: ${err.message}`);
    spec = inferFallbackSpec(moduleName, moduleCases);
  }

  fs.writeFileSync(path.join(outDir, `${safeName(moduleName)}.spec.ts`), spec, 'utf8');
}

const summary = {
  generatedModules: grouped.size,
  generatedAt: new Date().toISOString(),
  llmUsed,
  model: llmUsed ? OPENAI_MODEL : 'fallback-template',
};

fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports', 'generation-summary.json'), JSON.stringify(summary, null, 2));

console.log(`Generated tests for ${grouped.size} module(s). llmUsed=${llmUsed}`);
