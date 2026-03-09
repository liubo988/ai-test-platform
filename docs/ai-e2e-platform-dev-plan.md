# AI E2E 自动化测试平台 — Codex 开发计划

> 本文档是完整的开发执行计划，供 Codex / AI Agent 直接按步骤实施。

---

## 一、项目背景与目标

### 当前状态

项目根目录：`/Users/xiaolongbao/Documents/xxx项目`（npm 包名 `auto-test-platform`）

已有能力：
- `edge-cases/cases.json` — 市场反馈边缘用例的结构化存储
- `scripts/generate-tests.mjs` — 从 edge-case JSON 调用 OpenAI 兼容 API 生成 Vitest 单元测试
- `scripts/api-product-regression.mjs` — API 级别回归测试（登录 + 新增产品）
- `tests/e2e/product-create.spec.ts` — Playwright E2E 测试（登录 + 新增产品）
- `scripts/qa.mjs` — QA 流水线串行执行
- `.github/workflows/` — CI、Issue 入库、AI 生成测试 PR

LLM 配置（`.env`）：
```
OPENAI_MODEL=gpt-5.3-codex
OPENAI_BASE_URL=https://mengh-mih79m07-swedencentral.openai.azure.com/openai/v1
```
注意：使用的是 **Azure OpenAI**，API 鉴权用 `api-key` header 而非 `Authorization: Bearer`。

### 建设目标

构建 Web UI 平台：用户只需输入 URL + 功能描述（+ 可选登录凭证），系统自动：
1. Playwright 爬取分析目标页面
2. LLM 流式生成 Playwright E2E 测试代码
3. 执行测试并实时展示浏览器画面
4. 失败自动记录为边缘用例，下次生成时作为上下文（自增强闭环）

全程在一个页面内实时展示：LLM 对话、生成代码、浏览器画面、测试结果。

---

## 二、技术选型

| 模块 | 技术 | 说明 |
|------|------|------|
| Web 框架 | Next.js 15 (App Router) | 前后端一体 |
| 样式 | Tailwind CSS 3 | 快速开发 |
| 浏览器可视化 | CDP `Page.startScreencast` + WebSocket | VNC 级实时画面，无需 Docker |
| LLM | OpenAI SDK（Azure 兼容模式） | 沿用现有配置 |
| WebSocket | `ws` 库 + Next.js custom server | App Router 不原生支持 WS |
| 代码高亮 | `highlight.js` | 轻量，支持 TypeScript |

---

## 三、目录结构（仅新增文件）

```
auto-test-platform/
├── server.mjs                         # 自定义 Next.js 服务器（挂载 WebSocket）
├── next.config.mjs                    # Next.js 配置
├── tailwind.config.js                 # Tailwind 配置
├── postcss.config.js                  # PostCSS 配置
├── app/                               # Next.js App Router
│   ├── layout.tsx                     # 根布局
│   ├── globals.css                    # 全局样式（Tailwind directives）
│   ├── page.tsx                       # 主页面（单页四分屏）
│   └── api/
│       ├── analyze/route.ts           # POST: 页面分析
│       ├── generate/route.ts          # POST: LLM 流式生成（SSE）
│       ├── execute/route.ts           # POST: 执行测试
│       └── feedback/route.ts          # POST: 失败反馈入库
├── components/                        # React 组件
│   ├── URLInput.tsx                   # URL + 描述 + 凭证输入
│   ├── ChatPanel.tsx                  # LLM 对话流式展示
│   ├── ScriptViewer.tsx               # 代码实时展示（语法高亮）
│   ├── BrowserView.tsx                # 浏览器实时画面
│   └── TestResults.tsx                # 测试结果
├── lib/                               # 核心逻辑
│   ├── llm-client.ts                  # OpenAI/Azure LLM 封装
│   ├── page-analyzer.ts              # Playwright 页面爬取
│   ├── test-generator.ts             # Prompt + 测试生成
│   ├── test-executor.ts              # 测试执行 + CDP screencast
│   ├── screencast-manager.ts         # WebSocket 帧广播
│   └── feedback-loop.ts              # 失败分析 → edge-cases 入库
└── tests/e2e/generated/               # 生成的测试输出目录
```

**不修改的文件**：`scripts/*`、`src/*`、`tests/unit/*`、`tests/integration/*`、`tests/e2e/product-create.spec.ts`、`tests/e2e/smoke.spec.ts`、`playwright.config.ts`、`.github/*`

**需修改的文件**：`package.json`（加依赖和 scripts）、`tsconfig.json`（加 JSX/paths）、`.gitignore`（加 `.next/`）

---

## 四、分步实施

### 步骤 1：安装依赖 + 配置文件

#### 1.1 安装依赖

