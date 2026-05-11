# Task Brief

## 标题
- Phase 6：failure trace governance + cross-family holdout closure

## 背景
- Phase 5 已在 `modal_or_drawer_save` non-weak proof window 上完成最终收口，最新稳定基线为 `bench_3cc174c3ccbb`。
- Phase 5 final baseline 仍保留历史失败桶：`env_transient`、`record_lookup_miss`、`data_missing`、`unknown`。
- 这些失败桶不再阻断 Phase 5 family gate，但如果继续推进下一阶段，需要把失败桶转成可执行治理项，并确认能力不是只对 `modal_or_drawer_save` 过拟合。

## 本轮目标
- 新开 `Phase 6`，不再沿用 Phase 5 numbered cut。
- 在 insights 层新增 failure trace governance 输出，把失败类聚合为可执行治理项、anti-pattern 与 promotion target。
- 对 `business_create_list_verify` 与 `list_search_detail` 建立 cross-family holdout baseline，并保留 `business_to_order` 当前无样本的明确证据。

## 验收标准
- [x] insights 返回 `failureTraceGovernance`，能区分环境 / 数据前提 / verifier 缺口 / unknown triage。
- [x] `unknown` 失败不再只是普通统计桶，必须进入需要 triage 的治理项。
- [x] `record_lookup_miss / target_row_not_found / response_missing` 能被归入 verifier / workflow 治理项并带 anti-pattern。
- [x] `business_create_list_verify` 与 `list_search_detail` 均有 freeze / replay / compare 证据。
- [x] `business_to_order` 无 terminal runs 的现状被记录为 Phase 6 范围外 blocker，不伪造 baseline。

## 范围
- 会改：
  - `lib/ai/intent-e2e-insights.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/intent-e2e-insights.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 会运行：
  - `npm run intent:benchmark:candidates`
  - `npm run intent:benchmark:freeze`
  - `npm run intent:benchmark:replay`
  - `npm run intent:benchmark:compare`
- 不会改：
  - DB schema
  - benchmark harness 语义
  - Phase 5 final baseline 历史事实
  - 非 intent-e2e 主链路

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-experience-recall-playbook-plan-2026-04-09.md`

## Roadmap 对齐
- 当前阶段：Phase 6
- 对应小步：
  - Phase 6 / 第一刀：failure trace governance 输出
  - Phase 6 / 第二刀：cross-family holdout baseline freeze
- 本轮完成后回写：
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## 计划修改点
- 在 insights 聚合阶段新增 failure governance item / overview。
- 在 workbench insights 面板展示 failure trace governance。
- 增加单测覆盖 unknown、record lookup、data/env 三类治理输出。
- 冻结并验证 `business_create_list_verify` 与 `list_search_detail` holdout baseline。

## 验证
- `npx vitest run tests/unit/intent-e2e-insights.spec.ts tests/unit/api-intent-e2e-insights-route.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- `business_to_order` 当前没有可用 terminal runs，本轮只记录 blocker，不伪造样本。
- Phase 6 本轮不承诺把所有 family 提升到 90%；重点是治理可解释性与跨 family baseline 建立。
- failure governance 首版只做 insights / workbench 输出，不自动写入 knowledge / recipe。

## 完成后动作
- 按 roadmap 模板回写 Phase 6 完成证据。
- 若 benchmark baseline 成立，记录 benchmark UID、report path 与 compare summary。
