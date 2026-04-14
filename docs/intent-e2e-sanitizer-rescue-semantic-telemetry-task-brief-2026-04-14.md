# Task Brief

## 标题
- successful-run / draft reuse 的 sanitizer rescue telemetry 改成语义判定

## 背景
- 真实 run `intent-run-22b72655-66bd-4d95-a35f-9ebee2e4c466` 已经复用了更干净的历史成功脚本 `intent-run-d3ff5cd3-2dd2-4bf3-971a-0c0121094b35`，动作轨迹也符合“placeholder 搜索订单号”的要求。
- 但 attempt telemetry 仍然记录了 `sanitizerRescueSource=recent_successful_run`，原因是当前写 telemetry 时仍用原始字符串差异判断 rescue，把纯空白/缩进变化也算成了“被 sanitizer 救回”。

## 本轮目标
- 让 `sanitizerRescueSource` 只在 sanitize 真正改变脚本可比语义时出现，不再误报格式化差异。

## 验收标准
- [ ] `recent_successful_run` 复用脚本若 sanitize 只改空白，不再记录 `sanitizerRescueSource`
- [ ] 已有真正结构修复的 legacy / draft reuse 场景仍保持 rescue telemetry
- [ ] 相关 unit tests、build、doc / roadmap check 全部通过

## 范围
- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `docs/intent-e2e-sanitizer-rescue-semantic-telemetry-task-brief-2026-04-14.md`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：R6 / reuse + fallback telemetry 收口
- 对应小步：让 successful-run reuse 的 rescue telemetry 与候选排序使用同一套“语义等价”口径
- 本轮完成后准备回写到哪一条更新：2026-04-14 最新一条 roadmap 更新

## 计划修改点
- `buildIntentE2EAttemptFallbackTelemetry(...)` 改为使用 comparable code 判断 sanitizer rescue
- 补 `recent_successful_run` 的 whitespace-only sanitize 回归测试
- 回写真实 run 审计证据与本轮结果

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 这轮不处理 analyze 阶段耗时定位，只先消除 telemetry 误报
- 这轮不会回溯改写历史 run 已落库的 telemetry

## 完成后动作
- 回写 roadmap
- 在最终审计里明确区分“动作正确但 telemetry 误报”与“动作本身错误”
