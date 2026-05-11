# Task Brief

## 标题
- Phase 22 / 第二刀：sample readiness and document family selection admissibility

## 背景
- Phase 22 / 第一刀已经把 `real_click / draft_import / benchmark_rerun / replay` 的统计分母拆开，但还没有回答“当前 project 是否已经具备 document family 选择资格”。
- `proj_default` 当前 30 天窗口里 `real_click=0/0`，如果直接进入 document top family 治理，会把缺证据误写成 family 结论。
- 本轮需要把 readiness / fallback / insufficient_evidence 口径固化到报表层，并修正 CLI 默认阈值解析，避免未传参数时被错误降成 `0`。

## 本轮目标
- 在 traffic-quality 报表中新增 `sampleReadiness` 和 `documentFamilySelection`。
- 只有满足 post-instrumentation `real_click` 阈值时，才允许直接从真实点击里选 document family。
- 当 `real_click` 不足时，只允许历史意图草稿作为 fallback bootstrap；如果仍无 document-like 证据，必须显式输出 `insufficient_evidence`。

## 验收标准
- [x] 报表新增 `sampleReadiness`：包含阈值、观测值和 blocking reasons。
- [x] 报表新增 `documentFamilySelection`：区分 `post_instrumentation_real_click`、`historical_intent_drafts_fallback`、`no_document_candidates`、`insufficient_evidence`。
- [x] CLI 可选参数 `--historical-draft-limit`、`--min-real-click-launches`、`--min-real-click-auto-runs`、`--min-real-click-terminal-runs` 生效，未传时保持默认阈值而不是被错误解析为 `0`。
- [x] 单测覆盖 insufficient-evidence、historical fallback、post-instrumentation real_click selection 三条路径。
- [x] `proj_default` 最近 30 天 traffic-quality 报表稳定输出 `readiness=not_ready` 且 `document_selection=insufficient_evidence`。

## 范围
- 会改：
  - `lib/intent-e2e-traffic-quality.ts`
  - `scripts/intent-e2e-traffic-quality-report.ts`
  - `tests/unit/intent-e2e-traffic-quality.spec.ts`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - document family recipe / verifier / fixture 主链路
  - OCR route / verifier
  - benchmark harness
  - release-readiness 既有报表语义
  - 数据库 schema

## 验证
- `npx vitest run tests/unit/intent-e2e-traffic-quality.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 验证结果
- `npx vitest run tests/unit/intent-e2e-traffic-quality.spec.ts`
  - 通过，`4/4`。
- `npm run build`
  - 通过。
- `npm run build:web`
  - 通过。
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30`
  - 通过，写出：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.traffic-quality-report.latest.json`
    - `reports/intent-e2e/projects/proj_default/intent-e2e.traffic-quality-report.latest.md`
  - 当前 30 天窗口摘要：
    - `real_click=0/0`
    - `benchmark_rerun=447/618`
    - `replay=0/0`
    - `readiness=not_ready`
    - `document_selection=insufficient_evidence`
    - `historicalIntentDraftCount=6`
    - `documentLikeHistoricalDraftCount=0`
- `node scripts/check-doc-links.mjs`
  - 通过。
- `node scripts/check-roadmap-progress.mjs`
  - 通过。

## 当前阶段状态
- `Phase 22 / 第二刀` 已完成：traffic-quality 报表现在不仅能拆分真实流量与 synthetic benchmark，还能明确判断当前 project 是否具备 document family 选择资格。
- 对 `proj_default` 的当前结论不是“继续做 document family”，而是“证据不足，暂不准入”。

## 风险 / 未完成
- 真实 `real_click` 事件仍需从新契约上线后继续累计；当前窗口没有 document-like 真实点击。
- 历史意图草稿虽然可作为 fallback source，但 `proj_default` 最近窗口内没有可复核的 document-like 草稿，因此不能凭空指定 top document families。
- 本轮没有把 document family 接入 benchmark / release guard / verifier 主链路。

## 下一步
- 如果继续沿用 `proj_default`，先等待真实 document-like 点击样本进入 event log，再重新跑 `intent:traffic-quality`。
- 如果业务上必须立刻推进 document 治理，应另选存在 document-like 真实流量的 project，或另起独立计划做 fixture-first bootstrap，而不是伪装成当前 Phase 22 的自然继续。
