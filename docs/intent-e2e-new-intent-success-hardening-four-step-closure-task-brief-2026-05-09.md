# Task Brief

## 标题
- new-intent success hardening four-step closure

## 背景
- `modal_or_drawer_save` fixture、known fixture governance 和服务分佣配置 remote recovery adapter 已完成第一刀。
- 后续短周期收益集中在：
  - `business_create_list_verify` 缺 repo-owned fixture。
  - 服务分佣配置 remote recovery 需要一次受控 smoke。
  - document-like `real_click` 需要继续采样。
  - AI 生成按钮真实失败面需要刷新观察，避免继续做已完成 family。

## 本轮目标
- 落第二条 repo-owned fixture：`business_create_list_verify`。
- 将 `proj_default + business_create_list_verify` 新建商机回列表验收类请求接入 known fixture governance。
- 执行服务分佣配置 `snapshot_restore` 受控 smoke。
- 采集一条新的 document-like `real_click`，并刷新 traffic-quality / new-intent readiness / next-development plan。

## 验收标准
- [x] `fixture://project/proj_default/business_create_list_verify/setup` 与 `cleanup` 可被 fixture executor 执行。
- [x] 商机新建回列表验收类请求自动获得 business fixture refs，并可通过 launch-decision `auto_run`。
- [x] 服务分佣配置 `snapshot_restore` smoke 完成 setup 快照与 cleanup already-restored 检查。
- [x] document-like `real_click` 采样至少新增 1 条 terminal passed。
- [x] traffic-quality、new-intent readiness 和 next-development plan 已刷新。
- [x] 修复本轮采样暴露的 document workbench selector drift。

## 范围
- 会改：
  - `scripts/intent-e2e-fixtures/project/proj_default/business_create_list_verify/**`
  - `scripts/intent-e2e-fixtures/project/proj_default/modal_or_drawer_save/_remote_recovery.mjs`
  - `lib/intent-e2e-known-fixture-governance.ts`
  - `lib/intent-e2e-project-knowledge-document-template.ts`
  - `tests/unit/**` 受影响测试
  - README / runbook / handoff / roadmap
- 不会改：
  - release-readiness completion summary
  - traffic-quality 分母语义
  - benchmark harness
  - OCR 主链路
  - 数据库 schema

## 验证
- `npx vitest run tests/unit/intent-e2e-fixture-executor.spec.ts tests/unit/intent-e2e-known-fixture-governance.spec.ts tests/unit/intent-e2e-project-auth.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-document-real-click-seed.spec.ts tests/unit/intent-e2e-new-intent-readiness.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts`
- `INTENT_E2E_FIXTURE_REMOTE_RECOVERY_MODE=snapshot_restore ... modal_or_drawer_save/setup.mjs && cleanup.mjs`
- `npm run intent:document-real-click:seed -- --project-uid proj_default --max-samples 1`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30`
- `npm run intent:new-intent:readiness -- --project-uid proj_default --window-days 30`
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`

## 风险 / 未覆盖
- `business_create_list_verify` cleanup 仍是 state / manual cleanup identifier 留证，不执行远端商机删除或作废。
- document readiness 历史窗口仍会显示历史 `needs_fixture`，本轮不会回写旧事件。
- next-development 当前仍建议继续采集 document-like `real_click`，没有新的未治理 document code work。