```bash
npm install next@latest react@latest react-dom@latest
npm install ws openai highlight.js
npm install -D @types/react @types/react-dom @types/ws tailwindcss@3 autoprefixer postcss
```

#### 1.2 创建 `next.config.mjs`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('playwright', '@playwright/test');
    }
    return config;
  },
};

export default nextConfig;
```

#### 1.3 创建 `tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

#### 1.4 创建 `postcss.config.js`

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

#### 1.5 修改 `tsconfig.json`

将整个内容替换为：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "types": ["node"],
    "outDir": "dist",
    "paths": {
      "@/*": ["./*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["src", "tests", "scripts", "app", "lib", "components", "next-env.d.ts"],
  "exclude": ["node_modules", ".next", "dist"]
}
```

#### 1.6 修改 `package.json` 的 scripts 部分

在现有 scripts 中**新增**以下条目（保留原有的不变）：

```json
"dev": "node server.mjs",
"build:web": "next build",
"start:web": "NODE_ENV=production node server.mjs"
```

#### 1.7 修改 `.gitignore`

追加以下行：

```
.next/
```

#### 1.8 创建 `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### 1.9 创建 `app/layout.tsx`

```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI E2E 测试平台',
  description: '输入 URL + 功能描述，自动生成并执行 E2E 测试',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
```

#### 1.10 创建 `server.mjs`（自定义服务器 + WebSocket）

```javascript
import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { WebSocketServer } from 'ws';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

// WebSocket 会话管理
const sessions = new Map(); // sessionId -> Set<WebSocket>

export function broadcastFrame(sessionId, base64Data) {
  const clients = sessions.get(sessionId);
  if (!clients) return;
  const msg = JSON.stringify({ type: 'frame', data: base64Data, ts: Date.now() });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// 导出给 lib/test-executor.ts 调用
globalThis.__broadcastFrame = broadcastFrame;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname, query } = parse(req.url, true);
    if (pathname === '/ws/screencast' && query.sessionId) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        const sid = query.sessionId;
        if (!sessions.has(sid)) sessions.set(sid, new Set());
        sessions.get(sid).add(ws);

        ws.on('close', () => {
          const s = sessions.get(sid);
          if (s) {
            s.delete(ws);
            if (s.size === 0) sessions.delete(sid);
          }
        });
      });
    } else {
      socket.destroy();
    }
  });

  server.listen(port, () => {
    console.log(`> AI E2E 测试平台已启动: http://localhost:${port}`);
  });
});
```

**验证**：运行 `npm run dev`，浏览器打开 `http://localhost:3000` 能看到空白页面即可。

---

### 步骤 2：核心 lib 模块

#### 2.1 创建 `lib/llm-client.ts`

需要同时支持 Azure OpenAI 和标准 OpenAI API。检测逻辑复用自现有 `scripts/generate-tests.mjs`。

```typescript
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo';
const IS_AZURE = OPENAI_BASE_URL.includes('.openai.azure.com');

interface StreamChunk {
  type: 'text';
  content: string;
}

function getHeaders(): Record<string, string> {
  if (IS_AZURE) {
    return { 'api-key': OPENAI_API_KEY, 'Content-Type': 'application/json' };
  }
  return { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' };
}

/** 流式调用 LLM（Chat Completions API） */
export async function* callLLMStream(prompt: string, systemPrompt?: string): AsyncGenerator<StreamChunk> {
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

  const reader = resp.body!.getReader();
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
      } catch {}
    }
  }
}

/** 非流式调用 LLM */
export async function callLLM(prompt: string, systemPrompt?: string): Promise<string> {
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
```

#### 2.2 创建 `lib/page-analyzer.ts`

分析目标页面，支持需要登录的页面。

