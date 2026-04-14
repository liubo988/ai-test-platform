# Task Brief

## 标题
- 订单批量入账 bookedMgmt Step 7 搜索动作忠实收口

## 背景
- `intent-run-d9eb8c54-010b-430d-83bc-347a816f9c8d` 已验证 bookedMgmt “同订单号多条合法记录”误判已修复。
- 但真实 trace 也显示 Step 7 直接命中了 `resolvePrimaryRecord(... current table ...)` shortcut，没有执行用户提示里明确要求的“用 placeholder 为‘请输入关键词’的筛选框搜索订单号”动作。

## 本轮目标
- 仅收口 batch-account bookedMgmt Step 7 在“明确要求搜索动作”的生成/repair 变体。
- 保持 helper 接管搜索，不退回 brittle 的手写 `fill + waitForApiResponse + click` 链。

## 验收标准
- [ ] batch-account Step 7 canonical block 会显式把 `keywordInput`、`searchButton` 和 `preferCurrentVisibleRow: false` 传给 `resolvePrimaryRecord(...)`
- [ ] 继续保留 `allowMultipleUniqueMatches: true`，不回退到唯一命中语义
- [ ] 单测覆盖“必须真搜，但不能 helper 外手写预搜索”
- [ ] build / roadmap / doc checks 通过
- [ ] 真实 rerun 的 Step 7 不再只走 `primary record resolved in current table`

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - 通用 `resolvePrimaryRecord` 默认语义

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：订单批量入账专项后续收口
- 对应小步：bookedMgmt Step 7 搜索动作忠实
- 本轮完成后准备回写到哪一条更新：第二百六十二次更新

## 计划修改点
- 调整 batch-account Step 7 canonical resolve block，显式透传搜索控件并禁用 current-table shortcut
- 更新 batch-account 相关 generator regressions，固定“helper 真搜”语义

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 本轮不扩展到所有列表回查场景，只收口 batch-account bookedMgmt Step 7
- 如果真实页面后续又把 placeholder 文案改掉，仍要依赖 worker 内建 fallback candidates 兜底

## 完成后动作
- 回写 roadmap
- 用真实 HTTP run 审计 Step 7 trace / logs
