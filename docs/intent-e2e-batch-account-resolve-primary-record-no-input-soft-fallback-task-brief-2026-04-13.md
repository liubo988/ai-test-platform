# Task Brief

## 标题
- batch-account `resolvePrimaryRecord` 无可见检索框时的 soft-fallback 收口

## 背景
- 新 run `intent-run-08f02429-9d95-445e-bf11-cd7107831598` 已经证明此前的 generator / sanitizer blocker 基本后移。
- 这条 run 在 `Step 5` 已观察到提交成功并切到 `/#/payment/bookedMgmt`，但 `Step 7` 调用 `__e2e.resolvePrimaryRecord(...)` 时，helper 仍把“未找到可见列表检索框”当作立即失败，导致当前列表重试与延迟刷行都来不及发生。
- 这说明当前 terminal blocker 已经从生成器侧转移到 worker helper 侧。

## 本轮目标
- 让 `resolvePrimaryRecord` 在缺少可见检索框时不再立即抛错，而是走现有 retry 机制，优先等待当前列表 / 延迟刷出的目标行。
- 用最小回归测试直接复刻“hidden input + 延迟出现目标行”的失败模式，防止 helper 级回退。

## 验收标准
- [ ] `resolvePrimaryRecord` 遇到“无可见列表检索框”时不会在第一次 attempt 立即抛错
- [ ] helper 会继续进入后续 retry，并有机会从当前表格拿到目标行
- [ ] 新增 worker 单测可稳定复刻 hidden input 场景并通过

## 范围
- 会改：
  - `lib/test-worker.mjs`
  - `tests/unit/test-executor.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - route / UI
  - `lib/test-generator.ts` 的既有 sanitizer 逻辑
  - task-platform 总超时策略

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 后续 batch-account hardening 补漏
- 对应小步：`resolvePrimaryRecord` no-input hard-fail 收口
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 把 `resolvePrimaryRecord` 的 no-input 分支从 immediate throw 改为记录 soft miss + retry
- 新增 hidden-input / delayed-row worker regression
- 回写本轮真实 run 证据与修复结果

## 验证
- `npx vitest run tests/unit/test-executor.spec.ts tests/unit/test-worker-source.spec.ts`
- `npm run build`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 这轮不处理 bookedMgmt 页面如果真实需要“显式输入后再搜索”的其他交互形态；只修 no-input 直接终止的问题。
- 这轮也不保证 `intent-run-08f02429-9d95-445e-bf11-cd7107831598` 对应业务流一定首次通过；可能只是继续把 terminal blocker 后移。

## 完成后动作
- 回写 roadmap
- 基于这版继续观察同一条 batch-account run 是否还会在 Step 7 因 helper no-input hard-fail 终止
