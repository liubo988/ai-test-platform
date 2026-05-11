# Task Brief

## 标题
- Post Phase 22 modal_or_drawer_save 当前窗口诊断与数据缺口归类

## 背景
- traffic-quality 归因回填后，下一条高收益候选是 `modal_or_drawer_save`：30 天 benchmark raw 体量最大，但 terminal pass rate 只有 `78.1%`，且尚未进入 release guard。
- 该 family 已有 tracked corpus 和项目级 playbook recipe，需要先判断当前失败是 recipe / selector 问题，还是业务数据前置不足。

## 本轮目标
- 跑一组当前 fresh rerun 评估 modal family 是否具备 release-guard 接线条件。
- 如果失败来自数据前置不足，修正 failure triage，避免把 data gap 误报成 selector drift。

## 验收标准
- [x] modal fresh rerun 能输出当前窗口结论。
- [x] 区分 recipe/playbook 命中失败和业务数据前置不足。
- [x] “前置数据不足：筛选待申请后无可用订单行”归类为 `data_missing`，且不可自动修复。
- [x] 相关 unit tests 与 build 通过。

## 范围
- 会改：
  - `lib/ai/intent-e2e-failure-triage.ts`
  - `tests/unit/intent-e2e-failure-triage.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - modal request corpus
  - release-guard baseline
  - 数据库 schema
  - 业务页面脚本

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Post Phase 22，按真实 `AI生成` 高收益 family 补证据和 guard。
- 对应小步：先诊断 `modal_or_drawer_save` 是否可以进入 release guard；若不满足，明确缺口类型。
- 本轮完成后回写：第五百零九次更新。

## 本轮完成
- 跑 `modal_or_drawer_save` 当前 fresh rerun：
  - report：[2026-04-30T04-37-30-661Z-family-modal_or_drawer_save-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-30T04-37-30-661Z-family-modal_or_drawer_save-fresh-rerun.json)
  - `terminal=3 / passed=2 / failed=1`
  - `knowledgeHitRate=100`
  - `recipeHitRuns=3`
  - `playbookHitRuns=3`
- 失败 run：
  - `intent-run-b7c94844-cc1a-450e-801a-5243a284cb4a`
  - 错误为 `跳过: 前置数据不足：筛选“待申请”后无可用订单行`
  - 这不是 route / recipe / OCR 问题，也不是应继续自修的 selector 问题。
- failure triage 增加优先规则：
  - `跳过: 前置数据不足`
  - `筛选“待申请”后无可用订单行`
  - `筛选结果中无可勾选订单行`
  - 归类为 `data_missing / repairable=false`
- 单测补充了该 live-run wording，避免后续再被通用 locator 规则吞成 `selector_drift`。

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 720000 --json`
  - 通过生成报告，当前窗口 `2/3 passed`，`3/3 playbook hit`。
- `npx vitest run tests/unit/intent-e2e-failure-triage.spec.ts`
  - 通过，`27` tests。
- `npx vitest run tests/unit/intent-e2e-failure-triage.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts tests/unit/intent-e2e-benchmark.spec.ts`
  - 通过，`4` files / `52` tests。
- `npm run build`
  - 通过。

## 风险 / 未覆盖
- 当前 modal family 还不能进入 release guard：3-run 当前窗口只有 `66.7% terminal pass`。
- 失败来自业务数据前置不足；真正要提升 terminal pass，需要 fixture / seed / launch gate 把“无待申请可入账订单”转为 `needs_fixture` 或可控数据。
- 本轮不改 corpus，也不把 modal 伪装成 release-ready family。

## 完成后动作
- 回写 roadmap。
- 后续若继续治理 modal，最高优先级是补 fixture/数据前提契约，而不是继续调 prompt。
