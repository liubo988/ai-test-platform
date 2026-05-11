# Phase 11：cross-family release guard

## 背景
- Phase 9 已冻结 `business_create_list_verify` 与 `business_to_order` 的 fresh-window baseline。
- Phase 10 已冻结 `list_search_detail` 的 fresh-window baseline。
- 当前缺口是：三条 baseline 只能逐条手动 compare，缺少一个可重复执行的 release guard 入口。

## 目标
- 新增一个最小 cross-family release guard，统一消费三条 fresh-window baseline。
- guard 对每条 baseline 执行 compare，并在出现 regression、missing case 或 insufficient evidence 时失败。
- 将命令入口、配置和文档说明落盘，便于后续 release 前一键复核。

## 范围
- 新增脚本与小型纯逻辑 helper。
- 新增 `proj_default` 三条 fresh-window baseline 配置。
- 更新 README / runbook / roadmap。
- 不改意图生成、执行器、repair、数据库 schema。

## 验收标准
- [x] `npm run intent:release-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json --json` 可执行。
- [x] guard 同时覆盖 `business_create_list_verify`、`business_to_order`、`list_search_detail`。
- [x] 当前三条 fresh-window baseline compare 均通过，且生成汇总 report。
- [x] 单测覆盖 guard failure 判定。
- [x] `npm run build`、相关 unit、roadmap/doc link/diff 校验通过。

## 执行结果
- 新增 release guard 纯逻辑：
  - [lib/intent-e2e-release-guard.ts](/Users/xiaolongbao/Workspace/ai-test/lib/intent-e2e-release-guard.ts)
  - 负责 config 归一化、compare report 失败判定、汇总 report 生成。
- 新增 CLI：
  - [scripts/intent-e2e-release-guard.ts](/Users/xiaolongbao/Workspace/ai-test/scripts/intent-e2e-release-guard.ts)
  - npm 入口：`npm run intent:release-guard`
- 新增 `proj_default` baseline 配置：
  - [artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json](/Users/xiaolongbao/Workspace/ai-test/artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json)
  - 覆盖三条 fresh-window baseline：`bench_409f923ca053`、`bench_1b1ffa81dc16`、`bench_c45252cb7ff0`。
- 第一次 guard 暴露出单 family compare 的窗口语义问题：
  - `--run-limit` 是先按项目取最近 N 条 terminal，再按 family 过滤；Phase 10 新增的 `list_search_detail` 样本排在最前面，导致 Phase 9 两条 baseline 在小窗口里只拿到 2/1 条当前样本，被判 `insufficient_evidence`。
  - 已按现有官方机制补三条 `current-slice`，并让配置使用 `runLimit=200 + currentSlicePath`，既避免跨 family 排序污染，也避免把修复前旧失败混进 fresh-window gate。
- current-slice：
  - `business_create_list_verify`：`slice_1aceddb15847`
    - [2026-04-28T09-41-36-545Z-slice_1aceddb15847.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-28T09-41-36-545Z-slice_1aceddb15847.json)
  - `business_to_order`：`slice_ba3b9e08ae78`
    - [2026-04-28T09-41-36-417Z-slice_ba3b9e08ae78.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-28T09-41-36-417Z-slice_ba3b9e08ae78.json)
  - `list_search_detail`：`slice_397747273ba6`
    - [2026-04-28T09-41-36-395Z-slice_397747273ba6.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-28T09-41-36-395Z-slice_397747273ba6.json)
- release guard 最终通过：
  - report：[2026-04-28T09-42-01-622Z-phase11-cross-family-release-guard.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.release-guard-reports/2026-04-28T09-42-01-622Z-phase11-cross-family-release-guard.json)
  - `passed=true / baselineCount=3 / passedBaselines=3 / failedBaselines=0 / totalCases=3 / regressedCases=0 / missingCases=0 / insufficientEvidenceCases=0`
  - 三条 baseline 当前均为 `frozenTerminalPassRate=100 -> currentTerminalPassRate=100`、`frozenFirstPassPassRate=100 -> currentFirstPassPassRate=100`、`frozenBlockedRate=0 -> currentBlockedRate=0`。

## 验证命令
- `npm run intent:release-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json --json`
  - 通过，见 release guard report [2026-04-28T09-42-01-622Z-phase11-cross-family-release-guard.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.release-guard-reports/2026-04-28T09-42-01-622Z-phase11-cross-family-release-guard.json)。
- `npx vitest run tests/unit/intent-e2e-release-guard.spec.ts`
  - 通过，`4/4`。
- `npm run build`
  - 通过。
- `node scripts/check-roadmap-progress.mjs`
  - 通过，`486 updates checked`。
- `node scripts/check-doc-links.mjs`
  - 通过，`6 files checked`。
- `git diff --check`
  - 通过。
