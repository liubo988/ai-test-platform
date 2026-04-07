# Task Brief

## 标题
- optional JSON 字段未命中降噪，避免把非阻塞缺值刷成 warn

## 背景
- 真实 run `intent-run-7254cbd3-8641-4dca-ae87-e3c398a55048` 已通过，但日志里仍出现一条非阻塞噪音：
  - `json value not found`
- 这条日志来自 `pickJsonValue(..., { required: false })` 的可选字段提取。
- 当前场景下，`businessId` 本来就允许缺失，后续脚本也已成功靠列表行命中完成收敛；继续把这类可选 miss 记成 `warn`，只会污染实时日志和 run 观感。

## 本轮目标
- 保留可选字段 miss 的调试痕迹。
- 但不再把 `required: false` 的 JSON 缺值记成告警级别噪音。
- 不改 required=true 的失败语义，不改其它日志 family。

## 验收标准
- [ ] `pickJsonValue(..., { required: false })` 未命中时不再发 `warn json value not found`。
- [ ] 可选 miss 仍保留为低优先级调试日志，便于需要时排查。
- [ ] 执行器单测覆盖并通过。

## 范围
- 会改：
  - `lib/test-worker.mjs`
  - `tests/unit/test-executor.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - `lib/test-generator.ts`
  - `lib/intent-execution-compiler.ts`
  - UI / route / DB schema

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：optional json miss noise downgrade
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- `pickJsonValue` 新增“optional miss 降噪”分支：
  - `required: false` 时不再发 `warn json value not found`
  - 改为保留 `debug optional json value not found`
- 补一条 worker unit test，确认日志级别和消息变更。

## 验证
- `npx vitest run tests/unit/test-executor.spec.ts -t "optional json value miss"`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮只处理 `pickJsonValue(required:false)` 的单类噪音。
- 不处理站点自身的 `moment` warning。
- 不处理 `submit navigation not observed within helper window` 这类 helper 观测信息。

## 完成后动作
- 回写 roadmap
- 如有必要，可再重跑同一草稿 real run 验证 warn 是否消失
