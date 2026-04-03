# Task Brief

## 标题
- 收口 Ant Design 列表目标行 locator 漂移误报

## 背景
- 真实 run 已经命中目标行并出现正确页面数据，但后续脚本继续读取 `recordCheck.row.getAttribute('data-row-key')` 时，偶发卡在旧的 `locator(...).nth(n)` 上，被误判成 `selector_drift`。
- 当前症状更像“helper 返回的 row locator 不够稳定”，不是业务结果本身失败。

## 本轮目标
- 让 `__e2e.findAntdTableRow(...)` 在命中 `data-row-key / id` 后，返回可跨一次列表重渲染继续使用的稳定 row locator。

## 验收标准
- [ ] `findAntdTableRow(...)` 命中 `data-row-key / id` 时，优先返回按 identity 重新锚定的 row locator，而不是原始 `nth(index)`。
- [ ] 列表在 helper 命中后发生一次重渲染，后续继续读取目标行属性不会因为旧 `nth(...)` 漂移直接失败。
- [ ] 相关 worker 单测通过，`npm run build` 通过。

## 范围
- 会改：
  - `lib/test-worker.mjs`
  - `tests/unit/test-executor.spec.ts`
- 不会改：
  - route 契约
  - DB schema
  - 无关 UI
  - verifier / compiler 其它策略

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：生产化收口期
- 对应小步：列表命中后的 row identity 稳定性修复

## 验证
- `npx vitest run tests/unit/test-executor.spec.ts`
- `npm run build`

## 风险 / 未覆盖
- 本轮只修 helper 返回 row 的稳定性，不改更高层 prompt/slot patch 文案。
