# Task Brief

## 标题
- Post Phase 22：real-click seeding current-system scope and dedupe guard

## 背景
- `Phase 22 / 第一刀` 与 `第二刀` 已完成，post-Phase 22 的 `real_click` dual-write seeding 工具也已打通“意图草稿可见性 + real_click 计数”。
- 但这条工具链之前缺少硬 scope guard，曾把通用 document 示例误写成当前项目草稿，产生了与当前系统无关的 `docs.qq.com` 任务。
- 需要把这类跨系统误播种从工具层彻底拦住，而不是依赖人工判断。
- 同时，历史 `[AI测试样本]` 里已经出现同语义重复草稿；继续积样前需要补去重护栏，避免再写出重复内容。

## 本轮目标
- 给 `scripts/intent-e2e-seed-real-click-samples.mjs` 增加 current-system scope guard。
- 确保内置 sample profile 只能落在当前系统 `uat-service.yikaiye.com`。
- 给 seeding 工具补 semantic dedupe，避免再写出重复 `[AI测试样本]` 草稿。
- 增加回归测试，防止再把跨系统 URL 或重复样本写进“意图草稿”。

## 验收标准
- [ ] seeding 工具运行前会校验所有 sample URL 只落在当前系统 host
- [ ] `docs.qq.com` 这类跨系统 URL 会在创建草稿前直接报错
- [ ] 活动草稿里若已存在同语义 sample，工具会直接跳过而不是重复创建
- [ ] 相关单测通过
- [ ] runbook / roadmap 已明确“current-system only”边界

## 范围
- 会改：
  - `scripts/intent-e2e-seed-real-click-samples.mjs`
  - `tests/unit/intent-e2e-seed-real-click-samples.spec.ts`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `docs/intent-e2e-post-phase22-real-click-seeding-current-system-scope-guard-task-brief-2026-04-30.md`
- 不会改：
  - `traffic-quality` 统计语义
  - benchmark / release-guard / verifier 主链路
  - 当前系统外的任何 document family 能力

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Post Phase 22
- 对应小步：real-click seeding safety recovery
- 本轮完成后准备回写到 roadmap 最新一条更新之后

## 计划修改点
- 为 seeding 工具增加 built-in sample host allowlist
- 导出 scope / dedupe 校验 helper，供单测直接覆盖
- 在 runbook 中补 current-system-only 约束
- 回写 roadmap，固定这次误播种后的恢复事实

## 验证
- `node --env-file-if-exists=.env scripts/intent-e2e-seed-real-click-samples.mjs --help`
- `npx vitest run tests/unit/intent-e2e-seed-real-click-samples.spec.ts`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 1`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check`

## 风险 / 未覆盖
- 这轮只修补 seeding scope / dedupe，不等于 document family 已允许进入当前系统主链路。
- 当前 `real_click` 仍应继续沿现有稳定样本积累，不应再试图跨系统造 document 候选。

## 完成后动作
- 回写 roadmap
- 明确后续自动积样只能继续走当前系统样本
