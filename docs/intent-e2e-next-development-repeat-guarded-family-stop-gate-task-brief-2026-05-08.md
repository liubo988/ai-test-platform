# Task Brief

## 标题
- Next-development stop gate for already guarded document families

## 背景
- `doc_create_reopen_verify` 已完成 `contract_ready` governance profile，并通过独立 document-family guard。
- traffic-quality 的 raw development gate 仍会因为存在 document-like real_click candidate 返回 `ready_for_document_family_governance`。
- 如果 next-development plan 继续把同一个已完成 family 当作可开发候选，会造成重复治理，违背“不要重复治理已 ready family”的计划约束。

## 本轮目标
- 让 next-development plan 在生成 document governance / guard 状态后，过滤已 `contract_ready + release_guard=passed` 的 document family。
- 当 traffic-quality 只推荐已完成 document family 时，`intent:next-dev:check --require-ready` 应返回非 0，提示继续采集新的 document-like real_click，而不是继续代码开发。
- 保持 traffic-quality 统计口径不变，不改 release-readiness summary。

## 验收标准
- [x] `doc_create_reopen_verify` 显示为 `governanceStatus=contract_ready`、`releaseGuardStatus=passed`。
- [x] `intent:next-dev:plan` 输出 `developmentReady=false`、`decision=collect_document_real_click`、`eligibleFamilies=[]`。
- [x] `intent:next-dev:check --require-ready` 在只有已完成 document family 时返回非 0。
- [x] 不修改 traffic-quality 原始分母，不把 benchmark/replay/draft_import 混入 real_click。

## 验证
- `npx vitest run tests/unit/intent-e2e-next-development-plan.spec.ts tests/unit/intent-e2e-document-family-release-guard.spec.ts tests/unit/intent-e2e-document-real-click-seed.spec.ts`
- `npm run build`
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30`
- `npm run intent:next-dev:check -- --project-uid proj_default --window-days 30`，预期返回非 0，原因是当前没有新的未治理 document code work。

## 完成结果
- 最新 next-development plan：
  - `developmentReady=false`
  - `gateStatus=ready_for_document_family_governance`
  - `decision=collect_document_real_click`
  - `eligibleFamilies=[]`
  - `documentFamilyCandidates[0]=doc_create_reopen_verify / contract_ready / passed`
