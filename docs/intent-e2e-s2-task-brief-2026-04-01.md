# Task Brief

## 标题
- S2：launch-decision route 与 workbench blocked flow

## 背景
- `S1` 已补齐 run 前资产可用性与 `launch decision` 纯逻辑，但当前 `AI生成` 入口仍会直接创建 run。
- 这会让 `needs_bootstrap / needs_fixture / needs_clarify / draft_only` 这类低置信请求继续进入自动运行链路，用户也看不到明确的下一步动作。

## 本轮目标
- 新增服务端 `launch-decision` route。
- 让 `ProjectWorkspace` 与 `IntentE2EWorkbench` 先消费 launch decision，再决定是否真正创建 run。
- blocked 时在 workbench 展示最小解释与动作入口，不提前展开 `S3+`。

## 验收标准
- [ ] 新增 `app/api/intent-e2e/launch-decision/route.ts`
- [ ] `AI生成` 在 `needs_bootstrap / needs_fixture / needs_clarify / draft_only` 时不直接开跑
- [ ] workbench 能展示 blocked flow 的基本解释与动作入口

## 范围
- 会改：
  - `app/api/intent-e2e/launch-decision/route.ts`
  - `app/api/intent-e2e/runs/route.ts`
  - `lib/server/intent-e2e-request-preparation.ts`
  - `components/ProjectWorkspace.tsx`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
  - `tests/unit/api-intent-e2e-runs-route.spec.ts`
- 不会改：
  - repair 预算
  - family route
  - fixture executor
  - `S3+` 其它 CTA 扩展

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening
- 对应小步：`S2`
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新进度

## 计划修改点
- 抽共享请求预处理 helper，避免 `runs route` 与 `launch-decision route` 各自拼装 request
- 在 workbench 增加 blocked flow 状态与 query 恢复
- 在项目工作台入口先走 launch decision，再决定是否跳转到 run 或 blocked workbench

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/api-intent-e2e-runs-route.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- `draft_only` 当前仅保留 contract，不在本轮强接真实 failure pressure 数据源
- blocked 动作只做最小入口，不在本轮补完整失败 CTA 面板

## 完成后动作
- 回写 success hardening 文档与 roadmap
