# Task Brief

## 标题
- successful-run 复用优先选择更新且更少依赖 sanitizer 的候选脚本

## 背景
- 当前 `intent-e2e` 首轮 generate 已支持复用 `recent_successful_run`，但成功脚本候选仍偏“命中第一条严格相等快照”。
- 实际运行里已经出现：旧 passed run 虽然能复用，但仍要靠 `sanitizer rescue` 才能纠正动作；而同草稿下更新的成功 run 因为提示词补充说明或附件数变化，没有被优先选中。

## 本轮目标
- 在不扩大到 step checkpoint / 跳步执行的前提下，收口 successful-run 复用候选排序。
- 让系统优先复用“同 draft / 同 target 下，更近、请求兼容、且原始代码更少依赖 sanitizer rescue”的成功脚本。

## 验收标准
- [ ] 同 draft / 同 target 下，如果存在请求兼容且无需 sanitizer rescue 的更新成功脚本，会优先于更老的脏成功脚本被复用
- [ ] 如果严格匹配的成功脚本本身已经干净，不会被较宽松候选错误抢占
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - route / UI
  - 执行层 checkpoint / resume

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：successful / progressed / repair baseline 复用收口
- 对应小步：successful-run 复用候选 freshness / cleanliness 排序
- 本轮完成后准备回写到哪一条更新：新增 2026-04-14 最新更新

## 计划修改点
- 放宽 successful-run 候选的请求匹配，从“完全相等”扩展到“同 draft / 同 target 下的兼容提示词”
- 为 successful-run 候选增加“是否需要 sanitizer rescue / 是否附件数精确匹配 / 时间更新度”等排序信号
- 补主回归，覆盖“旧 exact 脏候选 vs 新 compatible 干净候选”与“干净 exact 候选不被宽松候选抢占”

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只优化 successful-run 候选排序，不处理执行层跳过已成功步骤
- “兼容提示词” 仍是保守字符串兼容，不做更宽的语义检索

## 完成后动作
- 回写 roadmap
- 在最终答复里明确说明是否仍有构建环境噪音
