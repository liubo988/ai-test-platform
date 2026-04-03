# Task Brief

## 标题
- S1：asset readiness 两层拆分 + launch decision 纯逻辑底座

## 背景
- 当前 `lib/ai/intent-e2e-service.ts` 内部把 run 前静态资产判断和 run 后 `knowledgeMatchCount / no_hit` 混在同一个 `assetReadiness` 构建函数里。
- 后续 `launch decision` 需要在不进入 analyze/planning 的前提下先做 run 前分流，因此必须先把“项目资产可用性”和“完整 readiness”拆开。

## 本轮目标
- 抽出 run 前 `project asset availability` 与 run 后完整 `assetReadiness` 的共享模块。
- 新增 `launch decision` 纯逻辑与单测，但不接 route、不接 workbench。
- 保持当前默认运行入口行为不变。

## 验收标准
- [ ] run 前资产可用性与 run 后完整 `assetReadiness` 拆分明确，且 service 已改为复用共享模块。
- [ ] `launch decision` 至少能区分 `auto_run / needs_bootstrap / needs_fixture / needs_clarify / draft_only`。
- [ ] 现有 `assetReadiness` 输出兼容当前 run result / insights 语义。

## 范围
- 会改：
  - `lib/intent-e2e-asset-readiness.ts`
  - `lib/intent-e2e-launch-decision.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/ai/intent-e2e-insights.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/intent-e2e-launch-decision.spec.ts`
- 不会改：
  - route contract
  - workbench UI
  - fixture executor
  - launch-decision API route

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening
- 对应小步：`S1` `assetReadiness` 抽共享 + `launch decision`
- 本轮完成后回写：`docs/intent-e2e-success-hardening-plan-2026-04-01.md` 与 `docs/intent-e2e-production-roadmap-2026-03-29.md`

## 计划修改点
- 把 `IntentE2EAssetReadiness` 类型和构建逻辑从 service 中抽到共享模块。
- 新增 run 前 `project asset availability` 类型与构建函数。
- 新增 `launch decision` 纯逻辑，先复用资产可用性 / runtime governance / failure pressure，不改现有入口。

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不接 route，因此 `launch decision` 仍未进入真实入口流量。
- 本轮只补 launch decision 底座，不补 family 分类、failure suppression 或 CTA。

## 完成后动作
- 回写 success hardening 文档中的 `S1` 状态与度量模板。
- 回写 production roadmap 最新更新。
