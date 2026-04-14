# Task Brief

## 标题
- intent-e2e 复用“最近一次失败但推进更远”的 run 脚本

## 背景
- 用户明确指出：当前 rerun 机制过于愚蠢，前面步骤已经成功、后面步骤才卡住时，系统没有吸取上一次意图会话的成功经验，而是经常退回到旧草稿或重新生成，导致重复踩已经修过的坑。
- 当前服务端确实只会优先复用“最近一次成功 run 的最终脚本”或“草稿首版脚本”；对于“失败但已经把前半段修通、只是在更后面的步骤失败”的 run，没有整段脚本复用入口。
- 这会让后续 rerun 丢失上一轮已经验证过的前序步骤实现，和“自动学习、自动迭代升级”的目标不一致。

## 本轮目标
- 给 generate 首轮增加第二层复用来源：如果没有最近成功 run，就尝试复用最近一次“同草稿/同请求/同目标”且推进更远的失败 run 脚本。
- 候选脚本不能简单拿“最后一次失败 attempt”，而要从同一条历史 run 的多个 attempts 里选推进最远的一次，避免回退到更差版本。
- 这轮先解决“脚本经验复用”问题，不在执行层实现“跳过已成功步骤不再运行”。

## 验收标准
- [ ] 没有最近成功 run 时，系统可自动命中最近一次推进更远的失败 run 脚本
- [ ] 候选脚本来自历史 run 中推进最远的 attempt，而不是盲取最后一次 attempt
- [ ] 新增服务层单测覆盖该复用路径并通过

## 范围
- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - route / UI
  - `lib/test-worker.mjs`
  - 执行器 runtime 的“中途断点续跑”机制

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 后续 batch-account hardening 之外的学习闭环补漏
- 对应小步：失败 run 的“推进更远脚本”自动复用
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 新增 progressed-run reuse candidate 解析逻辑
- 从历史失败 run 的 attempts 中选出推进最远的脚本作为复用候选
- generate 首轮在“成功 run 复用”之后、“草稿首版复用”之前，增加该层 fallback

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 这轮只解决“脚本经验复用”，不解决真正的 runtime 断点续跑；rerun 仍会重新执行前序步骤。
- 这轮仍要求同草稿 / 同输入 / 同目标 URL 才触发复用，不会做跨意图的宽泛相似匹配。

## 完成后动作
- 回写 roadmap
- 后续若要进一步减少时间浪费，再评估执行层的 step checkpoint / artifact resume