```typescript
import { chromium, type Page, type Browser } from 'playwright';

export interface PageSnapshot {
  url: string;
  title: string;
  forms: FormInfo[];
  buttons: ButtonInfo[];
  links: LinkInfo[];
  headings: HeadingInfo[];
  screenshot: string; // base64 JPEG
}

interface FormInfo {
  action: string;
  method: string;
  fields: FieldInfo[];
}
interface FieldInfo {
  type: string;
  name: string;
  id: string;
  placeholder: string;
  required: boolean;
  label: string;
}
interface ButtonInfo { text: string; id: string; type: string }
interface LinkInfo { text: string; href: string }
interface HeadingInfo { level: string; text: string }

export interface AuthConfig {
  loginUrl?: string;
  username?: string;
  password?: string;
}

async function performLogin(page: Page, auth: AuthConfig): Promise<void> {
  if (!auth.loginUrl || !auth.username || !auth.password) return;

  await page.goto(auth.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  // 兼容多种登录表单（参考现有 tests/e2e/product-create.spec.ts 的模式）
  const passwordInput = page.getByPlaceholder(/请输入密码|Enter password|password/i);

  // 如果密码框不可见，尝试切换到密码登录
  if (!(await passwordInput.isVisible({ timeout: 3000 }).catch(() => false))) {
    const passwordTab = page.getByText(/密码登录|Password Login/i).first();
    if (await passwordTab.isVisible().catch(() => false)) {
      await passwordTab.click({ force: true });
    }
    await passwordInput.waitFor({ state: 'visible', timeout: 10_000 });
  }

  await page.getByPlaceholder(/请输入手机号|请输入邮箱|Enter your phone|Enter phone or email|username/i).fill(auth.username);
  await passwordInput.fill(auth.password);
  await page.getByRole('button', { name: /登录|Login|Sign in/i }).click();

  // 等待登录完成（URL 变化或出现主要内容）
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

export async function analyzePage(url: string, auth?: AuthConfig): Promise<PageSnapshot> {
  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  try {
    // 如果提供了登录信息，先登录
    if (auth?.loginUrl && auth?.username && auth?.password) {
      await performLogin(page, auth);
    }

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(2000); // 等待动态内容加载

    const title = await page.title();

    const forms: FormInfo[] = await page.$$eval('form', (formEls) =>
      formEls.map((f) => ({
        action: f.getAttribute('action') || '',
        method: f.getAttribute('method') || 'GET',
        fields: Array.from(f.querySelectorAll('input, select, textarea')).map((el) => {
          const input = el as HTMLInputElement;
          const labelEl = input.labels?.[0] || input.closest('label');
          return {
            type: input.type || el.tagName.toLowerCase(),
            name: input.name || '',
            id: input.id || '',
            placeholder: input.placeholder || '',
            required: input.required || false,
            label: labelEl?.textContent?.trim() || '',
          };
        }),
      }))
    );

    const buttons: ButtonInfo[] = await page.$$eval(
      'button, [role="button"], input[type="submit"]',
      (els) => els.slice(0, 30).map((el) => ({
        text: el.textContent?.trim() || '',
        id: el.id || '',
        type: (el as HTMLButtonElement).type || '',
      }))
    );

    const links: LinkInfo[] = await page.$$eval('a[href]', (els) =>
      els.slice(0, 20).map((el) => ({
        text: el.textContent?.trim() || '',
        href: el.getAttribute('href') || '',
      }))
    );

    const headings: HeadingInfo[] = await page.$$eval('h1,h2,h3', (els) =>
      els.map((el) => ({ level: el.tagName, text: el.textContent?.trim() || '' }))
    );

    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 75, fullPage: false });
    const screenshot = screenshotBuffer.toString('base64');

    await browser.close();
    return { url, title, forms, buttons, links, headings, screenshot };
  } catch (err: any) {
    await browser.close();
    throw new Error(`页面分析失败: ${err.message}`);
  }
}
```

#### 2.3 创建 `lib/test-generator.ts`

核心 Prompt 工程。使用现有 `tests/e2e/product-create.spec.ts` 作为 few-shot 范例。

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { callLLMStream } from './llm-client';
import type { PageSnapshot, AuthConfig } from './page-analyzer';

export interface GenerateEvent {
  type: 'thinking' | 'code' | 'complete' | 'error';
  content: string;
}

const ROOT = process.cwd();

async function loadEdgeCases(url: string): Promise<any[]> {
  try {
    const casesPath = path.join(ROOT, 'edge-cases', 'cases.json');
    const cases = JSON.parse(await fs.readFile(casesPath, 'utf8'));
    return cases.filter((c: any) => c.status === 'new' || c.status === 'active').slice(0, 10);
  } catch {
    return [];
  }
}

async function loadExistingExample(): Promise<string> {
  try {
    const examplePath = path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts');
    return await fs.readFile(examplePath, 'utf8');
  } catch {
    return '';
  }
}

