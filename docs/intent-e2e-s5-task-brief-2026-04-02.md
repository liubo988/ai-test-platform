# Task Brief

## 标题
- S5 repeated failure suppression 最小接线

## 背景
- 当前 `launch-decision` 虽然已经有 `draft_only` / blocked flow contract，但还没有真正消费“同类任务近期连续失败”的历史信号。
- 用户会对同一类已知必败任务反复点击 `AI生成`，继续消耗 generate / repair 配额，且 workbench 不能明确解释为什么这次不该直接自动跑。

## 本轮目标
- 基于已有 `snapshotSignature` 聚类、`qualitySplit` 和 failure-pressure 口径，为 `launch decision` 增加最近重复失败抑制。
- 仅做 route 内部接线，不扩公共 API 契约，不提前展开 `S6` fixture executor。

## 验收标准
- [ ] 同一项目内相近请求命中近期连续失败 cluster 时，会影响 `launch decision`
- [ ] blocker / model-quality 会映射成已有 `needs_bootstrap / needs_fixture / draft_only`
- [ ] 只复用现有 terminal run、`snapshotSignature`、`qualitySplit`、failure-pressure 口径，不新造并行 suppression 系统

## 范围
- 会改：
  - `lib/ai/intent-e2e-insights.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `lib/intent-e2e-launch-decision.ts`
  - `app/api/intent-e2e/launch-decision/route.ts`
  - `tests/unit/intent-e2e-insights.spec.ts`
  - `tests/unit/intent-e2e-run-registry.spec.ts`
  - `tests/unit/intent-e2e-launch-decision.spec.ts`
  - `tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
- 不会改：
  - family compiler / recipe 主链路
  - fixture executor
  - workbench UI 契约

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 成功率提升专项 `S5`
- 对应小步：repeated failure suppression
- 本轮完成后准备回写到哪一条更新：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条进度更新

## 计划修改点
- 在 `intent-e2e-insights` 新增“基于近期 terminal runs 解析 repeated failure suppression”的纯逻辑
- 在 `intent-e2e-run-registry` 暴露最近 terminal run 快照读取 helper，供 route 内部接线
- 在 `launch-decision route` 里把 suppression signal 映射进现有 `launch decision` 输入
- 在 `launch-decision` 里保守消费 suppression signal，并返回明确 reason

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-e2e-run-registry.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- run 前无法拿到真实生成后的 stepTypes，因此 suppression 只能做保守近似匹配，不能等同于执行后完整 `snapshotSignature`
- 本轮不改 workbench 展示文案，解释仍通过现有 decision reasons / signals 透出

## 完成后动作
- 回写 `docs/intent-e2e-success-hardening-plan-2026-04-01.md`
- 回写 `docs/intent-e2e-production-roadmap-2026-03-29.md`
