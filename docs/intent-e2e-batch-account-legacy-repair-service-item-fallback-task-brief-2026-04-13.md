# Task Brief

## 标题
- batch-account legacy repair 服务项 fallback 收口

## 背景
- `intent-run-38873515-2d48-4f87-8a39-717ebe9d7ec1` 已不再停在执行器语法层，而是在 Step 4 报 `提取失败：selectedServiceItem 为空`。
- 该 run 的 `attempt-2-trace.json` 显示 structured repair 因 `LLM 请求超时 (60000ms)` 回退到了 legacy 自由代码 repair。
- 最终执行代码虽然已经过 `sanitizeGeneratedCode()`，但 Step 4 仍只尝试：
  - `readDetailField('服务项' | '服务项目')`
  - `modalText.match(/服务项.../)`
- 同时 `repairObservationReport.detail_field_evidence` 明确显示：
  - `field=入账金额： source=入账金额 value=疑难核名解决方案`
  - `field-miss=服务项`
  - `field-miss=服务项目`
- 说明服务项文案已经出现在可读证据里，只是被读偏到了金额标签下；当前 legacy sanitizer 没把这类证据回流成 `selectedServiceItem`。

## 本轮目标
- 让 batch-account 在 legacy repair 路径下，即使 `服务项` 字段 miss，也能从：
  1. `入账金额` 标签读出的非金额业务文案
  2. 已勾选真实订单行文本
 里回填 `selectedServiceItem`。

## 验收标准
- [ ] `selectedServiceItem` 在 `amountByField` 命中业务文案时能被回填
- [ ] `selectedServiceItem` 在 modal label miss 且 amount label 也不可用时，还能从 selected row 文本保守回填
- [ ] 新增回归测试能复刻 `3887...` 的失败模式并通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
- 不会改：
  - DB schema
  - route / UI
  - 完整 recipe / verifier 架构

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 后续 batch-account hardening 补漏
- 对应小步：legacy repair 在 Step 4 也复用 deterministic service-item fallback
- 本轮完成后回写：roadmap 最新一条更新

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`

## 风险 / 未覆盖
- 这轮不解决 structured repair timeout 本身，只保证 fallback 到 legacy code 时仍能走稳一点。
- 服务项文案的 token 级猜测仍是启发式，需要靠真实 run 继续收敛。

## 完成后动作
- 回写 roadmap
- 用新的真实 run 观察 blocker 是否继续后移
