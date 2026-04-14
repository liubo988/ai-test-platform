# Task Brief

## 标题
- successful-run 候选排序识别历史 sanitizer rescue 记录

## 背景
- `intent-run-067d0e3a-2d73-4e5b-8848-40084ff68ce0` 虽然通过，但仍复用了 `intent-run-3021f7a8-9382-4209-8251-6dd954d288b8`。
- 进一步审计发现 `3021...` 自己就是“复用 `d3ff...` 后再被 sanitizer rescue 纠正”的 passed run。
- 当前 successful-run 选择器只看 `attempt.code` 是否还会被 `sanitizeGeneratedCode(...)` 改写，无法识别“历史上已经靠 rescue 才通过，但落库代码已经是 sanitize 后版本”的情况。

## 本轮目标
- 让 successful-run 候选排序显式识别历史 attempt 的 `fallbackTelemetry.sanitizerRescueSource`。
- 把“历史上被 rescue 过的成功脚本”降权到真正的干净成功脚本之后。

## 验收标准
- [ ] 如果一个 passed run 的最后一次 attempt 已记录 `fallbackTelemetry.sanitizerRescueSource`，它会被视为需要 rescue 的候选
- [ ] 兼容请求但干净的成功脚本，会优先于 exact 但历史上已 rescue 的成功脚本
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 执行层 checkpoint
  - DB schema
  - UI / route

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：successful-run 复用排序细化
- 对应小步：从“代码是否仍需 sanitize”扩展到“历史 attempt 是否已记录 sanitizer rescue”
- 本轮完成后准备回写到哪一条更新：新增 2026-04-14 最新更新

## 计划修改点
- 增加读取最后一次 attempt 的 sanitizer rescue telemetry helper
- successful-run 候选 `requiresSanitizerRescue` 同时考虑历史 telemetry 与代码差异
- 补回归，覆盖“exact rescued vs compatible clean”

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只解决 successful-run 排序信号缺失，不改变执行层仍会从头执行的事实
- 如果历史 run 没记录 `fallbackTelemetry`，仍只能退回代码级 rescue 检测

## 完成后动作
- 回写 roadmap
- 在最终答复里说明这次 `067d...` 已通过，但仍暴露了一个已补上的复用排序漏洞
