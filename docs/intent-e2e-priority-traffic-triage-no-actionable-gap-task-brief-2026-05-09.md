# Intent E2E Priority Traffic Triage No Actionable Gap Task Brief

## 背景

- document family latest top-3 已全部 `contract_ready + release_guard=passed`，next-development 继续阻断重复治理。
- 最近窗口里 `untracked` 看起来是高频 bucket，但其中大头可能是 document-like 样本或历史未回填 priority family，不应直接据此新增业务 fixture。
- `business_to_order` 是已治理 release family，需要确认是否真的有新的 failure / fixture 缺口。

## 目标

- 新增独立 priority traffic triage 报表，拆分 `source=real_click` 下的 `untracked` 与 `business_to_order`。
- 明确区分：
  - document-like untracked
  - 可用当前 family route 回填的历史 untracked
  - 仍无法归类的 unknown business/product
  - `business_to_order` 当前 pass / governance 状态

## 范围

- 新增 `intent:priority-triage` CLI。
- 新增纯逻辑 service 与单测。
- 回写 README / runbook / handoff / next-development prep / roadmap。

## 非目标

- 不新增新的 priority family。
- 不改 release-readiness summary。
- 不改 benchmark harness。
- 不把 document-like untracked 当作业务治理缺口。

## 验收

- [x] 报表输出 JSON / Markdown。
- [x] `untracked` 能拆出 `document_like / reroutable_priority_family / unknown_business_or_product`。
- [x] `business_to_order` 能显示 latest traffic-quality 终态成功率和 governance 状态。
- [x] 当前 30 天窗口结论为 `no_actionable_priority_gap`。
- [x] 单测覆盖 document-like、reroutable priority 和 unknown untracked。

## 验证

- `npm run intent:priority-triage -- --project-uid proj_default --windows 30,90,365`
- `npx vitest run tests/unit/intent-e2e-priority-traffic-triage.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`
