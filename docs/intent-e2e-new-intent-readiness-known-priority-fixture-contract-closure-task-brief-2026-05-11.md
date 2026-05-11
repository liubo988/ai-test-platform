# Intent E2E New Intent Readiness Known Priority Fixture Contract Closure Task Brief

## 背景

- governed document fixture suppression 后，最近窗口仍有 `needs_fixture` 候选。
- 进一步拆解后发现高频剩余项不是新未知业务，而是已治理 priority family：
  - `modal_or_drawer_save`
  - `business_create_list_verify`
  - `business_to_order`
- 前两者已有 repo-owned fixture，但 readiness 从历史 traffic-quality 事件重算时没有复用当前 known fixture governance；`business_to_order` 已有 release / knowledge 证据和 recipe registry，却缺 priority asset profile 与 repo-owned fixture contract。

## 目标

- 让 `new-intent readiness` 重算历史 traffic-quality 时复用当前 known fixture governance。
- 为 `business_to_order` 固化最小 priority asset profile、recipe 偏好和 repo-owned setup / cleanup fixture contract。
- 让 `intent:fixture-bootstrap` 只保留真正 `recommendedMode=needs_fixture` 的候选，避免 `draft_only` item 混入。

## 范围

- 修改 readiness 重算路径、known fixture governance、priority family profile 和 fixture bootstrap 过滤语义。
- 新增 `business_to_order` repo-owned fixture setup / cleanup 脚本。
- 补单测覆盖 known fixture、fixture executor、readiness report。
- 刷新报表与文档。

## 非目标

- 不新增远端删除 / 作废订单 adapter。
- 不改 release-readiness completion summary 语义。
- 不把 draft_import / benchmark / replay 混入 real_click 成功率。
- 不做 OCR-first 或 document family 新治理。

## 验收

- [x] `modal_or_drawer_save` / `business_create_list_verify` 历史 event 重算时能识别当前 known fixture governance。
- [x] `business_to_order` 有 priority asset profile、preferred recipe 和 repo-owned fixture refs。
- [x] `new-intent readiness` 最近窗口 `needs_fixture` real_click 清零。
- [x] `intent:fixture-bootstrap` 最近窗口输出 `total=0`。

## 验证

- `npx vitest run tests/unit/intent-e2e-new-intent-readiness.spec.ts tests/unit/intent-e2e-known-fixture-governance.spec.ts tests/unit/intent-e2e-fixture-executor.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-recipe-registry.spec.ts`
- `npm run intent:new-intent:readiness -- --project-uid proj_default --window-days 30`
- `npm run intent:fixture-bootstrap -- --project-uid proj_default --window-days 30`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`
