# Task Brief

## 标题
- Phase 5 / 第二十三刀：admissibility judgement

## 背景
- `Phase 5 / 第二十二刀` 已完成 closure baseline freeze。
- 最新稳定 baseline 是 `bench_eb23b072bd51`。
- 当前需要只读判断是否允许开启第二十三刀，并明确首个 target branch。

## 本轮目标
- 复核第二十二刀收官锚点。
- 核对 benchmark 主链相关文件是否在 freeze 后发生新的代码 / harness 改动。
- 根据当前四个 modal non-weak cases 的 frozen metrics 选择第二十三刀首个 target branch。
- 不执行 rerun / replay / compare / freeze，不改代码。

## 验收标准
- [ ] baseline pointer 指向 `bench_eb23b072bd51`
- [ ] 第二十二刀 same-new-baseline compare `regressedCases=0`
- [ ] 当前无 freeze 后新增的 in-scope 代码 / harness 改动
- [ ] 明确第二十三刀是否允许开启
- [ ] 明确首个 target branch

## 范围
- 会改：
  - `docs/intent-e2e-phase5-twenty-third-cut-admissibility-judgement-task-brief-2026-04-28.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - benchmark reports
  - request corpus

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-twenty-second-cut-closure-baseline-freeze-task-brief-2026-04-28.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-28T05-42-07-512Z-bench_eb23b072bd51.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T05-46-06-343Z-bench_eb23b072bd51-phase5-twenty-second-cut-closure-modal-non-weak-current-2026-04-28.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二十三刀`
- 对应小步：admissibility judgement
- 本轮完成后回写：
  - admissibility 结论
  - target branch
  - 是否允许进入 benchmark execution

## 计划修改点
- 只读读取最新 baseline。
- 只读核对 roadmap 最新收官记录。
- 只读核对主链相关文件 mtime。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- admissibility 只判断是否允许开启，不代表第二十三刀已经拿到 improvement。
- 若后续 fresh sample 失败，需要单独进入恢复判断，不能把准入判断当成功证明。

## 完成后动作
- 若允许开启，则进入 `Phase 5 / 第二十三刀：ui_extract first admissible sample`。
