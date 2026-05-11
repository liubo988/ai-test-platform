# Task Brief

## 标题
- Phase 5 / 第十六刀：admissibility judgement

## 背景
- `Phase 5 / 第十五刀` 的 fixed-slice recovery、closure freeze、same-baseline compare 已在 `bench_3b398c5b3e28` 上执行完成。
- 但随后 `intent-e2e：商机222 draft success reuse lookback recovery` 修改了 `lib/ai/intent-e2e-service.ts`，且修改时间晚于第十五刀 freeze。
- 当前问题不再是“第十五刀当时有没有收官”，而是“这份收官证据在当前代码状态下是否仍可直接沿用，以及第十六刀是否还能直接开启”。

## 本轮目标
- 只读判断第十五刀 closure evidence 是否因 shared-path 改动而失效。
- 判断当前是否允许直接开启 `Phase 5 / 第十六刀`。
- 若不允许，固定下一步的最小 closure-proof recovery 计划。

## 验收标准
- [ ] 明确判断第十五刀 closure evidence 在当前代码状态下是否仍可沿用
- [ ] 明确判断第十六刀是否允许直接开启
- [ ] 明确指出当前 shared-path 变更的具体文件与时间边界
- [ ] 给出下一步 exact command plan
- [ ] 不执行 rerun / replay / compare / freeze

## 范围
- 会改：
  - `docs/intent-e2e-phase5-sixteenth-cut-admissibility-judgement-task-brief-2026-04-27.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `lib/test-worker.mjs`
  - `scripts/intent-e2e-benchmark.ts`

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-fifteenth-cut-closure-baseline-freeze-task-brief-2026-04-27.md`
- `docs/intent-e2e-business-create-list-verify-draft-success-reuse-lookback-recovery-task-brief-2026-04-27.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第十五刀` 已拿到历史收官产物，但当前代码状态需重判 admissibility
- 对应小步：sixteenth-cut admissibility judgement
- 本轮完成后回写：
  - 第十五刀 historical closure 产物
  - 当前 shared-path invalidation 结论
  - 下一步 closure-proof recovery 计划

## 计划修改点
- 核对 `bench_3b398c5b3e28` 的 freeze / compare 时间。
- 核对 benchmark 主链相关 dirty files 的当前时间边界，确认是否存在晚于第十五刀 freeze 的 in-scope 改动。
- 若 closure evidence 失效，则把下一步固定为 current-code-state closure-proof recovery，而不是直接开第十六刀。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只做 admissibility judgement，不证明当前代码状态已经恢复 closure proof。
- 若后续 recovery compare 仍不 clean，则第十六刀仍不得开启。

## 完成后动作
- 回写 roadmap
- 若 judgement 结论是不允许直开第十六刀，则下一轮进入 `Phase 5 / 第十五刀收官后：post-shared-path closure proof recovery`