function buildPrompt(
  snapshot: PageSnapshot,
  description: string,
  auth: AuthConfig | undefined,
  edgeCases: any[],
  existingExample: string
): string {
  const parts: string[] = [];

  parts.push(`你是一个 Playwright E2E 测试专家。请根据以下信息生成完整可执行的 Playwright 测试代码。`);

  parts.push(`\n## 目标页面信息
- URL: ${snapshot.url}
- 标题: ${snapshot.title}
- 表单: ${JSON.stringify(snapshot.forms, null, 2)}
- 按钮: ${JSON.stringify(snapshot.buttons, null, 2)}
- 标题层级: ${JSON.stringify(snapshot.headings)}
- 链接(前20): ${JSON.stringify(snapshot.links)}`);

  parts.push(`\n## 用户需求
${description}`);

  if (auth?.loginUrl) {
    parts.push(`\n## 登录信息
测试前需要先登录：
- 登录页: ${auth.loginUrl}
- 用户名通过 process.env.E2E_USERNAME 获取
- 密码通过 process.env.E2E_PASSWORD 获取
请在测试代码中包含登录步骤，使用 test.skip 在缺少凭证时跳过。`);
  }

  if (edgeCases.length > 0) {
    parts.push(`\n## 历史失败/边缘案例（请特别关注）
${edgeCases.map((c) => `- [${c.id}] ${c.title}: 输入=${JSON.stringify(c.input)}, 预期=${c.expected}`).join('\n')}`);
  }

  if (existingExample) {
    parts.push(`\n## 参考：现有项目中的真实测试代码（请参考其风格和模式）
\`\`\`typescript
${existingExample}
\`\`\``);
  }

  parts.push(`\n## 输出要求
1. 只输出纯 TypeScript 代码，用 \`\`\`typescript 包裹
2. 使用 import { test, expect } from '@playwright/test'
3. 定位器优先级: getByRole > getByPlaceholder > getByText > getByTestId > CSS
4. 中英文双语兼容定位（用正则如 /登录|Login/i）
5. 包含明确的 expect 断言
6. 包含合理的 timeout 和 waitFor
7. 如需登录，从 process.env 读取凭证，不硬编码`);

  return parts.join('\n');
}

export async function* generateTest(
  snapshot: PageSnapshot,
  description: string,
  auth?: AuthConfig
): AsyncGenerator<GenerateEvent> {
  yield { type: 'thinking', content: '正在加载历史边缘案例...' };
  const edgeCases = await loadEdgeCases(snapshot.url);
  yield { type: 'thinking', content: `找到 ${edgeCases.length} 个相关边缘案例` };

  yield { type: 'thinking', content: '正在加载现有测试范例...' };
  const existingExample = await loadExistingExample();

  yield { type: 'thinking', content: '正在构造 Prompt 并调用 LLM...' };
  const prompt = buildPrompt(snapshot, description, auth, edgeCases, existingExample);

  let fullCode = '';
  try {
    for await (const chunk of callLLMStream(prompt)) {
      fullCode += chunk.content;
      yield { type: 'code', content: chunk.content };
    }
  } catch (err: any) {
    yield { type: 'error', content: `LLM 调用失败: ${err.message}` };
    return;
  }

  // 提取代码块
  const match = fullCode.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
  const code = match ? match[1].trim() : fullCode.trim();

  if (!code.includes('test(') || !code.includes('expect(')) {
    yield { type: 'error', content: '生成的代码缺少 test() 或 expect()，请重试' };
    return;
  }

  yield { type: 'complete', content: code };
}
```

#### 2.4 创建 `lib/screencast-manager.ts`

```typescript
/** CDP screencast 帧广播到 WebSocket 客户端 */
export function broadcastFrame(sessionId: string, base64Data: string): void {
  // server.mjs 注册了 globalThis.__broadcastFrame
  const fn = (globalThis as any).__broadcastFrame;
  if (typeof fn === 'function') {
    fn(sessionId, base64Data);
  }
}
```

#### 2.5 创建 `lib/test-executor.ts`

```typescript
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { broadcastFrame } from './screencast-manager';

const ROOT = process.cwd();

export interface TestResult {
  success: boolean;
  duration: number;
  steps: StepResult[];
  error: string | null;
  savedPath: string | null;
}

interface StepResult {
  title: string;
  status: 'passed' | 'failed';
  duration: number;
}

export async function executeTest(
  code: string,
  sessionId: string
): Promise<TestResult> {
  const testId = `gen-${Date.now()}`;
  const tmpDir = path.join(ROOT, 'tests', 'e2e', 'generated');
  await fs.mkdir(tmpDir, { recursive: true });
  const testPath = path.join(tmpDir, `${testId}.spec.ts`);

  await fs.writeFile(testPath, code, 'utf8');

  // 启动带 CDP 的浏览器进行 screencast
  let browser;
  let cdpSession: any;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    cdpSession = await context.newCDPSession(page);

    await cdpSession.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 70,
      maxWidth: 1280,
      maxHeight: 720,
    });

    cdpSession.on('Page.screencastFrame', async (params: any) => {
      broadcastFrame(sessionId, params.data);
      await cdpSession.send('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => {});
    });
  } catch {
    // screencast 启动失败不影响测试执行
  }

  // 执行 Playwright 测试
  const result = await runTest(testPath);

  // 停止 screencast
  if (cdpSession) {
    await cdpSession.send('Page.stopScreencast').catch(() => {});
  }
  if (browser) {
    await browser.close().catch(() => {});
  }

  // 成功则保留文件，失败则清理
  if (result.success) {
    result.savedPath = testPath;
  } else {
    await fs.unlink(testPath).catch(() => {});
    result.savedPath = null;
  }

  return result;
}

