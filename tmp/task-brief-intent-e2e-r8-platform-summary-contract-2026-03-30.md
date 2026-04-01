# Task Brief

## 标题
- R8 第六刀：workspace platform summary / aggregation contract

## 背景
- `R8` 第五刀已经把 `/api/test-configs` 和 `/api/test-configs/:configUid/executions` 的 `platformTestType / platformRunnerType` 服务端筛选打通。
- 但当前工作台仍缺少稳定的聚合面：用户能筛选，却还看不到当前查询范围里到底有多少 intent 导入任务、多少已经带平台标签、各平台类型 / 执行器分布如何。

## 本轮目标
- 给 workspace 任务列表和执行历史增加增量式 `platformSummary` contract。
- 在 `ProjectWorkspace` 里把这份 summary 展示成轻量 pills/counts，形成后续 runner adapter 与跨平台统计的统一观测面。

## 验收标准
- [ ] `GET /api/test-configs` 返回 `platformSummary`，可反映当前查询范围内的 intent import / 平台标签聚合。
- [ ] `GET /api/test-configs/:configUid/executions` 返回同一形状的 `platformSummary`。
- [ ] `ProjectWorkspace` 任务区和执行历史弹窗会展示 summary pills/counts。
- [ ] 补最小 unit / integration，覆盖 route 返回契约和真实聚合结果。

## 范围
- 会改：
  - `app/api/test-configs/route.ts`
  - `app/api/test-configs/[configUid]/executions/route.ts`
  - `components/ProjectWorkspace.tsx`
  - `lib/db/repository.ts`
  - `tests/unit/api-test-configs-route.spec.ts`
  - `tests/unit/api-test-config-executions-route.spec.ts`
  - `tests/integration/scenario-task-api.spec.ts`
  - `tests/integration/project-read-access-api.spec.ts`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - runner 执行链
  - execution detail route contract

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第六刀，platform summary / aggregation contract
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 `lib/db/repository.ts` 给任务列表与执行历史返回增加 `platformSummary`
- 在 `components/ProjectWorkspace.tsx` 展示任务区与执行历史的 summary pills
- 用 unit + integration 固定 route 与真实 DB 聚合行为

## 验证
- `npx vitest run tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
- `npm run db:init`
- `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 任务列表 summary 仍依赖 latest plan prompt 里的平台标记；极老未标记计划只能计入 imported，不会进入 `byTestType / byRunnerType`
- 执行历史 summary 仍以当前 `limit` 返回窗口为范围，不追溯全量历史

## 完成后动作
- 回写 roadmap
- 同步 README 的 workspace query contract 说明
