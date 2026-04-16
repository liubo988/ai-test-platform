# Task Brief

## 标题
- successful-run 复用临时验证开关

## 背景
- 批量入账 Step 7 lookup timeout / retry tuning 已经落到生成器，但最近多次 live run 仍然直接复用旧的 `recent_successful_run` 脚本。
- 结果是运行虽然通过，真实执行耗时和 Step 7 行为都没有验证到最新生成器输出。

## 本轮目标
- 增加一个仅用于 live 验证的临时开关，允许跳过 `recent_successful_run` 复用。
- 保持 `recent_progressed_run` 和 `draft_first_pass` 逻辑不变，避免把整条复用链一次性打散。

## 验收标准
- [ ] 打开临时开关后，`recent_successful_run` 不再被首轮 generate 直接复用
- [ ] 未打开开关时，默认行为保持不变
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - route / UI
  - `recent_progressed_run` 复用策略

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：successful / progressed run reuse 收口后的 live verify
- 对应小步：为 `recent_successful_run` 增加可回收的临时验证开关
- 本轮完成后准备回写到哪一条更新：新增 2026-04-14 最新更新

## 计划修改点
- 在 `intent-e2e-service` 增加 env-gated 的 successful-run reuse bypass
- 补一条回归，证明开关打开后会回退到当前生成链路
- 用同类批量入账请求做 live 验证，再关闭临时口

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 这轮只为 live 验证临时跳过 successful-run reuse，不代表最终策略要长期关闭
- 如果请求文本完全一致，`recent_progressed_run` 仍可能继续命中；live 验证时需要用兼容但不完全相等的请求规避它

## 完成后动作
- 回写 roadmap
- live 验证完成后关闭临时环境变量
