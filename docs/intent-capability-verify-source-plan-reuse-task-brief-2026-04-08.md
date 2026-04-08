# Task Brief

## 标题
- 沉淀能力首次验证优先复用来源成功任务脚本

## 背景
- 当前从“正式任务列表”点击“沉淀能力”进入需求编排工作台后，再次点击能力验证，首轮仍会重新生成 verification plan 和脚本。
- 真实问题是：来源正式任务已经 `passed`，但 capability verify 没有复用这次成功执行的脚本资产，导致第一次验证可能失败，和用户对“沉淀成功能力应复用已通过资产”的预期不一致。

## 本轮目标
- 只收口“沉淀能力 -> 首次 verify”这条链路。
- 当能力来源于同项目内已通过的正式任务，且能力内容未发生语义漂移时，首次 verify 优先复用来源成功 plan。
- 一旦来源锚点缺失、失效或能力内容已变更，自动回退到现有 `generatePlanFromConfig` 链路。

## 验收标准
- [ ] 从正式任务点击“沉淀能力”时，会把来源成功任务的最小复用锚点带入 capability meta。
- [ ] capability verify 在满足保守条件时优先复用来源成功 plan，不再无条件重新生成。
- [ ] 当能力内容被编辑或来源锚点不可用时，仍会稳定回退到当前生成链路。
- [ ] 相关 unit tests 覆盖“复用成功”和“回退生成”两类路径。

## 范围
- 会改：
  - `components/ProjectWorkspace.tsx`
  - `lib/intent-capability-preset.ts`
  - `lib/capability-verification-service.ts`
  - `lib/services/test-plan-service.ts`
  - `app/api/projects/[projectUid]/capabilities/[capabilityUid]/verify/route.ts`
  - `tests/unit/capability-verification-service.spec.ts`
  - `tests/unit/api-project-capability-verify-route.spec.ts`
  - `tests/unit/test-plan-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 正式任务普通执行链路
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：successful run asset reuse 向 capability verify 链路补齐
- 本轮完成后准备回写到哪一条更新：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新增量

## 计划修改点
- 在 capability preset / meta 中补“来源成功任务 plan 锚点 + 语义指纹”。
- 在 capability verify service 中只在语义指纹仍一致时返回可复用 source plan。
- 在 verify route 中优先把 source plan 克隆到当前 verification config，再执行。
- 补 route / service / test-plan-service 单测。

## 验证
- `npx vitest run tests/unit/capability-verification-service.spec.ts tests/unit/api-project-capability-verify-route.spec.ts tests/unit/test-plan-service.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮只复用“来源正式任务成功 plan”，不扩到 capability 历史成功 verify 的跨轮 freshness 治理。
- 本轮不跳过 capability verify config 创建；只是把脚本生成阶段优先替换成 history restore。

## 完成后动作
- 回写 roadmap
