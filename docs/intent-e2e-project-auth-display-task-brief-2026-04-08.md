# Task Brief

## 标题
- 独立意图控制台补齐项目统一认证的只读展示

## 背景
- 从项目内“意图草稿”发起意图测试时，后端实际已经把项目统一登录认证带入执行链路。
- 当前 `/intent-e2e` 独立页只读取本地 `auth` 表单状态，导致“执行上下文”看起来像没有登录信息，和真实执行状态不一致。

## 本轮目标
- 只修复意图控制台的认证展示缺口，让独立页能显示来源项目的统一认证摘要。
- 不改 run 创建、认证合并、执行器和数据库契约。

## 验收标准
- [ ] 从项目内意图草稿跳到独立意图控制台时，“登录上下文”不再误显示为空。
- [ ] “执行上下文”面板可只读展示项目统一认证摘要，并说明密码不回显。
- [ ] 仍保留当前手动登录表单，用于本次运行临时覆盖，不影响既有执行链路。

## 范围
- 会改：
  - `components/IntentE2EWorkbench.tsx`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
  - `docs/intent-e2e-project-auth-display-task-brief-2026-04-08.md`
- 不会改：
  - 数据库 schema
  - `/api/intent-e2e/runs` 认证合并逻辑
  - 非认证展示相关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening 已完成后的 workbench 可视化补缝
- 对应小步：让项目内启动的独立控制台正确显示项目统一认证上下文
- 本轮完成后准备回写到哪一条更新：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 为 `IntentE2EWorkbench` 增加独立页项目认证摘要抓取。
- 让 hero summary、左侧“执行上下文”标签和上下文面板优先展示项目统一认证。
- 保留现有手动认证表单，并改成“留空则继续复用项目认证”的提示文案。

## 验证
- `npm run build`
- `npm run build:web`
- `npm run test:e2e`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不补新的组件测试；主要依赖构建和现有 E2E 回归验证。
- 如果项目详情 API 在当前 actor 下返回失败，执行链路不受影响，但页面展示仍会提示摘要读取失败。

## 完成后动作
- 回写 roadmap