function runTest(testPath: string): Promise<TestResult> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['playwright', 'test', testPath, '--reporter=json'], {
      cwd: ROOT,
      env: { ...process.env },
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });

    proc.on('close', (exitCode) => {
      let steps: StepResult[] = [];
      let duration = 0;

      try {
        const report = JSON.parse(stdout);
        duration = report.stats?.duration || 0;
        const spec = report.suites?.[0]?.specs?.[0];
        steps = (spec?.tests?.[0]?.results?.[0]?.steps || []).map((s: any) => ({
          title: s.title,
          status: s.error ? 'failed' : 'passed',
          duration: s.duration || 0,
        }));
      } catch {}

      resolve({
        success: exitCode === 0,
        duration,
        steps,
        error: exitCode !== 0 ? (stderr || '测试执行失败') : null,
        savedPath: null,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        duration: 0,
        steps: [],
        error: `进程启动失败: ${err.message}`,
        savedPath: null,
      });
    });
  });
}
```

#### 2.6 创建 `lib/feedback-loop.ts`

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { callLLM } from './llm-client';

const ROOT = process.cwd();
const CASES_PATH = path.join(ROOT, 'edge-cases', 'cases.json');

export interface FeedbackResult {
  saved: boolean;
  edgeCase?: any;
  reason?: string;
}

export async function handleTestFailure(
  testCode: string,
  error: string,
  url: string,
  description: string
): Promise<FeedbackResult> {
  // LLM 分析失败原因
  const analysis = await analyzeFailure(error, testCode, url);

  if (!analysis.isEdgeCase) {
    return { saved: false, reason: analysis.reason || '非业务边缘问题，不记录' };
  }

  // 读取现有 cases
  let cases: any[] = [];
  try {
    cases = JSON.parse(await fs.readFile(CASES_PATH, 'utf8'));
  } catch {}

  const nextNum = cases.length + 1;
  const edgeCase = {
    id: `EC-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`,
    title: analysis.title,
    module: analysis.module || 'general',
    input: analysis.input || {},
    expected: analysis.expected || '',
    severity: analysis.severity || 'medium',
    source: 'ai-test-feedback',
    status: 'new',
  };

  cases.push(edgeCase);
  await fs.writeFile(CASES_PATH, JSON.stringify(cases, null, 2), 'utf8');

  return { saved: true, edgeCase };
}

async function analyzeFailure(error: string, code: string, url: string): Promise<any> {
  const prompt = `分析以下 Playwright E2E 测试失败，判断是否为业务边缘案例。

## 错误
${error.slice(0, 2000)}

## 测试代码
${code.slice(0, 3000)}

## 目标 URL
${url}

## 判断标准
- 需要记录：业务逻辑边界（空输入、特殊字符、权限不足等）
- 不记录：定位器失败、超时、网络问题、CORS、环境配置

严格返回 JSON（不要 markdown 包裹）：
{"isEdgeCase":boolean,"reason":"简短说明","title":"边缘案例标题","module":"模块名","input":{},"expected":"预期行为","severity":"high|medium|low"}`;

  try {
    const resp = await callLLM(prompt);
    const match = resp.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { isEdgeCase: false, reason: 'LLM 返回格式异常' };
  } catch {
    return { isEdgeCase: false, reason: 'LLM 分析调用失败' };
  }
}
```

---

### 步骤 3：API 路由

#### 3.1 创建 `app/api/analyze/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { analyzePage } from '@/lib/page-analyzer';

export async function POST(req: NextRequest) {
  try {
    const { url, description, auth } = await req.json();
    if (!url) return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });

    const snapshot = await analyzePage(url, auth);
    return NextResponse.json({ snapshot });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

#### 3.2 创建 `app/api/generate/route.ts`（SSE 流式）

```typescript
import { NextRequest } from 'next/server';
import { generateTest } from '@/lib/test-generator';

export async function POST(req: NextRequest) {
  const { snapshot, description, auth } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generateTest(snapshot, description, auth)) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      } catch (err: any) {
        const data = `data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`;
        controller.enqueue(encoder.encode(data));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

#### 3.3 创建 `app/api/execute/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { executeTest } from '@/lib/test-executor';

