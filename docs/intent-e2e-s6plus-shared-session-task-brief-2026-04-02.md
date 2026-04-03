# Task Brief

## 标题
- S6+ 会话复用最小版：shared session `storageState` 复用

## 背景
- `S1-S6`、`S6+ DOM delta`、`S6+ structured data evidence` 已完成。
- 当前 `runtimeGovernance.credential.sessionMode=shared` 还只是治理语义，真实执行时没有跨 run 复用 `storageState`，仍可能每次重走登录链。
- `success hardening plan` 在 `P2` 里把“会话复用最小版”列为剩余候选切片；在现有 `S6+` 候选中，这是下一刀。

## 本轮目标
- 只补最小 shared session 复用能力：
  - 按 `credential.accountRef` 命中共享会话
  - 复用前置检查成功拿到的 `storageState`
  - 把 `storageState` 透传到执行 worker，减少重复登录
- 若命中的共享会话已失效，只回退一次显式登录前置检查并刷新缓存。
- 不做新的账号池系统，不做跨进程 / 磁盘长期持久化。

## 验收标准
- [ ] `sessionMode=shared` 且存在 `accountRef` 时，可在后续 run 复用上一轮的 `storageState`
- [ ] stale shared session 命中后会自动清空并回退一次显式登录前置检查
- [ ] 执行 worker 会消费同一份 `storageState`，不只是 precheck / analyze 复用
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `docs/intent-e2e-s6plus-shared-session-task-brief-2026-04-02.md`
  - `lib/intent-e2e-shared-session-cache.ts`
  - `lib/page-analyzer.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/intent-runner-adapter.ts`
  - `lib/test-executor.ts`
  - `lib/test-worker.mjs`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/test-executor.spec.ts`
- 不会改：
  - `lib/server/intent-e2e-project-auth.ts` 的 project auth merge 语义
  - 新 DB schema / 新外部 session service
  - worker IPC 协议
  - 跨进程 / 跨重启持久化 session cache

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening `S6+` 候选
- 对应小步：会话复用最小版
- 本轮完成后准备回写到哪一条更新：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条进度更新

## 计划修改点
- 新增最小 shared-session cache helper，按 `credential.accountRef` 复用 `storageState`
- 在 precheck 链路接入 shared session，命中失效时自动清空并回退一次
- 把 `storageState` 透传到 runner / executor / worker，形成真实执行闭环

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/test-executor.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮 cache 仅在当前 Node 进程内生效；服务重启后不会保留
- 本轮不做 worker 执行后的 session 回写；共享会话仍以 precheck 成功结果为准
- 本轮不引入更复杂的 session freshness 指标，只做 auth_failed stale fallback

## 完成后动作
- 回写 `docs/intent-e2e-success-hardening-plan-2026-04-01.md`
- 回写 `docs/intent-e2e-production-roadmap-2026-03-29.md`
