# Task Brief

## 标题
- Phase 1.14 business_create_list_verify fresh live evidence

## 背景
- Phase 1.13 已在 generator deterministic sanitizer 中修掉 `business_create_list_verify` Step 6 的 stale-row 读取形态，但还没有 fresh live rerun 证据证明旧的约 30s `json record not found` 空档已经退出。
- 当前旧基线仍只有 `intent-run-2f2900d2-b56e-4f8c-ab12-b515ecb7f0cb` 与 `intent-run-c23d6981-e30f-4219-8403-576fe32af5a6` 两条 run，它们都表现为 Step 6 约 `36.6s`、Verification 仅十几毫秒，且日志里存在同类 stale-row gap。

## 本轮目标
- 只补 `business_create_list_verify` 的 tracked request corpus。
- 只用现有 benchmark rerun 入口跑 fresh live evidence，并给出 before / after。
- 如果 fresh rerun 已证明修复生效，本轮不再继续改代码，也不进入 Phase 2/3/4。

## 验收标准
- [ ] 新增正式 tracked corpus：`artifacts/intent-e2e-family-evidence/proj_default.business-create-list-verify.request-corpus.json`
- [ ] 至少 1 条 fresh terminal pass 能命中 `business_create_list_verify`
- [ ] 至少 1 条 fresh passed run 的 Step 6 明显低于旧 floor `36.6s`，且不再出现旧的约 `30s` `json record not found` gap
- [ ] 若 fresh rerun 已证明修复生效，本轮不改 runtime 代码；若未证明，再基于 fresh artifact 判断是否存在 generator missed shape

## 范围
- 会改：
  - `artifacts/intent-e2e-family-evidence/proj_default.business-create-list-verify.request-corpus.json`
  - `docs/intent-e2e-phase1-14-business-step6-live-evidence-task-brief-2026-04-15.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 新 benchmark harness
  - `list_search_detail / modal_or_drawer_save` 主链路
  - `lib/test-worker.mjs`
  - Phase 2/3/4 相关能力

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase1-13-business-create-step6-latency-fix-task-brief-2026-04-15.md`

## Roadmap 对齐
- 当前阶段：Phase 1.14 live evidence closure
- 对应小步：`business_create_list_verify` tracked corpus + fresh Step 6 latency evidence
- 本轮完成后回写：roadmap 最新一条更新，明确“本轮如果只完成取证，仍然不是 Phase 2”

## 计划修改点
- 参考现有 tracked corpus 结构与旧成功 run 的真实骨架，新增 `business_create_list_verify` 三条 anchor request
- 使用现有 `intent:benchmark:rerun` 入口跑 fresh live rerun，并逐 run 抽取 Step 6 / Verification / stale-gap 证据
- 若 fresh 样本已否定旧 stale-row 模式，则只回写文档；只有 fresh artifact 继续证明存在 generator missed shape 时，才考虑最小 generator follow-up patch

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family business_create_list_verify --request-corpus artifacts/intent-e2e-family-evidence/proj_default.business-create-list-verify.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- 若 fresh rerun 否定修复并触发代码改动，再补完整 runtime 验证集

## 风险 / 未覆盖
- live rerun 受真实环境和账号可用性影响，未必能拿到 3 条 terminal pass。
- 当前仓库存在大量脏改动；本轮只追加 business family 证据资产与文档，不回滚无关修改。
- 如果 fresh rerun 未复现旧 stale-row gap，但出现新的非同类波动，本轮只如实记录，不扩成新的稳定性专项。

## 完成后动作
- 回写 roadmap
- 若 fresh live evidence 已闭环，明确声明本轮仍然只是 Phase 1.14 business Step 6 live evidence closure，不是 Phase 2
