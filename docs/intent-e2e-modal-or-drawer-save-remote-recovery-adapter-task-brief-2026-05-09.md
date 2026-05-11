# Task Brief

## 标题
- modal_or_drawer_save service commission remote recovery adapter first cut

## 背景
- `proj_default + 服务分佣配置 + modal_or_drawer_save` 已能自动补 repo-owned setup / cleanup refs，并可从 `needs_fixture` 转为 `auto_run`。
- 现有 setup / cleanup 默认只写本地 fixture state，不能表述为已回滚远端佣金比例。
- 继续提高新意图通过率时，需要把“可恢复远端业务数据”的边界落到 adapter contract 和可执行脚本，而不是只靠说明文字。

## 本轮目标
- 为服务分佣配置保存类 fixture 增加 repo-owned remote recovery adapter。
- 默认保持 `contract_only`，不碰远端业务系统；只有显式启用 `snapshot_restore` 且提供已认证 Playwright storage state 时，setup 才快照原佣金比例，cleanup 才通过 UI 恢复。
- 保持窄范围：只支持 `commission.service-ratio-config`，不泛化到所有 `modal_or_drawer_save`。

## 验收标准
- [x] `setup` state 中写入 remote recovery adapter contract。
- [x] `cleanup` state 中写入 remote recovery adapter contract / outcome。
- [x] 新增 `fixture://project/proj_default/modal_or_drawer_save/remote-restore` repo-owned adapter ref。
- [x] 默认 contract-only 模式不启动浏览器、不修改远端数据。
- [x] 显式 `snapshot_restore` 模式要求 `INTENT_E2E_FIXTURE_STORAGE_STATE`，避免匿名 UI 操作。
- [x] 单测覆盖 setup / cleanup / remote-restore ref 的 contract-only 执行。

## 范围
- 会改：
  - `scripts/intent-e2e-fixtures/project/proj_default/modal_or_drawer_save/**`
  - `tests/unit/intent-e2e-fixture-executor.spec.ts`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-next-development-prep-2026-05-07.md`
  - `docs/intent-e2e-current-development-closure-handoff-2026-05-07.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - release-readiness completion summary
  - traffic-quality 分母 / 成功率口径
  - benchmark harness
  - document / OCR 主链路
  - 数据库 schema

## 必读上下文
- `AGENTS.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-modal-or-drawer-save-fixture-first-cut-task-brief-2026-05-09.md`
- `docs/intent-e2e-modal-or-drawer-save-known-fixture-governance-task-brief-2026-05-09.md`

## Roadmap 对齐
- 当前阶段：服务分佣配置类 known fixture 已从脚本推进到 launch/runs 自动治理补全。
- 对应小步：补远端恢复 adapter first cut，把“默认不回滚”升级为“可显式启用 snapshot / restore”。
- 本轮完成后回写：最新一条 roadmap 更新。

## 验证
- `npx vitest run tests/unit/intent-e2e-fixture-executor.spec.ts tests/unit/intent-e2e-known-fixture-governance.spec.ts tests/unit/intent-e2e-project-auth.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-new-intent-readiness.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`

## 风险 / 未覆盖
- CI 不执行真实 UAT UI restore；真实远端恢复需要显式提供 `INTENT_E2E_FIXTURE_REMOTE_RECOVERY_MODE=snapshot_restore` 和已认证 storage state。
- 本轮不新增服务分佣配置业务 API adapter；先采用现有真实跑通路径对应的 UI restore。
- 其他 `modal_or_drawer_save` 变体仍然不会自动启用该 adapter。

## 完成后动作
- 回写 roadmap。
- 同步 README / runbook / handoff。
