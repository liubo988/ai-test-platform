# Task Brief

## 标题
- Phase 5 / 第二刀：`ui_extract_assert step-7 bookedMgmt lookup skeleton hardening`

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官锚点仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 fixed latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 当前 failed compare artifact 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T02-32-38-601Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-current-2026-04-21.json`
- 上一轮只读根因诊断已固定为：
  - `P2`
  - residual debt 已前移到 `Step 7 bookedMgmt lookup skeleton`
  - 最小 patch surface 固定在 `lib/test-generator.ts`
  - 不需要先改 `lib/test-worker.mjs`

## 本轮目标
- 只做最小 generator patch。
- 只收口 bookedMgmt `plan_step_7` 的 canonical emission / sanitize / rewrite。
- 让 Step 7 稳定：
  - 注入 `batchAccountRowHasTexts`
  - 注入 `allowMultipleUniqueMatches: batchAccountRowHasTextsAllowMultipleUniqueMatches`
  - 注入 `keywordInput` / `searchButton` / `preferCurrentVisibleRow: false` / `listResponse`
  - 强制回写 canonical `artifacts['plan_step_7_row'] / artifacts['plan_step_7_record']`
  - 不再残留 bare `rowHasTexts: [shared.selectedOrderNo]` 的主 lookup shape

## 验收标准
- [ ] patch 保持在 generator 层，不改 `lib/test-worker.mjs`
- [ ] bookedMgmt `plan_step_7` 旧弱 shape 会被重写成 helper-driven + disambiguated anchors
- [ ] bookedMgmt `plan_step_7` 即使只写自定义 alias，也会补 canonical `plan_step_7_row / plan_step_7_record`
- [ ] `tests/unit/test-generator.spec.ts` 覆盖 Step 7 skeleton hardening regression
- [ ] `npx vitest run tests/unit/test-generator.spec.ts`
- [ ] `npm run build`
- [ ] `npm run build:web`
- [ ] `bash scripts/check-boundaries.sh`
- [ ] `node scripts/check-doc-links.mjs`
- [ ] `node scripts/check-roadmap-progress.mjs`

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-step7-bookedmgmt-lookup-skeleton-hardening-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-worker.mjs`
  - benchmark harness
  - benchmark pointer
  - corpus 资产
  - `scripts/**`
  - `tests/e2e/generated/**`
  - rerun / replay / compare / freeze

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-record-lookup-miss-step7-root-cause-diagnosis-task-brief-2026-04-21.md`
- `docs/intent-e2e-next-stage-first-cut-ui-extract-assert-code-recovery-task-brief-2026-04-18.md`
- `lib/test-generator.ts`
- `tests/unit/test-generator.spec.ts`

## Roadmap 对齐
- 当前阶段：`Phase 5 第二刀`
- 对应小步：`ui_extract_assert step-7 bookedMgmt lookup skeleton hardening`
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 收紧 `buildBatchAccountAccountListResolveBlock(...)`，让 canonical Step 7 artifacts 恒定落盘，不受 legacy alias shape 影响。
- 保留 Step 7 在 generator 层的双锚点 lookup、visible keyword input、response/row/record reuse 注入。
- 更新 bookedMgmt Step 7 regression tests，锁定：
  - 弱单锚点 `rowHasTexts` 不再作为主 lookup shape
  - canonical `plan_step_7_row / plan_step_7_record` 必定存在
  - 自定义 alias 仍被保留

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不执行 benchmark，因此只验证 generator / unit / build 面，不验证 compare 是否回正。
- `lib/test-generator.ts` 与 `tests/unit/test-generator.spec.ts` 当前均有用户脏改动；本轮只能在现有状态上做增量，不回退。
- 若验证中发现必须改 `lib/test-worker.mjs` 才能成立，则应立即停下并按 stop condition 上报。

## 完成后动作
- 回写 roadmap
- 跑文档校验
- 明确保持 `Phase 5 第二刀`，且 benchmark 尚未执行
