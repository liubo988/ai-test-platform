# Task Brief

## 标题
- 下一阶段第五刀：post-slice corpus-to-case fidelity 诊断 / targeted top-up planning

## 背景
- 当前阶段仍是“下一阶段 / 后续阶段”的第五刀，不是第六刀，也不是 Phase 5。
- 当前 baseline 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T04-10-15-632Z-bench_32c071e12a66.json`
- benchmark 指针仍在：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_32c071e12a66`
- 既有 official current-slice 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json`
- latest sliced compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T07-20-47-678Z-bench_32c071e12a66-next-stage-fifth-cut-sliced-recovery-current-2026-04-18.json`
  - `currentSlice.enabled=true`
  - `regressedCases=0`
  - `insufficientEvidenceCases=3`
- 第一次 sliced evidence top-up 的 round-1 rerun 是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T07-46-32-416Z-family-modal_or_drawer_save-fresh-rerun.json`
- 这轮的直接问题已经不是 compare 污染，而是：
  - round-1 有 1 条 timeout run
  - 两条 clean pass 的实际 case 落点与 low-pass 计划假设不一致
  - 如果不先锁清 request-to-case fidelity，继续整包 low-pass rerun 只会继续把 evidence 加到已经 improved 的 case

## 本轮目标
- 只做“第五刀 post-slice corpus-to-case fidelity 诊断 / targeted top-up planning”。
- 只做：
  - brief
  - roadmap 回写
  - 诊断现有 post-slice evidence 的真实落点
  - 诊断现有 tracked corpora 到 benchmark case 的真实映射
  - 给出唯一推荐的 targeted top-up 计划
  - 文档校验
- 不做新的 rerun。
- 不做新的 official compare report。
- 不做 freeze。
- 不开第六刀。
- 不进入 Phase 5。
- 不改代码。

## 验收标准
- [ ] 明确写出 `intent-run-4b0fca4e-232b-4d23-9f04-2769044fb55a` 当前是否已是 terminal failed snapshot
- [ ] 明确写出 `4b0f...` 是否有本地 run artifact 目录
- [ ] 明确写出 `4b0f...` 在 fixed-slice replay 下是否进入任何 benchmark case sample
- [ ] 明确写出 `intent-run-4ef37809-ecb5-4a6e-8eec-54611287fe53` 与 `intent-run-076eeb15-5a3a-4f7c-97a8-17333780a599` 的真实 case 落点
- [ ] 明确写出 3 个 insufficient cases 当前在 fixed-slice 下的 `runCount / sampleRunIds / gap`
- [ ] 明确写出现有 tracked corpora 到 case 的真实映射
- [ ] 如果映射足够清楚，给出唯一推荐的 targeted top-up 计划；如果不够清楚，明确停止而不是擅自发明 corpus 或改代码
- [ ] 本轮不执行新的 rerun / freeze / 第六刀 / Phase 5

## 范围
- 会读：
  - `AGENTS.md`
  - `README.md`
  - `docs/testing.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `docs/intent-e2e-next-stage-fifth-cut-sliced-insufficient-evidence-evidence-top-up-task-brief-2026-04-18.md`
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - `reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json`
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T07-20-47-678Z-bench_32c071e12a66-next-stage-fifth-cut-sliced-recovery-current-2026-04-18.json`
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T07-46-32-416Z-family-modal_or_drawer_save-fresh-rerun.json`
  - 已有 run artifacts / DB snapshot / benchmark code（只读，必要时）
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json`
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json`
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json`
- 会执行：
  - 只读搜索 / JSON inspection
  - 如确有必要，只读 `npm run intent:benchmark:replay -- --current-slice ... --json`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 会改：
  - `docs/intent-e2e-next-stage-fifth-cut-post-slice-corpus-to-case-fidelity-diagnosis-targeted-top-up-planning-task-brief-2026-04-20.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness 实现
  - corpus 资产内容
  - current-slice 资产
  - baseline / proof-window 语义

## Roadmap 对齐
- 当前阶段：后续阶段 / 下一阶段第五刀
- 对应小步：post-slice corpus-to-case fidelity 诊断 / targeted top-up planning
- 本轮完成后准备回写：roadmap 最新一条进度更新

## 计划修改点
- 先固定为什么当前仍是第五刀：因为第五刀还没有恢复为 official compare fully actionable clean，也没有做 closure freeze。
- 先固定为什么这轮不能继续整包 low-pass rerun：因为 round-1 的实际落点已经显示 low-pass request-to-case 映射与原计划不一致，继续盲跑只会污染已 improved case 的 current evidence。
- 先固定为什么这轮也不能 freeze：因为 latest sliced compare 仍是 `insufficientEvidenceCases=3`。
- 先锁清 `4b0f...` 的 admissibility：terminal snapshot、本地 artifact、是否进入任何 case sample。
- 再锁清 round-1 两条 clean pass 的真实落点，以及 3 个 insufficient cases 的真实 gap。
- 最后只在映射足够清楚时给出唯一推荐的下一轮 targeted top-up 计划；本轮不执行。

## 验证
- 只读文件核验
- 如确有必要：`npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 如果 `4b0f...` 的 admissibility 仍说不清，本轮必须停在诊断结论。
- 如果 `assert_extract_ui` 没有现成 tracked request 能被 repo-native 历史证据证明会稳定命中，本轮必须停，不得擅自发明新 plan。
- 如果 dedicated `ui-assert-extract` / `ui-extract` corpus 的 case 落点也不稳定，本轮必须停，不得继续建议 rerun。
- 如果诊断需要改代码、改 corpus 或改 current-slice 才能成立，这已经超出本轮范围。

## 完成后动作
- 回写 roadmap
- 明确本轮没有 touched shared path、没有生产代码改动、没有 benchmark harness 改动
- 明确为什么沿用现有 official modal/list clean proof
- 明确下一步不是直接开第六刀、不是直接 freeze、也不是继续整包 low-pass 3 轮