export async function POST(req: NextRequest) {
  try {
    const { code, sessionId } = await req.json();
    if (!code) return NextResponse.json({ error: '缺少测试代码' }, { status: 400 });

    const result = await executeTest(code, sessionId || 'default');
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

#### 3.4 创建 `app/api/feedback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { handleTestFailure } from '@/lib/feedback-loop';

export async function POST(req: NextRequest) {
  try {
    const { testCode, error, url, description } = await req.json();
    const result = await handleTestFailure(testCode, error, url, description);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

### 步骤 4：前端组件

#### 4.1 创建 `components/URLInput.tsx`

```tsx
'use client';

import { useState } from 'react';

interface Props {
  onSubmit: (data: {
    url: string;
    description: string;
    auth?: { loginUrl: string; username: string; password: string };
  }) => void;
  isLoading: boolean;
}

export default function URLInput({ onSubmit, isLoading }: Props) {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [needAuth, setNeedAuth] = useState(false);
  const [loginUrl, setLoginUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      url,
      description,
      auth: needAuth ? { loginUrl, username, password } : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-5 space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">测试配置</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">目标 URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/products"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">功能描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例如：测试新增产品功能，填写产品名称和标签后提交"
          required
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={needAuth} onChange={(e) => setNeedAuth(e.target.checked)} className="rounded" />
          需要登录认证
        </label>
      </div>

      {needAuth && (
        <div className="space-y-3 p-3 bg-gray-50 rounded-md">
          <div>
            <label className="block text-sm text-gray-600 mb-1">登录页 URL</label>
            <input
              type="url"
              value={loginUrl}
              onChange={(e) => setLoginUrl(e.target.value)}
              placeholder="https://example.com/login"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !url || !description}
        className="w-full py-2.5 px-4 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
      >
        {isLoading ? '分析中...' : '开始生成测试'}
      </button>
    </form>
  );
}
```

#### 4.2 创建 `components/ChatPanel.tsx`

```tsx
'use client';

import { useEffect, useRef } from 'react';

export interface ChatMessage {
  type: 'thinking' | 'code' | 'complete' | 'error';
  content: string;
  timestamp: number;
}

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
}

export default function ChatPanel({ messages, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="bg-white rounded-lg shadow p-5 flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">LLM 对话</h2>
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400">等待开始...</p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-2.5 rounded text-sm ${
              msg.type === 'error'
                ? 'bg-red-50 text-red-700'
                : msg.type === 'thinking'
                ? 'bg-blue-50 text-blue-800'
                : msg.type === 'complete'
                ? 'bg-green-50 text-green-800'
                : 'bg-gray-50 text-gray-700'
            }`}
          >
            {msg.type === 'thinking' && <span className="font-medium">思考: </span>}
            {msg.type === 'error' && <span className="font-medium">错误: </span>}
            {msg.type === 'complete' && <span className="font-medium">完成: </span>}
            {msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content}
          </div>
        ))}
        {isStreaming && (
          <div className="p-2 text-sm text-gray-400 animate-pulse">正在生成...</div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
```

#### 4.3 创建 `components/ScriptViewer.tsx`

```tsx
'use client';

import { useEffect, useRef } from 'react';

interface Props {
  code: string;
  onExecute: () => void;
  isExecuting: boolean;
}

export default function ScriptViewer({ code, onExecute, isExecuting }: Props) {
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="bg-white rounded-lg shadow p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">生成代码</h2>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            disabled={!code}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            复制
          </button>
          <button
            onClick={onExecute}
            disabled={!code || isExecuting}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {isExecuting ? '执行中...' : '执行测试'}
          </button>
        </div>
      </div>
      <pre
        ref={codeRef}
        className="flex-1 overflow-auto bg-gray-900 text-green-400 p-4 rounded-md text-xs font-mono leading-relaxed min-h-[200px] max-h-[400px]"
      >
        {code || '// 等待生成...'}
      </pre>
    </div>
  );
}
```

#### 4.4 创建 `components/BrowserView.tsx`

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  sessionId: string;
  isActive: boolean;
}

export default function BrowserView({ sessionId, isActive }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const lastRender = useRef(0);

  useEffect(() => {
    if (!isActive) {
      setConnected(false);
      setFrameCount(0);
      return;
    }

    const wsUrl = `ws://${window.location.host}/ws/screencast?sessionId=${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const now = Date.now();
      if (now - lastRender.current < 33) return; // 限制 ~30fps
      lastRender.current = now;

      try {
        const { type, data } = JSON.parse(event.data);
        if (type === 'frame') {
          renderFrame(data);
          setFrameCount((c) => c + 1);
        }
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId, isActive]);

  const renderFrame = (base64: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = `data:image/jpeg;base64,${base64}`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">浏览器实时画面</h2>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className={`flex items-center gap-1 ${connected ? 'text-green-600' : 'text-gray-400'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
            {connected ? '已连接' : '未连接'}
          </span>
          {frameCount > 0 && <span>帧数: {frameCount}</span>}
        </div>
      </div>
      <div className="bg-gray-900 rounded-lg overflow-hidden relative">
        <canvas ref={canvasRef} width={1280} height={720} className="w-full h-auto" />
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 text-gray-400 text-sm">
            点击「执行测试」后显示浏览器实时画面
          </div>
        )}
      </div>
    </div>
  );
}
```

#### 4.5 创建 `components/TestResults.tsx`

```tsx
'use client';

