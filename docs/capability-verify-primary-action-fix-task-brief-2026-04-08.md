# Task Brief

## 标题
- capability verify 主按钮回归 true verify，repair 改成显式次级动作

## 背景
- 当前需求编排工作台里的单条能力主按钮，在最近一次验证失败后会自动把请求模式切成 `repair`。
- 这会绕过已补好的 source passed plan reuse，直接回到“基于上次失败执行修复”的慢链路，表现为按钮长时间停在“验证中...”，进入执行工作台也更晚，而且仍可能复现旧失败原因。

## 本轮目标
- 主按钮始终发起 `verify`，保证单条能力验证优先尝试来源 passed plan reuse。
- 对最近失败且存在 `executionUid` 的能力，单独暴露显式“修复上次失败”按钮，不再用主按钮隐式代替。

## 验收标准
- [ ] 单条能力点击主按钮时，不再因为最近一次失败而自动切到 `repair`。
- [ ] 最近失败的能力仍可以通过单独按钮显式发起 `repair`。
- [ ] 相关 unit / build / 文档校验通过。

## 范围
- 会改：
  - `components/ProjectIntentWorkbench.tsx`
  - `lib/capability-verification.ts`
  - `tests/unit/capability-verification.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - capability verify route 契约
  - repair 执行器实现
  - 推荐队列 / 批量治理策略

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：capability verify primary action true-verify fix

## 计划修改点
- 抽一个纯函数表达“主入口永远是 verify；repair 只作为显式附加动作开放”。
- 工作台单条能力按钮改为：
  - 主按钮：验证 / 重新验证
  - 次按钮：修复上次失败（仅最近失败时显示）

## 验证
- `npx vitest run tests/unit/capability-verification.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮只修单条能力入口语义，不调整推荐队列里“建议 repair”的排序与展示。
- 若后续还要继续优化 verify 首屏体感时延，需要另起 brief 单收运行时 trace。
