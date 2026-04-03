# Task Brief

## 标题
- S6 fixture executor 最小执行层

## 背景
- `S1-S5` 已经把入口分流、repair budget、family route 和 repeated failure suppression 收口，但 mutating flow 的 `runtimeGovernance.fixture` 仍主要停留在 contract / blocker 层。
- 当前代码已开始接入 repo-owned fixture executor，但还缺 `S6` brief、fixture 失败终态收口，以及覆盖 setup / cleanup 的最小回归测试。

## 本轮目标
- 只完成 `S6` 最小版：接通 repo-owned `fixture://...` 的 `setup / cleanup` 执行层、失败终态收口和最小单测。
- 不扩会话复用、不新增通用脚本平台、不把 fixture 校验前移到 request normalize 层。

## 验收标准
- [ ] `setup_cleanup` fixture 在 service 主链路里可真实执行，并传递 `owner / idempotencyKey / run context`
- [ ] `setup` 失败会在执行前阻断；`cleanup` 失败会把原本成功 run 变成 failed，且给出明确 blocked CTA
- [ ] project/runtime governance 只接受 repo-owned 的 `fixture://` 引用，相关单测通过

## 范围
- 会改：
  - `docs/intent-e2e-s6-task-brief-2026-04-02.md`
  - `lib/intent-e2e-runtime-governance.ts`
  - `lib/intent-project-runtime-governance.ts`
  - `lib/server/intent-e2e-project-auth.ts`
  - `lib/intent-e2e-fixture-executor.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-project-runtime-governance.spec.ts`
  - `tests/unit/intent-e2e-project-auth.spec.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
- 不会改：
  - `intent-e2e-request` normalize 契约
  - 会话复用 / 通用会话池
  - 外部脚本编排平台 / CI gate

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening `S6`
- 对应小步：fixture executor 最小版
- 本轮完成后准备回写到哪一条更新：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条进度更新

## 计划修改点
- 补 `S6` task brief，固定范围、验收和验证命令
- 在 `intent-e2e-service` 中把 fixture setup / cleanup 失败收口成稳定 triage、repair budget 和 CTA
- 补 project governance / project auth / service 的最小单测，覆盖 repo-owned ref、owner 补全和 fixture 执行链

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-project-runtime-governance.spec.ts tests/unit/intent-e2e-project-auth.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-request.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不补 repo fixture sample script；service 单测通过 mock executor 覆盖主链路
- 本轮不改 request normalize，因此 invalid ref 仍由 governance 校验阶段统一拦截

## 完成后动作
- 回写 `docs/intent-e2e-success-hardening-plan-2026-04-01.md`
- 回写 `docs/intent-e2e-production-roadmap-2026-03-29.md`
