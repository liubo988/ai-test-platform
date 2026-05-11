# Task Brief

## 标题
- Phase 5 / 第三刀：ui_extract fixed-slice post-topup recovery judgement

## 背景
- 第三刀 first admissible sample 已执行：
  - dedicated `ui_extract` fresh run clean
  - target case `ui_extract` 在 compare 中已 improved
- 但 unsliced official compare 仍不 clean：
  - `regressedCases=1`
  - stop 落在 `ui_extract_assert`
- 当前需要判断：
  - 这是 fresh repo blocker
  - 还是 current-window debt / slice boundary 问题
- 本轮只允许做 fixed-slice recovery judgement 与必要 top-up，不改代码。

## 本轮目标
- 用最小 current-slice 证明 unsliced regression 是否来自旧窗口债务。
- 若首个 slice 仍不 clean，只允许继续收窄 slice boundary 并做最小 top-up。
- 拿到一个 compare-clean 的第三刀 recovery evidence，供后续 closure freeze 使用。

## 验收标准
- [ ] 明确首个 fixed slice 是否足够
- [ ] 若不足够，明确新的 admissible boundary
- [ ] 最终 fixed-slice compare 达到 `regressedCases=0`
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-third-cut-ui-extract-fixed-slice-post-topup-recovery-judgement-task-brief-2026-04-24.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - `lib/test-worker.mjs`
  - `lib/ai/intent-e2e-service.ts`

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-third-cut-ui-extract-first-admissible-sample-task-brief-2026-04-24.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T06-22-25-827Z-bench_1192769e53a5-phase5-third-cut-ui_extract-first-admissible-sample-current-2026-04-24.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第三刀`
- 对应小步：`ui_extract fixed-slice post-topup recovery judgement`
- 本轮完成后回写：
  - slice boundary 选择
  - top-up 结果
  - fixed-slice compare 是否 clean

## 计划修改点
- 先围绕 unsliced compare stop 创建最小 fixed slice。
- 若首个 slice 仍残留旧 debt，只允许继续后移 boundary，不做代码修补。
- 围绕 `ui_extract_assert / ui_assert_extract / assert_extract_ui / ui_extract` 做最小 dedicated top-up，使 fixed slice 下四条 case 都达到 `3/3` 新鲜样本。
- 在 final fixed slice 上执行 replay / compare judgement。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- fixed-slice recovery 只能证明 current-window debt 可被隔离，不等于历史 baseline 债务消失。
- 若 slice 后仍出现 fresh failureClass，则下一轮可能要回到第三刀内的 code / harness diagnosis。

## 完成后动作
- 回写 roadmap
- 若 final fixed-slice compare clean，下一轮进入第三刀收官 freeze
