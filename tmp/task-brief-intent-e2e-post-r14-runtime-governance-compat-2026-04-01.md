# Task Brief

## 标题
- post-R14 runtime governance 兼容性回归修复

## 背景
- `intent-e2e` 在 `R12` 引入 project-backed runtime governance 派生后，项目控制台里的旧手工 run 会在没有项目治理 manifest 的情况下，被提前拦在“运行治理校验”。
- 现象是 run 还没进入 precheck / analyze / execute，就直接以 `缺少 environmentProfile / fixture contract` 终止，前端展示为“自动测试结束：未分类”。

## 本轮目标
- 恢复旧项目 URL 的兼容行为：没有项目治理默认值时，项目内置登录凭证仍可复用，但不能因此把旧请求升级成强制治理 blocker。

## 验收标准
- [ ] 无 project runtime governance defaults 的项目请求不会因为 project-backed auth 自动派生 `accountRef/sessionMode` 而被治理 blocker 卡死
- [ ] 已有显式 runtime governance 或项目治理默认值的请求，仍然保留 ownership derivation 行为
- [ ] 回归单测覆盖兼容语义

## 范围
- 会改：
  - `lib/server/intent-e2e-project-auth.ts`
  - `tests/unit/intent-e2e-project-auth.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - 运行治理 contract 结构
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 回归修复
- 对应小步：runtime governance 兼容性回归收口
- 本轮完成后准备回写到哪一条更新：新增 post-R14 bugfix 记录

## 计划修改点
- `project-auth` 只在已有治理上下文里派生 project account ownership 字段
- 补回归单测，锁住“旧请求仍兼容”的行为

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-project-auth.spec.ts`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不补 project runtime governance manifest 写入口
- 本轮不调整治理 blocker 的 failure triage 文案

## 完成后动作
- 回写 roadmap
