# Task Brief

## 标题
- Formal task real-click seeding and `商机222` business-create recovery

## 背景
- 项目工作台里的正式任务已经是跑通过的真实测试案例，可以作为后续采样输入。
- 正式任务执行历史不能直接进入 traffic-quality `source=real_click` 分母；必须重新走 `launch-decision -> /api/intent-e2e/runs`。
- 用户反馈意图草稿 `商机222` 之前一次成功，现在反复报错，期望一次性通过。

## 本轮目标
- 新增正式任务 seed 转 real-click 的批量运行入口。
- 用正式任务 seed 补充 `modal_or_drawer_save` 与 `business_create_list_verify` 的真实点击样本。
- 找出并修复 `商机222` 失败根因。
- 刷新 release guard、knowledge-hit guard、traffic-quality 与 next-development plan。

## 验收标准
- [x] `npm run intent:formal-task-seed-runs` 能按 family 选择正式任务 seed，并重新发起 real-click run。
- [x] seed-run 报表输出 JSON / Markdown，并包含 summary、runId、matchedRuleIds、knowledgeHitRate。
- [x] `商机222` 修复后至少一次单样本 real-click 通过。
- [x] release-status 仍为 `ready`，且新接入 family 不破坏既有 release-readiness 口径。
- [x] traffic-quality 仍把 `real_click` 与 `benchmark_rerun / replay` 分开统计。

## 范围
- 会改：
  - `lib/intent-e2e-formal-task-seed-audit.ts`
  - `scripts/intent-e2e-seed-formal-task-real-click-samples.ts`
  - `lib/test-generator.ts`
  - `tests/unit/intent-e2e-formal-task-seed-audit.spec.ts`
  - `tests/unit/test-generator.spec.ts`
  - `intent-e2e.project-knowledge.json`
  - release guard / knowledge-hit tracked artifacts
  - README / runbook / roadmap / handoff docs
- 不会改：
  - document family recipe / fixture / verifier
  - OCR 主链路
  - benchmark harness
  - release-readiness completion summary 的既有语义

## 根因
- `商机222` 使用“新建商机”文案。
- 旧 `business_create_list_verify` detector 只识别“创建商机 / 新增商机 / createbusiness”，漏掉“新建商机”。
- 因未命中 create-business 确定性模板，运行退回到通用 ExecutionPlan modal/drawer 路径，最终在商机列表上等待“新建商机表单可见 Modal/Drawer”失败。

## 修复
- 将“新建商机”纳入 business-create detector。
- 增加 create-business list verification 模板复用入口；纯新建商机场景优先复用已验证模板，避免误走 create-order 或 modal/drawer 通用路径。
- formal-task seed-run 报表兼容 knowledge-hit guard 所需字段：`summary.requestCount / knowledgeHitRuns / knowledgeHitRate / runs`。

## 当前验证结果
- `npm run intent:formal-task-seed-runs -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --max-samples 12 --repeat 6 --poll-interval-ms 3000`
  - 通过，`12/12` passed。
- `npm run intent:formal-task-seed-runs -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --max-samples 3 --repeat 3 --poll-interval-ms 3000`
  - 通过，`3/3` passed，`knowledgeHitRate=100%`。
- 修复前 `商机222` seed-run：
  - 失败，`intent-run-24ef0583-79a9-40e2-995f-7b0aba72473e`，错误为“新建商机表单未出现可见 Modal/Drawer 容器”。
- 修复后 `business_create_list_verify` seed-run：
  - `3/3` passed，其中 `商机222` 两次通过。
  - 追加 `商机222` 单样本 `1/1` passed，runId=`intent-run-92bb3f5d-a184-48f2-af20-8885d15bbaa2`。
- `npm run intent:release-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json --json`
  - 通过，`baselineCount=5`、`passedBaselines=5`。
- `npm run intent:knowledge-hit-guard -- --json`
  - 通过，`evidenceCount=5`、`passedEvidences=5`。
- `npm run intent:release-status -- --require-current-compare --json`
  - 通过，`status=ready`、`families=5/5`。
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30 --json`
  - 通过，`real_click=82/95 (86.3%)`、`benchmark_rerun=455/627 (72.6%)`、`document_selection=no_document_candidates`。
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30`
  - 通过，`ready=no gate=no_admissible_code_work decision=stop_no_admissible_code_work eligible=-`。
- `npx vitest run tests/unit/intent-e2e-formal-task-seed-audit.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-project-knowledge.spec.ts tests/unit/test-generator.spec.ts`
  - 通过，`5` files / `242` tests。
- `npm run build`
  - 通过。
- `npm run build:web`
  - 通过。
- `npm run intent:release-guard:preflight -- --json`
  - 通过，`baselineCount=5`、`checkedFileCount=12`、`errors=0`。
- `npm run intent:release-summary`
  - 通过，`status=ready canRelease=yes checks=3/3 families=5/5`。
- `npm run intent:formal-task-seeds -- --project-uid proj_default`
  - 通过，`formal_tasks=24 seed_eligible=24 document_like=0 source_policy=formal_task_seed_only`。
- `npm run intent:next-dev:check -- --project-uid proj_default --window-days 30`
  - 预期失败，退出码 `1`；`development_gate=no_admissible_code_work`。
- `bash scripts/check-boundaries.sh`
  - 通过。
- `node scripts/check-doc-links.mjs`
  - 通过。
- `node scripts/check-roadmap-progress.mjs`
  - 通过。

## 当前阶段状态
- `modal_or_drawer_save` 已接入 release guard 与 knowledge-hit guard，默认 project release-ready families 变为 `5/5`。
- `business_create_list_verify` 已用修复后的 formal-task seed 重新冻结 recovery baseline，并通过 release guard current compare。
- 下一步开发 gate 仍为 `no_admissible_code_work`，因为最近窗口没有 document-like real_click，且真实 top priority families 都已 ready。

## 风险 / 未覆盖
- 30 天窗口中的旧失败仍保留在 traffic-quality 分母里，因此 business-create 历史 real-click pass rate 不是 100%；这符合真实统计口径。
- 当前正式任务仍没有 document-like seed，不能因此启动 document / OCR / verifier 开发。

## 完成后动作
- [x] 回写 README / runbook / next-development prep / handoff。
- [x] 回写 roadmap。
- [x] 完整运行最终验证命令并补齐结果。
