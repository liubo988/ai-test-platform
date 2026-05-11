# Testing

## 测试分层
- `npm run test:unit`：纯逻辑、服务逻辑、route 单测。默认最快，优先在本地频繁运行。
- `npm run test:integration`：真实 MySQL 环境下验证 route、repository、service 链路。
- `npm run test:e2e`：Playwright 端到端和 smoke 流程。
- `npm run test:e2e:preprod`：只运行带 `@preprod` 标签的真实预发 E2E；未配置 `E2E_BASE_URL` 时会跳过，避免误跑本地 fallback。
- `npm run test:all`：顺序执行 unit + integration + e2e。

## 构建与静态验证
- `npm run build`：TypeScript 编译检查。
- `npm run build:web`：Next.js 应用构建检查，能尽早发现页面、路由和 `useSearchParams()` 之类的问题。
- `node scripts/check-doc-links.mjs`：检查稳定入口文档里的本地链接是否有效。
- `node scripts/check-roadmap-progress.mjs`：检查 `intent-e2e` roadmap 的进度更新仍符合固定模板，至少保留 `验证` 等必填字段。
- `bash scripts/check-boundaries.sh`：检查 UI / AI / route / db 分层边界是否被破坏。

## 何时跑什么
- 改 `src/**`、`lib/**` 里的纯函数、工具或轻逻辑：
  - `npm run build`
  - `npm run test:unit`

- 改 `app/api/**`、`lib/services/**`、`lib/db/**`、权限和持久化链路：
  - `npm run build`
  - `npm run test:unit`
  - `npm run db:init`
  - `npm run test:integration`

- 改 `app/**/page.tsx`、`components/**`、前端工作台交互：
  - `npm run build`
  - `npm run build:web`
  - 受影响时跑 `npm run test:e2e`

- 改 `lib/test-generator.ts`、`scripts/generate-tests.mjs`、`edge-cases/**`、`tests/integration/generated/**`：
  - `npm run edge:generate`
  - 检查 `tests/integration/generated/**` 是否有未提交变更
  - 再跑 `npm run test:unit`

- 改意图驱动 E2E 主流程、执行器、Scenario smoke：
  - `npm run build`
  - `npm run test:unit`
  - `npm run test:e2e`

- 改 `docs/intent-e2e-high-success-roadmap-2026-03-20.md` 的阶段回写：
  - `node scripts/check-roadmap-progress.mjs`

## 环境要求
### Unit
- 通常不依赖外部服务。

### Integration
- 需要 MySQL。
- 需要根目录 `.env`，至少包含 `DB_HOST`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`、`DB_PORT`、`APP_CRYPTO_KEY`。
- 首次或 schema 变更后先跑 `npm run db:init`。

### E2E
- 需要安装 Playwright 浏览器：`npx playwright install --with-deps`
- `tests/e2e/scenario-task-smoke.spec.ts` 会自己 build 并启动本地 smoke server。
- 真实预发入口使用 `npm run test:e2e:preprod`，至少需要 `E2E_BASE_URL`；可用 `E2E_PREPROD_SMOKE_PATH` 指定轻量健康检查路径。
- `tests/e2e/product-create.spec.ts` 属于 `@preprod` 用例，依赖 `E2E_BASE_URL` 与 `E2E_USERNAME` / `E2E_PASSWORD`，未配置时会自动跳过；可用 `E2E_LOGIN_URL` / `E2E_PRODUCTS_URL` 覆盖登录和产品页路径。

## 生成产物
- `npm run edge:generate` 会更新 `tests/integration/generated/*.spec.ts`。
- 如果生成逻辑变了但没有同步提交生成结果，CI 会直接失败。

## 提交前最小清单
- 受影响层级的构建和测试已经跑过。
- 没有把临时调试文件误放进正式目录。
- 如果改动了入口文档或分层约束，对应检查脚本已跑过。
- 如果改动了 `intent-e2e` roadmap，roadmap 模板检查已跑过。