import type { TestResult } from '@/lib/test-executor';

interface Props {
  result: TestResult | null;
  isExecuting: boolean;
  onRetry: () => void;
  feedbackStatus?: string;
}

export default function TestResults({ result, isExecuting, onRetry, feedbackStatus }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-5 flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">测试结果</h2>

      {isExecuting && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm text-gray-500">正在执行测试...</p>
          </div>
        </div>
      )}

      {!isExecuting && !result && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          等待执行...
        </div>
      )}

      {result && !isExecuting && (
        <div className="flex-1 space-y-3 overflow-y-auto">
          <div className={`p-3 rounded-md ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`text-lg font-bold ${result.success ? 'text-green-700' : 'text-red-700'}`}>
              {result.success ? '测试通过' : '测试失败'}
            </p>
            <p className="text-sm text-gray-600 mt-1">耗时: {(result.duration / 1000).toFixed(1)}s</p>
          </div>

          {result.steps.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">执行步骤:</p>
              {result.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span>{step.status === 'passed' ? '✓' : '✗'}</span>
                  <span className={step.status === 'passed' ? 'text-green-700' : 'text-red-700'}>
                    {step.title}
                  </span>
                  <span className="text-gray-400 text-xs ml-auto">{step.duration}ms</span>
                </div>
              ))}
            </div>
          )}

          {result.error && (
            <pre className="p-3 bg-red-50 text-red-800 text-xs rounded overflow-auto max-h-[150px]">
              {result.error}
            </pre>
          )}

          {feedbackStatus && (
            <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">{feedbackStatus}</p>
          )}

          <div className="flex gap-2 pt-2">
            {!result.success && (
              <button
                onClick={onRetry}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                重新生成
              </button>
            )}
            {result.savedPath && (
              <p className="text-xs text-green-600 self-center">已保存: {result.savedPath}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 步骤 5：主页面

#### 5.1 创建 `app/page.tsx`

```tsx
'use client';

import { useState, useCallback } from 'react';
import URLInput from '@/components/URLInput';
import ChatPanel, { type ChatMessage } from '@/components/ChatPanel';
import ScriptViewer from '@/components/ScriptViewer';
import BrowserView from '@/components/BrowserView';
import TestResults from '@/components/TestResults';
import type { TestResult } from '@/lib/test-executor';

export default function Home() {
  const [sessionId] = useState(() => `s-${Date.now()}`);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<TestResult | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const [lastInput, setLastInput] = useState<any>(null);

  const addMessage = (msg: Omit<ChatMessage, 'timestamp'>) => {
    setMessages((prev) => [...prev, { ...msg, timestamp: Date.now() }]);
  };

  const handleSubmit = useCallback(async (input: any) => {
    setLastInput(input);
    setMessages([]);
    setCode('');
    setResult(null);
    setFeedbackStatus('');
    setIsAnalyzing(true);

    addMessage({ type: 'thinking', content: `正在分析页面: ${input.url}` });

    try {
      // 1. 页面分析
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error);

      setSnapshot(analyzeData.snapshot);
      const s = analyzeData.snapshot;
      addMessage({
        type: 'thinking',
        content: `页面分析完成: "${s.title}" — ${s.forms.length} 个表单, ${s.buttons.length} 个按钮`,
      });

      setIsAnalyzing(false);
      setIsStreaming(true);

      // 2. LLM 流式生成
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot: analyzeData.snapshot,
          description: input.description,
          auth: input.auth,
        }),
      });

      const reader = genRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let codeBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'thinking' || event.type === 'error') {
              addMessage(event);
            } else if (event.type === 'code') {
              codeBuffer += event.content;
              setCode(codeBuffer);
            } else if (event.type === 'complete') {
              setCode(event.content);
              addMessage({ type: 'complete', content: '代码生成完成，可以执行测试' });
            }
          } catch {}
        }
      }

      setIsStreaming(false);
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message });
      setIsAnalyzing(false);
      setIsStreaming(false);
    }
  }, []);

  const handleExecute = useCallback(async () => {
    if (!code) return;
    setIsExecuting(true);
    setResult(null);
    setFeedbackStatus('');

    addMessage({ type: 'thinking', content: '开始执行测试...' });

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, sessionId }),
      });
      const testResult = await res.json();
      setResult(testResult);

      if (testResult.success) {
        addMessage({ type: 'complete', content: `测试通过! 耗时 ${(testResult.duration / 1000).toFixed(1)}s` });
      } else {
        addMessage({ type: 'error', content: '测试失败，正在分析原因...' });

        // 自动反馈
        const fbRes = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testCode: code,
            error: testResult.error,
            url: snapshot?.url || '',
            description: lastInput?.description || '',
          }),
        });
        const fb = await fbRes.json();
        if (fb.saved) {
          setFeedbackStatus(`已自动记录边缘用例: ${fb.edgeCase?.id} - ${fb.edgeCase?.title}`);
          addMessage({ type: 'thinking', content: `边缘用例已入库: ${fb.edgeCase?.id}，下次生成将参考此案例` });
        } else {
          setFeedbackStatus(fb.reason || '未记录为边缘用例');
        }
      }
    } catch (err: any) {
      addMessage({ type: 'error', content: `执行出错: ${err.message}` });
    }

    setIsExecuting(false);
  }, [code, sessionId, snapshot, lastInput]);

  const handleRetry = () => {
    if (lastInput) handleSubmit(lastInput);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* 头部 */}
      <header className="bg-white shadow-sm border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">
          AI E2E 测试平台
        </h1>
        <p className="text-sm text-gray-500 mt-1">输入 URL + 功能描述，自动生成并执行 Playwright 测试</p>
      </header>

      {/* 主体四分屏 */}
      <main className="flex-1 p-4 grid grid-cols-2 grid-rows-2 gap-4 min-h-0" style={{ height: 'calc(100vh - 180px)' }}>
        {/* 左上: 输入 */}
        <div className="overflow-auto">
          <URLInput onSubmit={handleSubmit} isLoading={isAnalyzing || isStreaming} />
        </div>

        {/* 右上: LLM 对话 */}
        <div className="min-h-0">
          <ChatPanel messages={messages} isStreaming={isStreaming} />
        </div>

        {/* 左下: 代码 */}
        <div className="overflow-auto">
          <ScriptViewer code={code} onExecute={handleExecute} isExecuting={isExecuting} />
        </div>

        {/* 右下: 结果 */}
        <div className="min-h-0">
          <TestResults result={result} isExecuting={isExecuting} onRetry={handleRetry} feedbackStatus={feedbackStatus} />
        </div>
      </main>

      {/* 底部: 浏览器 */}
      <div className="px-4 pb-4">
        <BrowserView sessionId={sessionId} isActive={isExecuting} />
      </div>
    </div>
  );
}
```

---

### 步骤 6：创建输出目录

```bash
mkdir -p tests/e2e/generated
echo '// AI 生成的 E2E 测试输出目录' > tests/e2e/generated/.gitkeep
```

---

### 步骤 7：验证

#### 7.1 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000`，确认页面渲染正常。

