# Task Brief

## 标题
- `商机222` stale draft-first-pass reuse guard for create-list-verify verification

## 背景
- `intent-run-d64ec52d-2c2e-4ff1-8c7c-9b66bd52956a` 已证明 create-order deterministic template 污染已消失。
- 但该 run 的 `attempt-1` 仍优先复用了旧的 `draft_first_pass` 脚本，且 fallback 详情验收骨架会在 `商机联系人信息` 抽屉里用泛化 `readDetailField('联系人') / readDetailField('手机号')`，把“联系人”读串成“意向产品”，导致 verification 继续误失败。
- 这不是当前业务动作没完成，而是 stale prefilled plan code 仍被判定为可复用。

## 本轮目标
- 把这类已知 stale 的 business-create list-verify detail verification 骨架加入 `draft_first_pass` skip 条件。
- 让服务端这类草稿 run 回退到当前生成链路，而不是继续执行业务上已知不稳的旧首版脚本。

## 验收标准
- [ ] 命中 `商机联系人信息` 详情抽屉 + 泛化 `联系人/手机号` 读取 + `shared.createdContactName/shared.createdPhone` 明细断言的旧骨架时，不再复用草稿首版脚本
- [ ] 正常的 `draft_first_pass` 复用能力不受影响
- [ ] 相关 unit/build/doc 校验通过

## 范围
- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-business-create-list-verify-stale-draft-reuse-guard-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - benchmark harness
  - `lib/test-worker.mjs`
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：`Phase 5 第二刀` 并行进行中；本轮只修 shared intent-e2e reuse guard，不改变 Phase 5 判定
- 对应小步：stale `draft_first_pass` reuse guard hardening
- 本轮完成后准备回写到哪一条更新：`2026-04-21` 新增一条 shared reuse guard update

## 计划修改点
- 在 `resolveIntentE2EPrefilledPlanReuseDecision(...)` 增加 business-create stale detail verification family 的 skip 判定
- 新增 unit regression，固定这类 prefilled code 必须回退到当前生成链路

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只解决 stale 首版脚本仍被复用的问题，不直接保证 fresh 生成链路一次通过
- fresh rerun 后若仍有真实业务 blocker，需要继续按新 run 收口

## 完成后动作
- 回写 roadmap
- 继续用真实 draft run 验证是否已不再复用旧首版脚本
