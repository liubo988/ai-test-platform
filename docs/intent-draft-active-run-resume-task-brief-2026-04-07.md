# Task Brief

## 标题
- 项目内意图草稿复用已在执行的 Intent E2E run

## 背景
- 当前项目工作台里的“意图草稿”点击“测试流程”时，会始终打开一个新的 `/intent-e2e` 启动链路。
- 如果该草稿已经有一个处于 `created / running` 的 Intent E2E run，用户预期应该直接回到那条正在执行的意图控制台，而不是再创建一条新 run。

## 本轮目标
- 为意图草稿运行补上可恢复的 `draftUid` 元信息。
- 项目内草稿列表与草稿详情能够识别当前草稿是否已有活动 run。
- 点击“测试流程”时，已有活动 run 则跳转到对应 run 控制台；没有时才走原来的自动启动链路。

## 验收标准
- [ ] 从项目“意图草稿”列表点击某条已在执行的草稿，不会创建新 run，而是跳到该草稿已有的 `/intent-e2e?...&runId=...`
- [ ] 草稿详情里的“测试流程”按钮行为与列表一致
- [ ] 草稿列表能拿到活动 run 信息，不依赖本地单页内存态
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `components/ProjectWorkspace.tsx`
  - `components/IntentE2EWorkbench.tsx`
  - `app/api/projects/[projectUid]/intent-drafts/route.ts`
  - `app/api/projects/[projectUid]/intent-drafts/[draftUid]/route.ts`
  - `lib/services/project-intent-draft-service.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `lib/ai/intent-e2e-request.ts`
  - `lib/ai/intent-e2e-service.ts`
  - 相关 unit tests
- 不会改：
  - 数据库 schema
  - 非意图草稿入口
  - 无关执行器逻辑

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 后的生产化 / 工作台收口阶段
- 对应小步：项目工作台与 Intent E2E run 恢复链路打通
- 本轮完成后暂不回写 roadmap，仅做交互收口

## 计划修改点
- 在 Intent E2E run request / summary / persisted state 中保留草稿来源标识
- 为项目意图草稿列表和详情补充活动 run 聚合信息
- 调整草稿“测试流程”按钮的跳转优先级

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-draft-launch.spec.ts`
- `npm run build:web`

## 风险 / 未覆盖
- 历史上已创建、但未写入草稿元信息的旧 run，无法反向关联到草稿
- 暂不在项目列表外的其他入口展示“草稿执行中”状态

## 完成后动作
- 说明旧 run 与新 run 的行为差异
