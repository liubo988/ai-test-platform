# Task Brief

## 标题
- launch-decision 兼容 legacy 项目 fixture 门禁

## 背景
- `launch-decision` 现在会把所有看起来像写操作的请求先判成 `needs_fixture`。
- 但 service 主链路只有在 runtime governance 已经进入 enforced 模式时，才会把缺少 fixture contract 当 blocker。
- 这会让没有 project runtime governance 的 legacy 项目，比真实执行链更早被 launch-decision 拦住，形成兼容性回归。

## 本轮目标
- 只修 `needs_fixture` 的 legacy 兼容回归。
- 保持“已启用 runtime governance 的项目 / 请求”仍会被 fixture contract 门禁约束。

## 验收标准
- [ ] legacy 项目在没有启用 runtime governance 时，不会因为 `needs_fixture` 被 launch-decision 提前拦截
- [ ] 已启用 runtime governance 的写操作请求，缺少 fixture contract 时仍返回 `needs_fixture`
- [ ] 相关 unit tests 与 build 通过

## 范围
- 会改：
  - `lib/intent-e2e-launch-decision.ts`
  - `tests/unit/intent-e2e-launch-decision.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - runtime governance validator 本身
  - workbench blocked card 文案
  - fixture executor / repo-owned fixture contract

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening 期间的兼容性回归修复
- 对应小步：补齐 `launch-decision` 与 runtime governance 主链的一致语义
- 本轮完成后准备回写到哪一条更新：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条

## 计划修改点
- 在 `launch-decision` 中用现有 runtime governance enforcement 语义收窄 `needs_fixture`
- 用 unit test 锁住“legacy 项目放行 / enforced governance 继续拦截”的双边语义

## 验证
- `npx vitest run tests/unit/intent-e2e-launch-decision.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮只修 launch-decision 和 service 的语义对齐，不处理 fixture script 缺失
- 不引入新的 runtime governance 写入口

## 完成后动作
- 回写 roadmap
