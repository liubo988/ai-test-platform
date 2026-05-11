# Intent E2E Final Delivery Closure and Observability Task Brief

## 背景

- release-readiness、traffic-quality、document family governance、new-intent readiness 与 next-development gate 已完成多轮收口。
- 当前最新开发入口应先判断是否存在新的真实流量缺口，而不是继续重复治理已完成 family。
- 用户要求本轮一次性完成最终交付准备，并在完成后统一通知。

## 目标

- 刷新当前关键报表，固定最终交付状态。
- 写出一个稳定的最终交付摘要，说明当前是否还有可继续开发的任务。
- 明确下一轮只在真实观测信号触发时才进入开发。
- 回写 README、handoff、next-development prep 与 roadmap，避免后续状态漂移。

## 范围

- 只做交付文档、报表刷新和验证收口。
- 保持 release-readiness、traffic-quality、benchmark harness 的既有统计口径不变。
- 保持 real_click、draft_import、benchmark_rerun、replay 分母分离。

## 非目标

- 不新增 document family recipe / verifier / fixture。
- 不做 OCR-first。
- 不改 benchmark harness。
- 不改 release-readiness completion summary 语义。
- 不把 benchmark / replay / draft_import 混入真实成功率分母。

## 验收标准

- 最新 traffic-quality、new-intent readiness、fixture bootstrap、priority triage、document governance、document guard、next-development plan 已刷新。
- 最终交付摘要说明当前发布状态、真实成功率、新意图 readiness、fixture bootstrap、next-development gate 和后续触发条件。
- README、handoff、next-development prep 与 roadmap 已回写最终状态。
- 本地验证通过：
  - `npx vitest run tests/unit/intent-e2e-next-development-plan.spec.ts tests/unit/intent-e2e-new-intent-readiness.spec.ts tests/unit/intent-e2e-known-fixture-governance.spec.ts tests/unit/intent-e2e-fixture-executor.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-recipe-registry.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `bash scripts/check-boundaries.sh`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
  - `git diff --check && git diff --cached --check`