#### 7.2 完整流程测试

1. 输入一个公开的 URL（如 `https://www.baidu.com`），描述填写"测试搜索功能"
2. 不勾选"需要登录认证"
3. 点击"开始生成测试"
4. 观察：左上输入框变为加载态 → 右上对话面板出现思考过程 → 左下代码面板实时出现代码
5. 代码生成完毕后，点击"执行测试"
6. 观察：底部浏览器画面出现实时画面（或至少显示"已连接"）→ 右下结果面板显示通过/失败

#### 7.3 自增强验证

1. 如果测试失败，确认 `edge-cases/cases.json` 自动新增了一条记录
2. 对同一 URL 再次生成测试，确认 LLM 对话中显示"找到 N 个相关边缘案例"

#### 7.4 现有功能兼容验证

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run qa
```

全部应正常通过，不受新代码影响。

---

## 五、技术注意事项

1. **Azure OpenAI 兼容**：`lib/llm-client.ts` 通过 `IS_AZURE` 检测自动切换 `api-key` / `Authorization` header，无需用户手动配置
2. **登录认证**：`lib/page-analyzer.ts` 的 `performLogin()` 参考了现有 `tests/e2e/product-create.spec.ts` 的登录模式（多语言兼容、密码登录 Tab 切换）
3. **WebSocket 限制**：Next.js App Router 不支持 WebSocket，因此用 `server.mjs` 自定义服务器处理 `/ws/screencast` 的 upgrade 请求
4. **CDP Screencast**：使用 `Page.startScreencast` 而非 VNC，效果一致但无需 Docker 基础设施
5. **不修改现有文件功能**：所有新增均为独立模块，`edge-cases/cases.json` 只追加不修改已有条目
