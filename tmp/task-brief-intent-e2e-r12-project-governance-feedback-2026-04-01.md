# Task Brief

## 标题
- R12 第三刀：project runtime governance manifest 校验反馈

## 背景
- `R12` 前两刀已经把 runtime governance contract 和 project defaults 接到了运行链路。
- 当前项目级 manifest 缺失或字段失配时，通常要等到真正发起 run、命中 blocker 后才暴露；项目接入阶段缺少前置反馈。

## 本轮目标
- 给 project runtime governance manifest 增加最小校验状态，并接到现有 `insights -> workbench` 链路里，做到运行前可见。

## 验收标准
- [ ] project runtime governance helper 能区分 `missing / invalid / incomplete / ready`
- [ ] `GET /api/intent-e2e/insights?projectUid=...` 能返回项目级治理状态摘要
- [ ] workbench 治理舱能在不发起 run 的情况下显示该状态

## 范围
- 会改：
  - `lib/intent-project-runtime-governance.ts`
  - `lib/ai/intent-e2e-insights.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/intent-project-runtime-governance.spec.ts`
  - `tests/unit/intent-e2e-insights.spec.ts`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 新 API route
  - 新 UI 表单或 manifest 写入入口

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R12`
- 对应小步：project governance feedback
- 本轮完成后回写：`2026-04-01` 新增一条 `R12` 更新

## 计划修改点
- 在 runtime governance helper 补状态与 issue contract，校验 shared account / fixture contract 的项目级失配
- 把状态挂进 `getIntentE2EInsights()` 返回，并在 workbench 治理舱展示

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-project-runtime-governance.spec.ts tests/unit/intent-e2e-insights.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只补只读反馈，不新增 manifest 写接口
- 不处理账号池真实调度、secret manager 和 fixture 执行器

## 完成后动作
- 回写 roadmap
- 更新 README 中的 project runtime governance / insights 说明
