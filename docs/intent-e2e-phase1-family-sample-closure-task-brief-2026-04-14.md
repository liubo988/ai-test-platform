# Task Brief

## 标题
- Phase 1 样本补齐与 family 证据闭环

## 背景
- 当前 `priorityScenarioFamily` 已正式进入 benchmark / replay / compare 链路，项目 recipe 资产也已有显式非 ignored 链路。
- 但 `list_search_detail` 与 `modal_or_drawer_save` 的 fresh family compare 仍是 `0-case / insufficient evidence`，当前短板更像是样本缺失，而不是 compare 工具缺陷。
- 本轮需要先证明根因，再用同一套 repo-native harness 把这两个 family 推进到可复核的 non-zero evidence。

## 本轮目标
- 盘点固定 scope 下 `list_search_detail` 与 `modal_or_drawer_save` 的 recent terminal runs、family 命中与 benchmark candidate 选择链路。
- 复用现有 request preparation / service / run registry / benchmark 链路，补一个可重复执行的 fresh family rerun 入口（若仓库已有等价入口则直接复用）。
- 为 `list_search_detail` 与 `modal_or_drawer_save` 建立 tracked request corpus，并跑出 fresh terminal runs。
- 用同一套 family-scoped benchmark harness 生成 non-zero baseline / replay / compare 证据。

## 验收标准
- [ ] 固定 scope 下的 list / modal recent terminal run 数量、family 命中与 candidate 选择结果有真实计数。
- [ ] 至少存在一个 repo-native、可重复执行的 fresh family rerun 方式。
- [ ] `artifacts/intent-e2e-family-evidence/` 下有 tracked 的 list / modal request corpus。
- [ ] `list_search_detail` 与 `modal_or_drawer_save` 不再只有 `0-case` compare 报告；若仍不足以证明收益，明确写出 `insufficient evidence` 的精确原因与计数。
- [ ] README / runbook / roadmap 已按实际结果回写，不夸大收益。

## 范围
- 会改：
  - `scripts/intent-e2e-benchmark.ts`
  - `lib/intent-e2e-benchmark.ts`
  - `lib/server/intent-e2e-request-preparation.ts`
  - `app/api/intent-e2e/runs/route.ts`
  - 必要的 `tests/unit/**`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `artifacts/intent-e2e-family-evidence/**`
- 不会改：
  - Phase 2/3/4 runtime loop
  - family 主执行逻辑的大范围重写
  - 无关 UI
  - 数据库 schema

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 1 之后的样本补齐与证据闭环
- 对应小步：family-scoped terminal sample closure + reproducible evidence
- 本轮完成后回写：roadmap 最新一条进度更新

## 计划修改点
- 量化当前 scope 下 list / modal terminal run 与 candidate 缺口
- 复用现有链路补 fresh family rerun 入口或参数
- 新增 tracked family request corpus
- 产出 list / modal 的 fresh baseline / replay / compare 报告

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-project-recipe-registry.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 当前环境里如果 list / modal 真没有足够 terminal runs，本轮仍可能只能建立 baseline，而不能证明收益。
- 若 fresh rerun 暴露的是 readiness / verifier 级缺口，本轮只做取证主链路需要的最小修补，不进入 Phase 2 级别的资产平台化。

## 完成后动作
- 回写 README / runbook / roadmap
- 记录 fresh run ids、family report 路径与最终结论
