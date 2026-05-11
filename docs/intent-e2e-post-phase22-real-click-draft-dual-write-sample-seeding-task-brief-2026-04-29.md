# Task Brief

## 标题
- Post Phase 22：real-click draft dual-write sample seeding

## 背景
- `Phase 22 / 第一刀` 已把 `real_click / draft_import / benchmark_rerun / replay` 的统计分母拆开，`Phase 22 / 第二刀` 已把 sample readiness 与 document family selection admissibility 固化到 traffic-quality 报表。
- Post Phase 22 的首条手册驱动 `real_click` 已在当前系统跑通：
  - `intent-run-640e0a6d-17e0-4233-8f2b-80ee779b04d8`
- 用户进一步要求两件事同时成立：
  - 累计更多 fresh `real_click` 样本，最好 5-10 条。
  - 这些样本也要能出现在“意图草稿”中。
- 当前口径下，run request 一旦携带 `intentDraftUid`，traffic-quality source 就会被记为 `draft_import`，不再属于 `real_click`。因此不能直接用“从草稿发起运行”来做这轮样本累计。

## 本轮目标
- 新增一条最小、可重复执行的 dual-write seeding 工具链：
  - 先创建意图草稿，让样本在“意图草稿”中可见。
  - 再用同一份任务语义独立发起真实用户路径 `launch-decision -> runs`，且不带 `intentDraftUid`，确保 run 仍计入 `real_click`。
- 用这条 seeding 工具链实际落一批 fresh samples，并刷新 traffic-quality 报表。

## 验收标准
- [ ] 新增可复用 seeding 脚本，支持批量创建 drafts + real_click runs，并输出报告。
- [ ] 不修改现有 traffic-quality source 语义，不把 `draft_import` 伪装成 `real_click`。
- [ ] 至少新增 5 条 fresh samples，且这些样本同时满足：
  - 草稿创建成功，可在项目“意图草稿”里看到
  - run 走 `launch-decision -> /api/intent-e2e/runs`
  - run request 不携带 `intentDraftUid`
- [ ] 刷新最近 1 天 traffic-quality 报表并记录最新摘要。

## 范围
- 会改：
  - `scripts/intent-e2e-seed-real-click-samples.mjs`
  - `docs/intent-e2e-post-phase22-real-click-draft-dual-write-sample-seeding-task-brief-2026-04-29.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `docs/runbook.md`
- 不会改：
  - `real_click / draft_import` 统计口径
  - `launch-decision` 或 `/api/intent-e2e/runs` 主链路语义
  - benchmark / replay / release-guard / compare
  - 数据库 schema

## 必读上下文
- `AGENTS.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase22-real-traffic-measurement-contract-reporting-bootstrap-task-brief-2026-04-29.md`
- `docs/intent-e2e-phase22-sample-readiness-and-document-family-selection-admissibility-task-brief-2026-04-29.md`
- `docs/intent-e2e-post-phase22-knowledge-manual-batch-add-contacts-real-run-recovery-task-brief-2026-04-29.md`

## Roadmap 对齐
- 当前阶段：
  - `Phase 22 / 第一刀` 与 `第二刀` 保持完成状态。
  - 本轮是 post-Phase 22 的样本累计，不是 document family 主链路治理。
- 对应小步：
  - real-click sample accumulation with draft visibility
- 本轮完成后准备回写到哪一条更新：
  - 第四百九十八次更新

## 计划修改点
- 新增 seeding 脚本：
  - 内置一组高确定性样本池，优先复用已证明稳定的 family 与手册能力。
  - 对每个样本先 `POST /api/projects/:projectUid/intent-drafts` 创建草稿。
  - 再对同一样本单独请求 `POST /api/intent-e2e/launch-decision` 与 `POST /api/intent-e2e/runs`。
  - 轮询 `GET /api/intent-e2e/runs/:runId` 直到终态，并输出 JSON / Markdown 报告。
- 保持 run request 不带 `intentDraftUid`，只把草稿当“可见性沉淀”，不把草稿导入运行伪装成 `real_click`。

## 验证
- `node --env-file-if-exists=.env scripts/intent-e2e-seed-real-click-samples.mjs --help`
- `node --env-file-if-exists=.env scripts/intent-e2e-seed-real-click-samples.mjs --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --max-samples 8`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 1`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check`
