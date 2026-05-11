# Task Brief

## 标题
- Phase 22 / 第一刀：real-traffic measurement contract and reporting bootstrap

## 背景
- release-readiness 主线已完成，但当前 100% 证据只覆盖 3 个已治理 family 的小样本 release window。
- 该证据不能外推为“所有 AI 生成 100%”。
- 下一阶段先建立真实流量统计口径，再选择 document top families；本轮不进入 OCR-first。

## 本轮目标
- 固化真实 AI 生成成功率统计契约。
- 把 `real_click / draft_import / benchmark_rerun / replay` 分开统计，避免混统。
- 输出最近窗口 traffic-quality JSON / Markdown 报表，供后续 document top family 选择使用。

## 验收标准
- [x] 固化 counters：
  - `launch_click_count`
  - `draft_generated_count`
  - `launch_gate_passed_count`
  - `auto_run_started_count`
  - `terminal_run_count`
  - `terminal_pass_count`
- [x] 固化 dimensions：
  - `source`
  - `attachment`
  - `launchDecision`
  - `priorityScenarioFamily`
- [x] 新增独立 traffic-quality service 和报表脚本。
- [x] 报表能输出最近窗口 JSON / MD，并按 source / attachment / launchDecision / priorityScenarioFamily 分桶。
- [x] `real_click` 成功率与 `benchmark_rerun / replay` 完全分离。
- [x] 不改 release-readiness completion summary 既有口径。

## 范围
- 会改：
  - `lib/intent-e2e-traffic-quality.ts`
  - `scripts/intent-e2e-traffic-quality-report.ts`
  - `app/api/intent-e2e/launch-decision/route.ts`
  - `app/api/intent-e2e/runs/route.ts`
  - `app/api/projects/[projectUid]/intent-drafts/route.ts`
  - `app/api/projects/[projectUid]/intent-drafts/[draftUid]/route.ts`
  - 对应 unit tests
  - README / runbook / roadmap
- 不会改：
  - document family recipe / verifier / fixture
  - OCR route / verifier
  - benchmark harness
  - release-readiness completion summary 既有口径
  - 数据库 schema

## 验证
- `npx vitest run tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts tests/unit/api-intent-e2e-runs-route.spec.ts tests/unit/api-project-intent-drafts-route.spec.ts tests/unit/api-project-intent-draft-route.spec.ts`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30 --json`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check`

## 验证结果
- `npx vitest run tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts tests/unit/api-intent-e2e-runs-route.spec.ts tests/unit/api-project-intent-drafts-route.spec.ts tests/unit/api-project-intent-draft-route.spec.ts`
  - 通过，`5` files / `12` tests。
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30`
  - 通过，写出 JSON / Markdown。
- `npm run build`
  - 通过。
- `npm run build:web`
  - 通过。
- `npm run test:integration`
  - 通过，`8` files / `24` tests。
- `bash scripts/check-boundaries.sh`
  - 通过。
- `node scripts/check-doc-links.mjs`
  - 通过。
- `node scripts/check-roadmap-progress.mjs`
  - 通过。
- `git diff --check`
  - 通过。
