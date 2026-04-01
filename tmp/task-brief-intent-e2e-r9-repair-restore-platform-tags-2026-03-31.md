# Task Brief

## 标题
- R9 repair / restore 保留非 UI runner 平台 tag

## 背景
- `R9` 已经让 `executePlan` 按 `plan.generationPrompt` 里的平台信息解析 runner，并把 `api_flow + http_runner` 接到了真实执行链路。
- 当前 `repairExecution` 与 `restoreHistoricalPlanAsLatest` 在重建 `generationPrompt` 时会丢掉原 plan 的平台 tag，导致非 UI 计划在修复或历史恢复后可能回退到默认 `browser_e2e + playwright_runner`。

## 本轮目标
- 仅修复 repair / restore 两条链路上的平台 tag 继承问题，保证非 UI plan 在重建后仍能解析到原 runner。

## 验收标准
- [ ] `repairExecution` 创建的新 plan 会保留原 `generationPrompt` 里的平台 tag。
- [ ] 非 UI plan 修复后重跑仍走对应 adapter，而不是退回 `executeTest`。
- [ ] `restoreHistoricalPlanAsLatest` 创建的新当前版本会保留原平台 tag。

## 范围
- 会改：
  - `lib/services/test-plan-service.ts`
  - `tests/unit/test-plan-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
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
- 当前阶段：R9
- 对应小步：repair / restore 保留非 UI runner 平台 tag
- 本轮完成后准备回写到哪一条更新：R9 下一条增量更新

## 计划修改点
- 在 `test-plan-service` 内新增平台 tag 继承 helper。
- 将 helper 接入 `repairExecution` 与 `restoreHistoricalPlanAsLatest` 的 `generationPrompt` 生成。
- 补单测覆盖 repair 后 adapter 路径与 restore prompt 保留行为。

## 验证
- `npm run build`
- `npx vitest run tests/unit/test-plan-service.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不扩展新的 runner 类型，只修复已有平台 tag 的继承。
- 本轮不处理历史脏数据中缺失平台 tag 的旧 plan。

## 完成后动作
- 回写 roadmap
