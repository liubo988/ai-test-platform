# Task Brief

## 标题
- R7.5 第三刀：intent-e2e blocked run split 与模型质量口径拆分

## 背景
- `R7.5` 第一刀已经完成项目级 knowledge / repair memory 路径隔离。
- `R7.5` 第二刀已经补了 `asset_missing / no_hit` 冷启动信号和最小 onboarding manifest helper。
- 但当前 insights 的主通过率口径仍会把 `env_transient / auth_failed / data_missing / permission_blocked` 混进同一分母，导致不同项目之间的真实模型质量比较失真。

## 本轮目标
- 增加统一的 blocked-vs-model-quality split helper。
- 在运行结果、run snapshot、insights summary、recent traces 和 workbench 中显式区分：
  - `model_quality`
  - `auth_blocked`
  - `permission_blocked`
  - `env_blocked`
  - `data_blocked`
- 为洞察补“剔除 blocker 后的模型质量通过率”。

## 验收标准
- [ ] 当前运行结果会返回统一的 blocked run split 结果。
- [ ] insights summary 会显式返回 `blockedRuns`、分桶 blocker 计数，以及 blocker 排除后的模型质量通过率。
- [ ] recent traces / workbench 能看到每次运行属于模型质量失败还是 blocker。
- [ ] 不改数据库 schema；只改 run snapshot 内容和洞察口径。
- [ ] 相关 unit tests、build、build:web、doc/roadmap checks、e2e 通过。

## 范围
- 会改：
  - `lib/intent-e2e-quality-split.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `lib/ai/intent-e2e-insights.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/intent-e2e-run-registry.spec.ts`
  - `tests/unit/intent-e2e-insights.spec.ts`
  - `tests/unit/api-intent-e2e-insights-route.spec.ts`
- 不会改：
  - 数据库 schema
  - 完整服务端强门禁
  - 账号池 / fixture / secret 治理
  - `R8` 测试类型抽象

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：R7.5
- 对应小步：`blocked run split`
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新更新

## 计划修改点
- 抽出 shared quality split helper
- 在 service / snapshot 中保留运行级 quality split
- 在 insights summary / traces 增加 blocker 与 model quality 口径
- 在 workbench 展示当前 run 与历史 trace 的 blocker bucket

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-run-registry.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/api-intent-e2e-insights-route.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run test:e2e`

## 风险 / 未覆盖
- 本轮只补口径，不改真实调度或强门禁；blocked run 仍会照常落历史。
- `model_quality` 口径先只做终态聚合，不扩到 first-pass / repair-pass 的 blocker 排除版本。
- `asset_missing / no_hit` 仍保持独立维度，不并入 blocker bucket。

## 完成后动作
- 回写 production roadmap 当前轮次状态
- 如稳定入口字段变化，同步更新 README
