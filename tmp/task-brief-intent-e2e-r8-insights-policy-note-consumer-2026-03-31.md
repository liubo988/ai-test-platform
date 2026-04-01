# Task Brief

## 标题
- R8 第五十九刀：insights policy-note consumer

## 背景
- `verificationPolicyNotes` 已进入 import summary、workspace query 和 execution detail
- 但 `intent-e2e insights` 的 `recentTraces` 还没有消费这条平台 policy 信息，trace 视图仍看不到 precheck / verification policy note

## 本轮目标
- 让 `insights.recentTraces` 显式保留 `verificationPolicyNotes`
- 让 `IntentE2EWorkbench` 的现有 trace 卡片最小展示这些 policy notes

## 验收标准
- [ ] `IntentE2EInsightRecentTrace` 能稳定带出 `verificationPolicyNotes`
- [ ] `IntentE2EWorkbench` 的最近 trace 卡片能直接看到 policy notes
- [ ] 相关 unit tests 覆盖 insights recent trace 输出

## 范围
- 会改：
  - `lib/ai/intent-e2e-insights.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/intent-e2e-insights.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 新的 insights summary 聚合字段
  - route 公共 API 结构
  - execution detail / workspace 既有 consumer

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：把 verification policy notes 扩到 insights 等剩余 platform consumer
- 本轮完成后准备回写到哪一条更新：`2026-03-31 第五十九次更新`

## 计划修改点
- 扩展 insights run record / recent trace，补 `verificationPolicyNotes`
- recent trace 从 `verificationContract.typeFields.policyNotes` 读取，必要时 fallback `verificationPlan.policyNotes`
- `IntentE2EWorkbench` trace 卡片补一行 policy note 摘要

## 验证
- `npx vitest run tests/unit/intent-e2e-insights.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只做 recent trace consumer，不扩新的 summary / coverage / watchlist 聚合
- policy note 仍以字符串摘要展示，不做结构化分类

## 完成后动作
- 回写 roadmap
