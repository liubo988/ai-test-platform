# Task Brief

## 标题
- `AI生成 -> 失败后下一步可操作` 闭环收口

## 背景
- 当前 `/intent-e2e` 已经具备 launch decision、失败 triage、failure CTA 和 workspace import 能力，但从真实使用体验看，`AI生成` 失败后仍有三处断点：
- `needs_clarify` 太松，导致“如图，帮我测一下”这类低信息请求仍可能直接开跑。
- 服务端已经产出结构化失败诊断，但前台失败面板没有把这些诊断和下一步动作真正展示出来。
- `draft_only` 与 `handoff_manual` 仍偏“提示或导航”，不够像用户可直接执行的闭环动作。

## 本轮目标
- 只收口 `AI生成` 失败后的产品闭环，不重开 `post-R14 success hardening` 主阶段。
- 让低信息请求更早被拦下。
- 让失败面板直接告诉用户“卡在哪、下一步做什么”。
- 让主工作台的 `draft_only` 和 `handoff_manual` 从提示升级为真实可执行动作。

## 验收标准
- [ ] 有图或 URL 但描述仍过泛时，launch decision 返回 `needs_clarify`，不再直接 `auto_run`。
- [ ] 失败结果面板能展示结构化 triage 诊断：失败步骤、目标锚点、失败定位器、候选锚点、建议动作。
- [ ] 主工作台在 `draft_only` 时提供显式 override 入口，且点击后直接创建 run，不再重复走 launch decision。
- [ ] `handoff_manual` 会把当前 run 真正导入项目工作台，而不是只切 tab 或跳项目首页。
- [ ] 不改数据库 schema，不新增新的 API 契约层级。

## 范围
- 会改：
  - `lib/intent-e2e-launch-decision.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/intent-e2e-launch-decision.spec.ts`
  - `docs/intent-e2e-ai-generate-closure-task-brief-2026-04-07.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 新增 route 或新的服务端持久化模型
  - 无关 UI 样式重构
  - 执行器、verifier、repair 主链路

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R7.5-R14` 已全部完成，`post-R14 success hardening` 已 close-out。
- 对应小步：close-out 后 follow-up，单收 `AI生成` 失败后的产品闭环，不重开执行主链路阶段。
- 本轮完成后准备回写到哪一条更新：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条 follow-up 更新。

## 计划修改点
- 收紧 `needs_clarify`：明确“有图 / 有 URL != 描述足够”。
- 给失败面板补结构化 triage 展示层，不再只停留在 summary 文案。
- 给 blocked `draft_only` 补显式 override 入口。
- 把 `handoff_manual` 接到现有 workspace import，导入成功后跳到聚焦任务 / 历史页面。

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-launch-decision.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- `components/IntentE2EWorkbench.tsx` 当前已有较多在途 UI 改动，本轮只做最小逻辑 patch，需避免误伤既有样式调整。
- 本轮只解决“用户下一步怎么做”闭环，不评估新的 family verifier 或 repair 策略。
- `handoff_manual` 复用现有 workspace import；若当前项目 / 模块上下文为空，仍会回退到 workspace 面板让用户补齐目标位置。

## 完成后动作
- 回写 production roadmap 最新 follow-up。
- 继续沿现有验证矩阵跑 build / targeted vitest / doc links / roadmap progress。
