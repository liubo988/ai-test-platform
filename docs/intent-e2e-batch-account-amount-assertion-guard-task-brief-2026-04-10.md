# Task Brief

## 标题
- 订单批量入账金额提取 / 断言守卫与多处 truthy 清洗

## 背景
- 最新真实 run `intent-run-97b6699c-607a-4377-9fe5-1f46167214f3` 已经证明订单批量入账链路继续后移：
  - 行选择、modal ready、订单号提取都已经走通
  - 当前失败点收敛到 Step 5 modal 字段一致性校验
  - 数据库 `intent_e2e_runs.state_json` 里的真实错误为：
    - `Expected substring: "2026-04-01"`
    - modal 实际只包含订单号 `202604011028194322`、服务项 `疑难核名解决方案`、金额 `-`
- 同一份最终执行代码还暴露出两个 sanitizer 漏网点：
  - regex 版 `await expect(modal.getByRole('button', { name: /取\\s*消/ }).first()).toBeVisible(...)` 仍会漏进执行
  - `expect(shared.selectedAmount).toBeTruthy()` 只替换了第一处，最终验证里的同类硬断言还会保留

## 本轮目标
- 把 batch-account 场景里“金额提取 / 金额断言 / 多处 truthy / regex 版取消按钮”这四类漏网坏模式做成 deterministic sanitizer。

## 验收标准
- [ ] 宽泛 `tokens.find(/^\\d+(\\.\\d{1,2})?$/)` 不再把日期或长整型 ID 当 `selectedAmount`
- [ ] modal / 列表对 `shared.selectedAmount` 的断言只在其看起来像真实金额时才执行
- [ ] regex 版 `取\\s*消` 可见性硬断言被清除
- [ ] 多处 `expect(shared.selectedAmount).toBeTruthy()` 会被全量替换，而不是只替换第一处
- [ ] 相关 unit tests 与 `npm run build` 通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - runtime helper 签名
  - 前端工作台 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 这轮仍是 batch-account 专项 sanitizer hardening，不等于该场景已经完全 recipe 化。
- 真实收益仍需要新的 `intent-run-*` 数据确认；本轮只验证 deterministic sanitizer 和编译链没有回归。
