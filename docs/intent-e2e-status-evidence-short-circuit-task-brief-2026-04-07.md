# Task Brief

## 标题
- 列表状态证据短路，避免 row 已含状态时继续慢回查

## 背景
- 最新真实通过 run `intent-run-df50cd2e-06b9-4c0e-80a7-7c686ba93226` 已证明草稿 auto-launch 链路恢复正常。
- 但日志仍显示：目标行在列表里很早就命中，且行文本已含 `新入库`，脚本后续仍继续执行 `statusEvidenceRecordCheck -> readJsonResponse -> pickJsonRecord`，拖慢通过场景。
- 这不是阻塞失败，而是高频浪费点；适合继续按最小一刀收口。

## 本轮目标
- 当 `rowText` 已经包含目标状态时，直接把它当作状态证据收口。
- 不再为了补结构化状态去继续读取大列表 JSON。
- 同步约束编译注释、prompt 和能力示例，避免模型继续生成旧慢链路。

## 验收标准
- [ ] compiler 生成的 row-status fallback 骨架会先检查 `rowText` 是否已命中预期状态。
- [ ] 若 `rowText` 已命中预期状态，不再继续生成 `listJson / matchedRecord` 的慢回查作为必经路径。
- [ ] 相关 unit tests 覆盖并通过。

## 范围
- 会改：
  - `lib/intent-execution-compiler.ts`
  - `lib/test-generator.ts`
  - `lib/intent-action-library.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
  - `tests/unit/test-generator.spec.ts`
  - `tests/unit/intent-action-library.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - run registry / route
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：status evidence latency follow-up
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- compiler 的 row status fallback 改成 `rowText -> short-circuit -> else 再 listJson/detail fallback`。
- step instructions / repair prompt / action library 示例明确禁止“rowText 已命中还继续读 list JSON”。

## 验证
- `npx vitest run tests/unit/intent-execution-compiler.spec.ts tests/unit/test-generator.spec.ts tests/unit/intent-action-library.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮只短路“rowText 已直出目标状态”的慢路径，不处理其它 listJson 解析成本。
- 不承诺显著降低所有 family 的 wall time，只收口这类通过用例里的高频浪费。

## 完成后动作
- 回写 roadmap
