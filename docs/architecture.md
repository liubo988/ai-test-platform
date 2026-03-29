# Architecture

## 系统轮廓
这个仓库是一个基于 Next.js 16、TypeScript、Vitest、Playwright 和 MySQL 的自动化测试中台。主干能力包含三部分：

- 传统分层测试：`src/**` 与 `lib/**` 中的纯逻辑、服务逻辑和仓储逻辑，分别由 `tests/unit/**` 与 `tests/integration/**` 覆盖。
- AI 意图驱动 E2E：`lib/ai/**`、`lib/services/**`、`app/api/intent-e2e/**` 和 `components/IntentE2EWorkbench.tsx` 组成生成、执行、修复和沉淀闭环。
- 项目化工作台：`app/projects/**`、`components/ProjectWorkspace.tsx` 以及项目/能力/知识相关 API route 与仓储层。

## 目录职责
### `app/**`
- `app/**/page.tsx`：页面入口，只负责装配组件与页面级参数。
- `app/api/**/route.ts`：HTTP 入口。做输入校验、权限控制、响应格式化，不承载复杂业务编排。

### `components/**`
- 前端工作台与可视化组件。
- 允许依赖 `lib/**` 中的类型、纯函数和浏览器侧 helper。
- 不允许直接访问 `lib/db/**` 或 `mysql2/*`。

### `lib/ai/**`
- 场景卡生成、意图请求归一化、运行注册表、失败归因、repair memory、知识洞察等 AI 主逻辑。
- 可以依赖 `lib/**` 其他子模块。
- 不能反向依赖 UI 层或 route handler。

### `lib/services/**`
- 跨 AI、执行器、仓储层的业务编排。
- 适合放 route 里的“厚逻辑”，例如项目意图草稿生成、测试计划编排、工作台导入。

### `lib/db/**`
- MySQL 连接池、schema bootstrap、仓储、加密工具。
- 所有数据库直接读写都应聚合在这里，避免在其他层散落 SQL。

### `src/**`
- 轻量纯逻辑样例模块，适合放稳定、无 IO 的逻辑。

### `scripts/**`
- 数据库初始化、知识导入、边缘用例生成、回归检查、hooks 等命令式脚本。
- 允许直接访问数据库或文件系统，但要保持副作用清晰。

### `tests/**`
- `tests/unit/**`：纯逻辑和路由单测，优先 mock 外部依赖。
- `tests/integration/**`：真实 MySQL + route/repository/service 集成链路。
- `tests/e2e/**`：Playwright UI 流程与 smoke 验证。

## 依赖方向
- `app/page|layout` -> `components` -> `lib`
- `app/api/route` -> `lib/services` / `lib/db/repository` / `lib/server`
- `lib/services` -> `lib/ai` / `lib/db` / 其他 `lib`
- `lib/ai` -> 其他 `lib`
- `lib/db` -> 仅依赖 Node / MySQL / 本层工具

禁止方向：

- `components` -> `lib/db`
- `components` -> `app/api`
- `lib/ai` -> `components` 或 `app`
- `lib/services` -> `components` 或 `app`
- `app/api` -> `mysql2/*` 或 `@/lib/db/client`

## 重要约定
- Route 触库前先 `ensureDbBootstrap()`。
- 涉及项目访问控制时，统一走 `applyActorCookie` / `requireProjectRole` / `toErrorResponse`。
- 需要长期沉淀的 AI 行为优先写入项目知识、starter helper 或 repair memory，不要只在 Prompt 里补一句。
- 生成产物默认进入 `tests/integration/generated/**`、`reports/**` 或 `tmp/**`，不要和手写核心逻辑混放。

## 变更提示
- 如果修改了 `lib/db/repository.ts`、`scripts/e2e-platform-schema.sql` 或 `scripts/init-e2e-db.mjs`，通常意味着 schema / 数据契约有变化，需要同步检查 integration tests 与 runbook。
- 如果修改了 `lib/ai/**`、`lib/test-generator.ts`、`lib/intent-execution-compiler.ts`，通常需要同时看 `tests/unit/**` 和 `tests/e2e/**`。
- 如果修改了 `components/**` 或 `app/**/page.tsx`，至少补一次 `npm run build:web`。
