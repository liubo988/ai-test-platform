# Task Brief

## 标题
- R8 第五十二刀：platform policy-note query consumer

## 背景
- 上一刀已经把 create-entry precheck policy 收口成 contract，并写入 `verificationContract.typeFields.policyNotes`
- 但这条 contract 还没有进入 import / platform query / workspace 这类更稳定的平台消费面，当前只有原始运行结果能看到

## 本轮目标
- 让 verification policy notes 进入 intent import summary 与 platform materialized query
- 让 `ProjectWorkspace` 的现有 platform observation 区块最小消费这条信息，作为 R8 平台资产模型的真实 consumer

## 验收标准
- [ ] prompt / artifact 两侧的 import summary 都能提取 verification policy notes
- [ ] platform materialized query 能稳定保留 verification policy notes
- [ ] `ProjectWorkspace` 能最小展示并搜索这些 policy notes

## 范围
- 会改：
  - `lib/intent-e2e-import.ts`
  - `lib/test-platform-query-contract.ts`
  - `lib/services/intent-e2e-workspace-service.ts`
  - `components/ProjectWorkspace.tsx`
  - `tests/unit/intent-e2e-import.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - route 公共 API 结构
  - 无关 execution / detail 页面

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：让 precheck policy contract 进入更多平台消费面
- 本轮完成后准备回写到哪一条更新：`2026-03-31 第五十七次更新`

## 计划修改点
- 扩展 import summary / materialized query，补 `verificationPolicyNotes`
- 导入 prompt 写入 policy notes，artifact meta 读取 policy notes
- `ProjectWorkspace` observation/search 最小消费 policy notes

## 验证
- `npx vitest run tests/unit/intent-e2e-import.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只接 `ProjectWorkspace` 这一处 workspace consumer，不继续扩到 execution detail / insights
- 仍沿用现有 materialized query 结构扩字段，不新增独立 policy summary/index

## 完成后动作
- 回写 roadmap
