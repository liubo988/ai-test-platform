# Task Brief

## 标题
- R12 第二刀：project governance defaults

## 背景
- `R12` 第一刀已经有了 `runtimeGovernance` contract 和服务端 blocker，但目前只有显式带该字段的请求才会命中治理逻辑。
- roadmap 下一步要求把 `environment profile / fixture strategy` 接到项目接入 manifest 与 workspace 导入入口，减少靠调用方手填。

## 本轮目标
- 新增项目级 runtime governance manifest，并在 project-scoped 运行入口自动合并默认值。
- 把治理摘要带进 workspace 导入上下文，保证后续脚本版本和执行历史里能追踪环境 / 凭证 / 数据治理约束。

## 验收标准
- [ ] 项目上下文存在默认治理 manifest 时，`/api/intent-e2e` 三个运行入口都会自动继承默认 `runtimeGovernance`
- [ ] 项目凭证真正参与运行时，run request 里仍会以 project-backed `credential.secretRef` 为准
- [ ] workspace 导入后的 plan prompt / artifact / activity meta 能追踪治理摘要
- [ ] 不改 DB schema，不引入新 UI 表单

## 范围
- 会改：
  - `lib/intent-project-runtime-governance.ts`
  - `lib/server/intent-e2e-project-auth.ts`
  - `lib/services/intent-e2e-workspace-service.ts`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
  - `tests/unit/**`（仅本刀相关）
- 不会改：
  - 数据库 schema
  - 现有 onboarding manifest 结构
  - Workbench UI 表单

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：`R12`
- 对应小步：把默认 environment profile / fixture strategy 接到项目接入 manifest 与 workspace 导入入口
- 本轮完成后准备回写到哪一条更新：本文件最新一条 roadmap 更新

## 计划修改点
- 新增 project-scoped runtime governance manifest helper
- project auth resolver 合并项目默认治理字段
- workspace 导入 prompt / meta 补治理摘要

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-project-runtime-governance.spec.ts tests/unit/intent-e2e-project-auth.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只提供项目默认治理 manifest 的读取与透传，不实现 manifest 写接口
- 不补 secret manager 或 fixture 执行器

## 完成后动作
- 回写 roadmap
- 更新 README 的 manifest 路径与默认合并说明
