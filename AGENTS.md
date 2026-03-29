# AGENTS.md

## Mission
- 以最小、可验证的改动维护这个 AI 驱动的自动化测试中台。
- 先理解现有实现，再扩展流程、接口、Prompt 或测试。
- 优先把约束落到代码、脚本和 CI，不要只靠提示词约束。

## Read First
- `README.md`：产品能力、核心命令、当前主流程说明。
- `docs/architecture.md`：目录职责、分层边界、允许的依赖方向。
- `docs/testing.md`：分层测试策略、不同改动需要跑哪些命令。
- `docs/runbook.md`：本地启动、数据库初始化、常见故障处理。
- `docs/task-brief-template.md`：非 trivial 开发任务的标准 brief 模板，建议在跨文件、跨层或 `intent-e2e` 主链路任务开始前先填。
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`：仅在修改 `intent-e2e` 主链路、`lib/ai/**`、`app/api/intent-e2e/**`、`components/IntentE2EWorkbench.tsx`、verifier / starter helper / repair memory / project knowledge / ExecutionPlan 相关逻辑时必读。
- `TERMITE_PROTOCOL.md`：仅在修改 `scripts/hooks/**`、`signals/**` 或 Termite 流程时必读。

## Repo Map
- `app/**`：Next 页面与 API route。Route handler 保持轻量，主要做参数解析、权限校验和响应封装。
- `components/**`：前端工作台与可视化组件。可以依赖 `lib/**` 的纯函数和类型，不能直接碰数据库实现。
- `lib/ai/**`：意图驱动 E2E、修复记忆、洞察、场景卡等 AI 核心逻辑。
- `lib/services/**`：跨 AI、执行器、仓储层的编排服务。
- `lib/db/**`：MySQL 连接、bootstrap、仓储与加密工具。
- `src/**`：轻量的纯逻辑示例模块，主要给单测和集成测使用。
- `scripts/**`：初始化、导数、回归和运维脚本。
- `tests/unit/**`、`tests/integration/**`、`tests/e2e/**`：分层测试入口。
- `tmp/**`：临时产物，除非任务明确要求，不要把这里的内容当作正式实现的一部分。

## Working Rules
- API route 不要直接写复杂业务逻辑；优先下沉到 `lib/services/**` 或 `lib/**`。
- 需要访问 MySQL 时，优先通过 `lib/db/repository.ts` 和 `ensureDbBootstrap()`，不要在 route / component 里直接创建连接。
- 页面和组件不能直接 import `@/lib/db/**` 或 `mysql2/*`。
- `lib/ai/**`、`lib/services/**` 不能反向依赖 `components/**` 或 `app/**`。
- 保持 `@/*` 路径别名风格一致，避免混用深层相对路径。
- 非 trivial 任务默认先写一个简短 Task Brief；至少写清目标、范围、验收标准和验证命令。
- 修改 `intent-e2e` 主链路时，先对齐 roadmap 当前阶段和下一步；完成一个完整能力切片后，按 roadmap 固定模板回写“本轮目标 / 已完成 / 验证 / 阶段状态 / 风险 / 下一步”。
- 修改 Prompt、知识规则、starter helper 或 repair memory 行为时，要同步更新相关测试和文档入口。
- 不要顺手清理用户未要求的脏改动；仓库可能长期处于进行中状态。

## Verification Matrix
- 改 `lib/**` 或 `src/**`：至少跑 `npm run build` 和受影响的 `npm run test:unit`。
- 改 route、仓储、数据库流转：补 `npm run test:integration`，必要时先跑 `npm run db:init`。
- 改页面、组件、Next 路由装配：补 `npm run build:web`。
- 改 `edge-cases/**`、`scripts/generate-tests.mjs`、生成逻辑：跑 `npm run edge:generate`，确认 `tests/integration/generated/**` 产物已提交。
- 改工作台主流程、Scenario smoke、执行器交互：补 `npm run test:e2e`。
- 改文档或 agent 入口：跑 `node scripts/check-doc-links.mjs`。
- 改 `intent-e2e` roadmap 进度回写：跑 `node scripts/check-roadmap-progress.mjs`。
- 改分层约束：跑 `bash scripts/check-boundaries.sh`。

## Environment Notes
- Integration tests 依赖 MySQL 和根目录 `.env`。
- `scripts/init-e2e-db.mjs` 会初始化 schema 与默认协作数据。
- E2E 依赖 Playwright 浏览器；`tests/e2e/scenario-task-smoke.spec.ts` 会自启一个本地 smoke server。
- `tests/e2e/product-create.spec.ts` 没有账号时会自动跳过。

## Escalate When
- 需要改公共 API 契约、项目知识文件结构或数据库 schema。
- 需要新增外部依赖、外部服务、长期运行后台任务。
- 发现 UI 层必须直接读取数据库，或业务逻辑只能堆在 route 里才能完成。
- 当前任务和用户已有脏改动冲突，无法安全合并。

## Done
- 改动范围与任务一致，没有顺手引入无关重构。
- 相关测试、脚本或构建已运行，或明确说明为何未运行。
- 如果行为、命令或入口变化，已更新 `README.md` 或稳定文档。
