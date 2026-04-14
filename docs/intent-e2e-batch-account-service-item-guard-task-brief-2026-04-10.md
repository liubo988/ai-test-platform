# Task Brief

## 标题
- 订单批量入账服务项状态词漂移与 wait 变体漏网收口

## 背景
- 最新真实 run `intent-run-f51958ee-db00-448e-bc61-521c759fbe46` 已经证明上一轮金额守卫开始生效：
  - 最终代码里已经出现 `selectedAmount` 守卫块
  - 失败点继续后移到 Step 5 modal 文本校验
- 当前新的真实头阻塞是：
  - `serviceToken = tokens.find((t) => /工商|注销|服务|套餐|产品|方案/.test(t))` 会把 `[服务中]` 这种状态 token 当成 `selectedServiceItem`
  - Step 5 使用 `if (shared.selectedServiceItem) expect(modalText).toContain(shared.selectedServiceItem)`，于是直接拿 `[服务中]` 去校验 modal
  - `/account` 的 POST / GET 软等待仍存在双引号和不同变量名的漏网写法

## 本轮目标
- 把 batch-account 场景里“服务项状态词误提取 / modalText 断言过宽 / wait 变体漏网”做成 deterministic sanitizer。

## 验收标准
- [ ] `selectedServiceItem` 若命中状态词（如 `服务中 / 待申请入账 / 未确认`）会被清空，等待 modal fallback 回填真实服务项
- [ ] `modalText / rowText` 上对 `shared.selectedServiceItem` 的断言只在其不像状态词时才执行
- [ ] `/account` POST / GET 的 wait softening 不再依赖固定变量名或单引号写法
- [ ] 相关 unit tests 与 `npm run build` 通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - runtime helper 签名
  - 前端页面

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
- 这轮仍是 batch-account 专项 deterministic hardening，不等于该场景已经完全 recipe 化。
- 真实收益仍依赖新的 `intent-run-*` 数据来确认是否继续后移到更后面的业务 verifier 层。
