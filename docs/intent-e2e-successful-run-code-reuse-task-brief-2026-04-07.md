# Task Brief

## 标题
- post-R14 最近成功 run 代码直复用：跳过重复 slot patch 生成

## 背景
- 当前草稿重跑时，即使同一条意图草稿已经有成功 run，服务端默认仍只看草稿自带的首版 `planCode`。
- 如果草稿首版脚本命中旧骨架，链路会回退到 `ExecutionPlan -> compiled template -> slot patch`，实时日志会停在“已将 ExecutionPlan 编译成受控脚手架，正在生成 slot patch...”较久。
- 用户当前诉求很明确：同一条草稿之前已经真实跑通时，应优先复用最近一次成功 run 的最终代码，而不是继续重复首轮生成。

## 本轮目标
- 只补一条低风险快路径：
  - 同 `projectUid/moduleUid/intentDraftUid`
  - 同输入描述
  - 同目标 URL
  - 同附件数
  - 最近已有 `passed` run 且存在最终代码
- 命中时直接复用那次成功 run 的最终代码，跳过重新生成 / slot patch。

## 验收标准
- [ ] 命中最近成功 run 时，generate 阶段直接执行成功代码，不再调用 `generateTest`
- [ ] 最近成功 run 与当前草稿输入不一致时，不复用，继续走现有生成链路
- [ ] 相关单测通过，build 通过

## 范围
- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 前端工作台 UI
  - planner / compiler / slot patch 本身的生成逻辑

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：successful run final code reuse
- 本轮完成后准备回写到哪一条更新：最新一条 roadmap 更新

## 计划修改点
- 在 `intent-e2e-service` 内新增“最近成功 run 最终代码”解析与复用决策。
- 让复用优先级变成：最近成功 run 最终代码 > 草稿首版代码 > 当前生成链路。
- 补 service 单测，锁住命中与不命中的边界。

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮只做“成功 run 最终代码”的服务端复用，不做 planning / analyze 的整段跳过。
- 当前命中条件仍是保守规则匹配，不涉及更复杂的 snapshotSignature / family 级语义复用。

## 完成后动作
- 回写 roadmap
