# Task Brief

## 标题
- R12 第一刀：runtime governance contract

## 背景
- `R11` 已把 benchmark / rollout gate 收口到服务端，但当前 `intent-e2e` 运行链路里，环境画像、凭证引用、账号/会话与 fixture 契约仍是隐式输入。
- 目前 `project auth` 虽然能在服务端补齐，但 direct run 入口与其它入口不一致，workspace 导入时也可能继续把项目凭证复制成任务级明文资产。

## 本轮目标
- 给 `intent-e2e` 请求补最小 `runtime governance` schema。
- 在服务端把环境 / 账号 / 数据治理变成显式 blocker，而不是继续隐式放过。
- 让 project-backed credential 在 run / workspace 导入链路里可追踪，并避免继续复制成任务级 legacy auth。

## 验收标准
- [ ] `IntentE2ERunRequest` 能显式承接 `environmentProfile / credentialRef / fixture contract`
- [ ] 服务端对不完整的治理契约返回明确 blocker，而不是继续执行页面 precheck / analyze
- [ ] `/api/intent-e2e`、`/api/intent-e2e/runs`、`/api/intent-e2e/stream` 使用一致的 project auth resolution
- [ ] workspace 导入遇到 project-backed credential 时，不再把项目登录密码复制成任务级 legacy auth
- [ ] 相关 unit tests / build / doc-roadmap checks 通过

## 范围
- 会改：
  - `lib/intent-e2e-runtime-governance.ts`
  - `lib/ai/intent-e2e-request.ts`
  - `lib/server/intent-e2e-project-auth.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `lib/services/intent-e2e-workspace-service.ts`
  - `app/api/intent-e2e/route.ts`
  - `tests/unit/**`（仅 R12 相关）
- 不会改：
  - 数据库 schema
  - 现有 project / task auth 持久化表结构
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：`R12`
- 对应小步：先把 environment profile、credential reference、fixture/idempotency contract 从运行请求中显式抽出来
- 本轮完成后准备回写到哪一条更新：本文件最新一条 roadmap 更新

## 计划修改点
- 新增 `runtime governance` helper，统一 normalize / merge / validate
- 请求归一化接入 `environmentProfile / credential / fixture`
- project auth resolver 产出 project-backed credential reference
- service 在 precheck 前执行治理 blocker
- workspace import 避免复制 project credential 为 task legacy auth
- direct route 对齐 project auth / shared llm merge

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-request.spec.ts tests/unit/intent-e2e-project-auth.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/api-intent-e2e-route.spec.ts tests/unit/api-intent-e2e-runs-route.spec.ts tests/unit/api-intent-e2e-stream-route.spec.ts tests/unit/intent-e2e-run-registry.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只补 request/runtime contract 与最小 blocker，不扩完整账号池、secret manager、fixture orchestration 后端实现
- workspace 导入默认保护 project-backed credential，不提供单独“强制落为 task auth”开关

## 完成后动作
- 回写 roadmap
- 如行为说明变化，更新稳定文档入口
