# Task Brief

## 标题
- 订单批量入账订单号提取与入账列表回查定位器硬编码收口

## 背景
- 最新两条真实 run 已经把头阻塞推进到更具体的两个坏模式：
  - `intent-run-43fc23b6-9890-4964-9b74-ab47ec592865`：Step 3 在勾选订单后报 `未能从已勾选订单行提取订单号`。真实代码里 `orderFromTokens` 仍要求订单号不能是纯数字，导致像 `202604011028194322` 这样的长数字订单号被整段误杀。
  - `intent-run-8495e924-7f1f-4abb-a986-dae9fd1e7792`：Step 6/7 不再卡在 modal，而是卡在 `locator('input#form_in_modal_testKeyWord:visible').first()`，说明提交后回查仍然写死了旧搜索框 id，而不是走更稳的列表回查 helper。
- 当前问题已经不是“批量入账整体不可执行”，而是 deterministic sanitizer 还漏了两类更后置的旧坏代码形态。

## 本轮目标
- 把 batch-account 场景里两类新暴露坏模式做成 deterministic sanitizer：
  - 订单号提取允许合理的纯数字长订单号，同时继续排除手机号、日期样式和短数值噪音
  - 提交后回查不再硬编码 `#form_in_modal_testKeyWord`，改走 `__e2e.resolvePrimaryRecord(...)` 的通用列表收敛链

## 验收标准
- [ ] `selectedOrderNo` 提取链不再误杀 `202604011028194322` 这类纯数字长订单号
- [ ] `未能从已勾选订单行提取订单号` 不再在 modal 前直接终止，而是降级为缺失标记，允许后续 fallback 继续补值
- [ ] Step 6/7 不再依赖 `input#form_in_modal_testKeyWord:visible`
- [ ] 入账列表回查改为 `__e2e.resolvePrimaryRecord(...)`，并保留 `/account` GET 作为辅助证据而不是硬前提
- [ ] 相关 unit tests 与 build / 文档校验通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - runtime helper 签名
  - 数据库 schema
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
- 这轮仍是 batch-account 专项 deterministic hardening，不代表该场景已经完全 recipe 化。
- 真实收益仍要看下一批新 `intent-run-*` 是否把头阻塞继续后移到更后面的业务一致性 verifier。
