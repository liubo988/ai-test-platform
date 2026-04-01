# Task Brief

## 标题
- R8 第六十刀：R8 close-out

## 背景
- `testType / runnerType / testCase / testSpec / verificationContract / artifactContract` 已经沿 run、workspace、execution detail、insights 多条链路接入
- 最近几刀又把 `verificationPolicyNotes` 补到了 workspace、execution detail、insights，R8 已进入最后的阶段收口判断

## 本轮目标
- 对照 R8 完成标准，确认平台资产模型在 run / audit / workspace / execution detail / insights 的主要消费面已经闭合
- 回写 roadmap，把 `R8` 从进行中切到已完成

## 验收标准
- [ ] roadmap 明确记录 R8 close-out 结论
- [ ] 阶段状态更新为 `R8：已完成`
- [ ] R8 关键链路的 targeted tests 与 build / build:web / 文档检查通过

## 范围
- 会改：
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
  - `tmp/task-brief-intent-e2e-r8-close-out-2026-03-31.md`
- 不会改：
  - 平台 schema
  - route / service 公共 API
  - 无关 R9 adapter 实现

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：统一测试类型抽象与资产模型阶段收口
- 本轮完成后准备回写到哪一条更新：`2026-03-31 第六十次更新`

## 计划修改点
- 更新 roadmap 顶部阶段状态
- 新增一条 R8 close-out 更新，记录已闭合的消费面和剩余边界
- 跑一轮 R8 关键 targeted tests + build/build:web + doc/roadmap 检查

## 验证
- `npx vitest run tests/unit/intent-e2e-precheck-policy.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-import.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/execution-detail-preset-view-model.spec.ts tests/unit/test-plan-service.spec.ts tests/unit/intent-e2e-insights.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只是阶段收口，不会提前实现 R9 的 runner adapter 或非 UI 执行能力
- 即使 R8 结束，也不代表 policy notes 已被所有 future consumer 聚合统计；这里只确认当前主消费链已闭合

## 完成后动作
- 回写 roadmap
