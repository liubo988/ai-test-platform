# Task Brief

## 标题
- R12 第四刀：project ownership derivation

## 背景
- `R12` 前三刀已经把 runtime governance contract、project defaults 和 manifest feedback 接到了主链路。
- 当前 project-backed credential 与 fixture contract 仍偏“静态字符串声明”：共享账号的 `accountRef / sessionMode`、fixture 的 `owner` 在项目上下文里还不能稳定派生。

## 本轮目标
- 在 `project auth` 链路里为 project-backed credential 与 fixture ownership 派生最小但稳定的项目级 ref。
- 让这批派生后的治理字段继续走现有 workspace import 持久化链，不额外新开 schema。

## 验收标准
- [ ] 复用项目内置 auth 时，缺失的 `credential.accountRef / sessionMode` 能基于项目上下文自动补齐
- [ ] 项目上下文下若 fixture contract 缺 `owner`，能基于 actor/project 派生稳定 owner ref
- [ ] 已有 workspace import 的 `runtimeGovernance` 持久化链能保留这些派生字段

## 范围
- 会改：
  - `lib/intent-e2e-runtime-governance.ts`
  - `lib/server/intent-e2e-project-auth.ts`
  - `tests/unit/intent-e2e-project-auth.spec.ts`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 新 UI 表单
  - 新 route / 新导入 meta schema

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R12`
- 对应小步：project ownership derivation
- 本轮完成后准备评估是否可将 `R12` 切到已完成

## 计划修改点
- 在 runtime governance helper 增加 project account / fixture owner ref builder
- 在 `resolveIntentE2EProjectAuth` 里补派生默认值，只在项目上下文且字段缺失时生效

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-project-auth.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不新增真实账号池调度器或 fixture 执行器
- 不处理无项目上下文下的 request credential 自动推导

## 完成后动作
- 回写 roadmap
- 如满足收口标准，切换 `R12` 阶段状态
