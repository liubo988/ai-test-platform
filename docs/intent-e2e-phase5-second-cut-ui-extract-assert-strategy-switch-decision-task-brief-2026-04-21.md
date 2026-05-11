# Task Brief

## 标题
- Phase 5 第二刀：`ui_extract_assert` strategy-switch decision

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官锚点仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀固定 latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 最新被诊断的 failed compare artifact 是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T02-32-38-601Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-current-2026-04-21.json`
- 已固定前提：
  - quiet-window / foreign interference / active pollution / `env_transient` 已被排除为本次 compare failure 的主因
  - `ui_extract_assert`-only `5/5` clean bounded batch 在 quiet-window 下仍然 official compare regressed
  - 当前不存在新的 admissible no-code/no-harness benchmark 动作，必须先换策略
- 因此本轮不再讨论 benchmark 执行，而只判断三条策略线谁应先走：
  - `S1`：先补 dedicated `assert_extract_ui` corpus，再设计 paired benchmark recovery
  - `S2`：先转向 `ui_extract_assert` current debt 的 deterministic root-cause / 最小代码方向诊断
  - `S3`：直接转 compare 口径 / benchmark harness 方向

## 本轮目标
- 只做 Phase 5 第二刀 `strategy-switch decision`。
- 明确回答 low-pass request 1 是否已经构成 repo-native 的 `assert_extract_ui` extraction 依据。
- 明确回答 dedicated `assert_extract_ui` corpus 是否足以同时帮助收掉当前 compare 里的两条 regression。
- 明确判断 `ui_extract_assert` current debt 是否已经集中到能支撑“最小代码方向”优先。
- 在 `S1 / S2 / S3` 中给出唯一推荐顺序，并明确说明为什么不是另外两条。
- 若结论为 `S1` 或 `S2`，给出下一轮 exact task shape。

## 验收标准
- [ ] 明确给出 `S1 / S2 / S3` 唯一结论
- [ ] 明确写出为什么不是另外两条
- [ ] 明确回答 dedicated `assert_extract_ui` corpus 是否成立为 repo-native extraction
- [ ] 明确回答 dedicated `assert_extract_ui` corpus 是否足以同时收掉当前两条 regression
- [ ] 明确回答 `ui_extract_assert` current debt 是否已有 deterministic code-direction 证据
- [ ] 若结论为 `S1` 或 `S2`，给出下一轮 exact task shape
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-strategy-switch-decision-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness
  - benchmark pointer
  - 任何生产代码
  - 新 corpus 文件
  - rerun / replay / compare / freeze

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-compare-gap-admissibility-diagnosis-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-first-cut-assert-extract-ui-compare-window-recovery-task-brief-2026-04-20.md`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T06-08-21-918Z-bench_e135a81a2d2f.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-00-00-825Z-bench_cd1dbb7bf7da-phase5-first-cut-assert-extract-ui-compare-window-recovery-current-2026-04-20.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T02-32-38-601Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-current-2026-04-21.json`

## Roadmap 对齐
- 当前阶段：Phase 5 第二刀
- 对应小步：`ui_extract_assert` strategy-switch decision
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 只读复核 `assert_extract_ui` 的 low-pass request 1 历史命中证据。
- 只读复核当前 latest compare 里两条 regression 的 sample composition 与 metrics。
- 只读统计 `ui_extract_assert` current sample 的 failed / blocked debt buckets，并判断是否存在集中 deterministic 代码方向。
- 在 `S1 / S2 / S3` 中做唯一结论，并给出下一轮 exact task shape。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不落地 corpus、不改代码、不改 harness，因此只能决定“先切哪条策略线”，不能直接验证那条策略一定成功。
- 若结论为 `S2`，下一轮仍应先做最小代码方向诊断，而不是直接扩大成 broad cleanup。

## 完成后动作
- 回写 roadmap
- 跑文档校验
