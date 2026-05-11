# Task Brief

## 标题
- Phase 5 第二刀：ui_extract_assert compare-window recoverability diagnosis

## 背景
- 当前已经进入 Phase 5。
- Phase 5 第一刀已经正式收官。
- 当前这轮仍是 Phase 5 第二刀，不是第一刀 freeze，也不是第三刀。
- 当前官方 baseline：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T06-08-21-918Z-bench_e135a81a2d2f.json`
- 当前 benchmark pointer：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_e135a81a2d2f`
- 第一刀 closure compare：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
  - 结果：`unchanged / regressedCases=0 / insufficientEvidenceCases=0`
- 第二刀 latest compare：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 当前唯一 blocker 不是第二刀 target `ui_assert_extract` 本身，而是 latest compare 里唯一残留的 `ui_extract_assert` compare-window regression。

## 本轮目标
- 只做一个 bounded step：
  - brief
  - read-only compare-window recoverability diagnosis
  - roadmap 回写
  - 文档校验
- 本轮不执行真实 rerun。
- 本轮不执行 replay。
- 本轮不执行 compare。
- 本轮不执行 freeze。
- 本轮不改代码。
- 本轮不改 benchmark harness。
- 本轮不开第三刀。

## 需要回答的问题
- `ui_extract_assert` 相比 baseline 具体少掉了哪条 `sampleRunId`
- 掉出的 run 是否：
  - terminal passed
  - first-pass passed
  - 实际属于 `ui_extract_assert`
- 当前窗口边界后 3 到 5 条更老 run 是否也都是：
  - terminal passed
  - first-pass passed
  - 仍属于 `ui_extract_assert`
- 在 latest-200 window 语义下，再补 1 条 `ui_extract_assert` clean pass 是否大概率只是零和
- repo 当前是否存在 dedicated `ui_extract_assert` corpus
- 若不存在，repo-native historical evidence 是否仍只支持 low-pass request 2 / 3 会流向 `ui_extract_assert`

## 允许读取
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T06-08-21-918Z-bench_e135a81a2d2f.json`
- `reports/intent-e2e/runs/<runId>/**`
- `artifacts/intent-e2e-family-evidence/**`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## 禁止事项
- 不运行：
  - `npm run intent:benchmark:rerun`
  - `npm run intent:benchmark:replay`
  - `npm run intent:benchmark:compare`
  - `npm run intent:benchmark:freeze`
- 不创建新的 request corpus 去执行 benchmark
- 不改 `lib/**` / `scripts/**` / `tests/**`
- 不做任何生产代码或 harness 修改

## 停止条件
- 如果诊断发现证据链不足以判断掉窗 run 和边界 run 的真实属性，立即停止并只报告证据缺口。
- 如果诊断过程中发现必须执行真实 benchmark 才能回答问题，立即停止；本轮范围不允许。
- 如果诊断过程中发现必须改代码或改 harness 才能回答问题，立即停止；本轮范围不允许。
