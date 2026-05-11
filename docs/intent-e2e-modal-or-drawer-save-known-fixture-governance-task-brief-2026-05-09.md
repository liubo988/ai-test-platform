# Task Brief

## 标题
- modal_or_drawer_save known fixture governance auto-attach

## 背景
- `modal_or_drawer_save` 的 repo-owned setup / cleanup 脚本已落地，但如果请求或项目 runtime governance 不写入 fixture refs，launch-decision 仍会停在 `needs_fixture`。
- 当前最高收益样本是 `proj_default` 的服务分佣配置保存类意图，已有稳定 targetUrl、project knowledge 与真实通过证据。
- 本轮只做窄匹配自动接线，不把所有 modal/drawer 保存泛化成同一 fixture。

## 本轮目标
- 在项目认证 / runtime governance 合并链路里，为 `proj_default + 服务分佣配置 + modal_or_drawer_save` 自动补 repo-owned fixture refs。
- 保留请求显式 fixture override 的优先级，不覆盖用户已声明的数据治理契约。
- 验证补齐后 launch-decision 能从 `needs_fixture` 转为 `auto_run`。

## 验收标准
- [x] 服务分佣配置类请求自动获得 `fixture://project/proj_default/modal_or_drawer_save/setup|cleanup`。
- [x] idempotencyKey 按项目、模块、输入、targetUrl 和 family 生成稳定短指纹。
- [x] 非 `proj_default` 或显式 fixture override 不会被自动接线。
- [x] 单测证明补齐 fixture 后 launch-decision 为 `auto_run`，且 `hasFixtureContract=true`。
- [x] 不改 release-readiness、traffic-quality counters、benchmark harness、document family verifier 或 OCR 主链路。

## 范围
- 会改：
  - `lib/intent-e2e-known-fixture-governance.ts`
  - `lib/server/intent-e2e-project-auth.ts`
  - `tests/unit/intent-e2e-known-fixture-governance.spec.ts`
  - `tests/unit/intent-e2e-project-auth.spec.ts`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-next-development-prep-2026-05-07.md`
  - `docs/intent-e2e-current-development-closure-handoff-2026-05-07.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - release-readiness completion summary
  - traffic-quality 分母 / 成功率口径
  - benchmark harness
  - document / OCR 主链路

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-modal-or-drawer-save-fixture-first-cut-task-brief-2026-05-09.md`

## Roadmap 对齐
- 当前阶段：top real-click needs_fixture family 的 repo-owned fixture 已落脚本，继续接入 launch-decision / runtime governance。
- 对应小步：known fixture auto-attach first cut。
- 本轮完成后回写：最新一条 roadmap 更新。

## 验证
- `npx vitest run tests/unit/intent-e2e-known-fixture-governance.spec.ts tests/unit/intent-e2e-project-auth.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-fixture-executor.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`

## 风险 / 未覆盖
- 当前只对服务分佣配置保存类样本自动接线；其他 `modal_or_drawer_save` 变体不会自动使用该 fixture。
- 自动接线只补 fixture 契约，不代表远端数据已经具备完整回滚能力。
- 历史 traffic-quality launch-click 事件仍保留当时的 `needs_fixture` 结果，不会被本轮回写篡改。

## 完成后动作
- 回写 roadmap。
- 同步 README / runbook / handoff。
