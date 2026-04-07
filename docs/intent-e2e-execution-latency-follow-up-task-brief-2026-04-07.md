# Task Brief

## 标题
- post-R14 follow-up：intent-e2e execution latency 收口

## 背景
- 真实 run `intent-run-36b1cf9f-612c-4a8d-881e-c68d55781338` 已通过，但用户感知仍偏慢。
- 工件显示本次浏览器执行本体约 `68.9s`，其中存在两类明确可优化耗时：
  - `selectAntdOption` 在可搜索下拉上多次展开重试，单次 run 出现 17 次 `ant-select open attempt`
  - `Verification` 在步骤验收已命中目标记录后，仍再次切视角并回查列表
- 本轮不重开 success hardening 主阶段，只收口已确认的时延浪费点。

## 本轮目标
- 降低已通过 run 的非必要执行耗时，优先压缩：
  - 验收阶段重复回查
  - searchable antd select 的慢路径
  - 草稿 / 预填充链路中可安全跳过的前置重复工作

## 验收标准
- [ ] compiler 对 `business_create_list_verify` 的最终验收明确优先复用 `artifacts.plan_step_6`
- [ ] worker 在 searchable select 场景减少无意义的 dropdown reopen / retry
- [ ] 不引入新的公共 API / DB schema / UI 契约改动
- [ ] 相关 unit tests 与 build 通过

## 范围
- 会改：
  - `lib/intent-execution-compiler.ts`
  - `lib/test-worker.mjs`
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
  - `tests/unit/test-executor.spec.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 公共 route / 请求契约
  - 无关 UI 样式

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：execution latency follow-up
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- 在 compiler 的 verification hint 中强化“复用步骤产物，避免重复检索”的约束
- 在 worker 的 `selectAntdOption` / `resolvePrimaryRecord` 中补低风险快路径
- 仅在确认安全收益成立时，再补 prefilled 链路的前置快进

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-execution-compiler.spec.ts tests/unit/test-executor.spec.ts tests/unit/intent-e2e-service.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不承诺把真实 wall time 一次性压到固定阈值，只处理已确认的高频浪费点
- searchable select 的业务页面差异较大，本轮只补通用快路径，不做业务定制 selector
- 若前链路快进收益不够确定，则保留现状，不为“看起来更快”引入主链路风险

## 完成后动作
- 回写 roadmap
- 继续用真实 run 观察 wall time 与执行日志是否下降
