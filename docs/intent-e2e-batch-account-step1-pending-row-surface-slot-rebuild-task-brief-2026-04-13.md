# Task Brief

## 标题
- batch-account `Step 1` 待申请结果面扫描保持无副作用的 slot rebuild 收口

## 背景
- 新 run `intent-run-81bc54c8-b6ad-4286-92d7-34fddc8ec296` 已经证明上轮 `resolvePrimaryRecord` helper 修复后，terminal blocker 不再停在 `Step 7`。
- 这条 run 现在会在 `Step 1: 进入订单列表并完成待申请筛选` 停滞，最终被判定为“连续 3 次都落在同一类失败模式”，最后一次失败为 `测试执行超时 (120s)`。
- 排查发现，repair / slot rebuild 会把 `Step 1` 改写成“刚筛完待申请就扫描真实行并立即点击 checkbox”，把原本只该确认筛选结果存在的步骤变成了带副作用的选行动作，导致超时预算被白白耗在重复勾选上。

## 本轮目标
- 让 batch-account 的 `plan_step_1` 在 rebuild 后只做“待申请结果面可见性确认”，不提前点击任何行 checkbox。
- 保持真正的选行动作仍发生在后续步骤，避免 `Step 1` 和 `Step 2` 语义串位。
- 用回归测试固定这个 repair 漂移，防止后续 sanitizer 再把 `Step 1` 改回有副作用的版本。

## 验收标准
- [ ] `plan_step_1` rebuild 后不会包含 `clickAntdRowCheckbox(...)`
- [ ] `plan_step_1` 仍能确认筛选后至少存在一条 `待申请入账` 结果行
- [ ] 后续步骤仍可复用该行并执行真实勾选
- [ ] 新增 generator regression 稳定通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - route / UI
  - `lib/test-worker.mjs` 的 `resolvePrimaryRecord` helper
  - task-platform 总超时策略

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 后续 batch-account hardening 补漏
- 对应小步：`Step 1` pending-row surface scan 无副作用 rebuild 收口
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 在 `lib/test-generator.ts` 新增 `Step 1` 专用的 pending-row surface block，只扫描筛选后的可见结果面
- 给 `plan_step_1` 增加专门 sanitizer，避免它复用后续步骤的“立即勾选真实行”逻辑
- 在 `tests/unit/test-generator.spec.ts` 增加 regression，固定 “Step 1 无副作用 / Step 2 才勾选” 的语义边界

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts tests/unit/test-executor.spec.ts tests/unit/test-worker-source.spec.ts`
- `npm run build`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 这轮不保证 `intent-run-81bc54c8-b6ad-4286-92d7-34fddc8ec296` 对应业务流立即首跑通过；只收口 `Step 1` repair 漂移导致的停滞。
- 若 rerun 通过 `Step 1` 后继续失败，terminal blocker 可能继续后移到提交后等待、回查列表一致性或更后面的断言。

## 完成后动作
- 回写 roadmap
- 基于这版重新跑同一条 batch-account intent，观察 blocker 是否已从 `Step 1` 后移
