# Task Brief

## 标题
- Phase 5 第二刀：`ui_extract_assert record_lookup_miss` Step 7 deterministic root-cause diagnosis

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官锚点仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀固定 latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 当前被诊断的 failed compare artifact 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T02-32-38-601Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-current-2026-04-21.json`
- 已固定前提：
  - quiet-window / foreign interference / active pollution / `env_transient` 已被排除为本次 compare failure 主因
  - `ui_extract_assert`-only `5/5` clean bounded batch 在 quiet-window 下仍然 official compare regressed
  - 上一轮 strategy-switch decision 已固定为 `S2`
  - 因此下一步不是 benchmark、不是 corpus design、不是 harness 变更，而是先把 `ui_extract_assert` 的 dominant deterministic debt 收敛到单一最小 patch surface

## 本轮目标
- 只做 read-only root-cause diagnosis。
- 明确回答当前 residual debt 的最小 code-path surface 究竟落在：
  - `P1`：`selectedOrderNo / stable identifier` 提取脏化
  - `P2`：Step 7 generator skeleton / second-anchor / row reuse 注入不稳定
  - `P3`：`lib/test-worker.mjs` 的 `resolvePrimaryRecord` runtime 语义
  - `P4`：证据不足，不能安全进入最小代码修补轮
- 若结论不是 `P4`，给出下一轮 exact task shape。

## 验收标准
- [ ] 明确给出 `P1 / P2 / P3 / P4` 唯一结论
- [ ] 明确写出为什么不是另外三条
- [ ] 明确说明当前 debt 是否已从旧的 `Step 8 / Verification` gap 转移到 `Step 7`
- [ ] 明确指出最小 patch surface 的首文件 / 首逻辑点 / 首类 regression test
- [ ] 若结论不是 `P4`，给出下一轮 exact task shape
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-record-lookup-miss-step7-root-cause-diagnosis-task-brief-2026-04-21.md`
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
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-strategy-switch-decision-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-task-brief-2026-04-21.md`
- `docs/intent-e2e-next-stage-first-cut-ui-extract-assert-code-recovery-task-brief-2026-04-18.md`
- `docs/intent-e2e-next-stage-first-cut-modal-ui-extract-assert-record-lookup-miss-task-brief-2026-04-17.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T06-08-21-918Z-bench_e135a81a2d2f.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T02-32-38-601Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-current-2026-04-21.json`
- `reports/intent-e2e/runs/intent-run-1072dbf3-bc64-454e-a979-7abc16ad2643/attempt-1-trace.json`
- `reports/intent-e2e/runs/intent-run-1072dbf3-bc64-454e-a979-7abc16ad2643/attempt-2-trace.json`
- `reports/intent-e2e/runs/intent-run-1072dbf3-bc64-454e-a979-7abc16ad2643/attempt-2-repair-observation.json`
- `reports/intent-e2e/runs/intent-run-30d936b6-ca98-4551-858e-6fb25516396b/attempt-1-trace.json`
- `reports/intent-e2e/runs/intent-run-ed16d258-332e-44f1-9310-e7c5438050f2/attempt-1-trace.json`
- `reports/intent-e2e/runs/intent-run-759366fb-7d29-445e-9d6e-80a8f49ebd32/attempt-1-trace.json`
- `lib/test-generator.ts`
- `lib/test-worker.mjs`
- `lib/intent-recipe-registry.ts`
- `lib/intent-action-library.ts`
- `tests/unit/test-generator.spec.ts`

## Roadmap 对齐
- 当前阶段：Phase 5 第二刀
- 对应小步：`ui_extract_assert record_lookup_miss` Step 7 deterministic root-cause diagnosis
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 只读复核 latest compare 的 current failure shape 与 dominant verifier check。
- 只读复核代表 run `intent-run-1072dbf3-bc64-454e-a979-7abc16ad2643` 的 attempt-1 / attempt-2 / repair observation。
- 只读复核被 zero-sum replacement 挤出的历史 failed traces 是否同源。
- 对照 `lib/test-generator.ts` 与 `lib/test-worker.mjs`，判断最小 patch surface 是 generator output 还是 runtime helper。
- 固定下一轮 exact task shape。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不改代码、不跑 benchmark，因此只能固定最小 patch surface，不能直接验证该 patch 一定成功。
- 若当前本地 `lib/test-generator.ts` / `tests/unit/test-generator.spec.ts` 存在用户未提交脏改动，本轮只把它们当只读上下文，不覆盖、不回退。

## 完成后动作
- 回写 roadmap
- 跑文档校验

## 只读结论回填
- 当前唯一结论固定为：
  - `P2 = 问题主要在 Step 7 generator skeleton 本身，第二锚点 / row reuse / search surface 注入不稳定`
- 证据收敛如下：
  - latest compare 的 `currentTopFailureReasons` 仍以 `record_lookup_miss` 为主，且 latest repair observation verifier check UID 固定落在 `verify_step_plan_step_7_14`
  - 代表 run `intent-run-1072dbf3-bc64-454e-a979-7abc16ad2643` 的 attempt-2 repair patch，`plan_step_7` 仍只用 `rowHasTexts: [shared.selectedOrderNo]`
  - 同一条 run 的 attempt-1 `Step 8 / Verification` 已经出现更强的 `batchAccountRowHasTexts`、`selectedServiceItem / selectedAmount` 第二锚点和 `artifacts['plan_step_7_row'] / artifacts['plan_step_7_record']` reuse
  - 被 zero-sum replacement 挤出的历史 failed traces 也都稳定落在“未通过唯一订单号稳定命中列表目标行”
- 为什么不是 `P1`：
  - 代表 run 的 repair observation 已经留下 `field=订单号 value=202604151358340429`
  - 当前失败更像 lookup 阶段没有稳定利用第二锚点，而不是主键本身被手机号 / 状态文本污染
- 为什么不是 `P3`：
  - `lib/test-worker.mjs` 的 `findAntdTableRow` / `resolvePrimaryRecord` 会保留调用方传入的 `rowHasTexts`
  - 当前 trace 的主问题是 generator 实际喂给 helper 的仍是单键 `[shared.selectedOrderNo]`
  - 现有只读证据还不足以证明 helper 在收到强双锚点输入后也会错误退化
- 为什么不是 `P4`：
  - compare、trace、repair observation、历史同源 failed traces、generator / helper 对照已经共同把 debt 收敛到单一 generator patch surface
- 当前 debt 已明确从旧的 `Step 8 / Verification` gap 转移到 `Step 7`：
  - `2026-04-18` 那轮收的是 `Step 8 / Verification` 的 multiline sanitizer 缺口
  - 当前 residual trace 里真正失败的是 `plan_step_7` 自身仍发出弱单锚点 lookup
- 最小 patch surface 固定为：
  - 首文件：`lib/test-generator.ts`
  - 首逻辑点：bookedMgmt `plan_step_7` canonical lookup emission，优先从 `buildBatchAccountStep6LookupResolveBlock(...)` 收紧，并确保 `buildBatchAccountDisambiguatedRowHasTextsLines(...)` 与 Step 7 row reuse 发射点不再退回 bare `[shared.selectedOrderNo]`
  - 首类 regression test：`tests/unit/test-generator.spec.ts` 中的 bookedMgmt `plan_step_7` sanitize / rewrite regression tests
- 下一轮 exact task shape 固定为：
  - 任务标题：
    - `Phase 5 / 第二刀：ui_extract_assert step-7 bookedMgmt lookup skeleton hardening`
  - 会改：
    - `lib/test-generator.ts`
    - `tests/unit/test-generator.spec.ts`
    - 新的 code-recovery brief
    - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - 不会改：
    - `lib/test-worker.mjs`
    - benchmark harness
    - benchmark pointer
    - corpus 资产
    - 其他生产路径
  - benchmark：
    - 下一轮首动作不允许 benchmark；先完成最小 generator patch 与 unit regression，再由后续专门执行轮决定是否放行 benchmark
  - stop condition：
    - 如果 patch 设计过程中发现必须改 `lib/test-worker.mjs` 才能成立，立刻停止并重新判断是否从 `P2` 转向 `P3`
    - 如果 patch 不再能维持在 Step 7 局部，而要扩成 broad cleanup / harness 调整，立刻停止
