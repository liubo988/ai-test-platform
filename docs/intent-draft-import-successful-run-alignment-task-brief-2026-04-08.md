# Task Brief

## 标题
- 意图草稿导入正式任务时对齐最近成功 run 最终脚本

## 背景
- 当前“意图草稿”直跑链路已经会优先复用同草稿最近一次成功 intent run 的最终代码。
- 但“导入/同步正式任务”仍然直接写入 `draft.planCode`。
- 结果是：
  - 草稿页测试流程已稳定一次成功
  - 导入后的正式任务首跑仍可能吃到旧草稿脚本并首次失败
  - 第二次依赖正式任务自己的 `AI纠错计划` 才成功

## 本轮目标
- 只收口导入链路的脚本来源不一致问题。
- 让导入/同步正式任务时，优先使用同草稿最近一次成功 intent run 的最终脚本。

## 验收标准
- [ ] 同草稿最近存在匹配的成功 intent run 时，导入正式任务优先写入该 run 的最终代码
- [ ] 若最近成功 run 不匹配或不存在，仍回退到当前 `draft.planCode`
- [ ] 相关 unit tests 通过，build / doc / roadmap 校验通过

## 范围
- 会改：
  - `lib/services/project-intent-draft-service.ts`
  - `tests/unit/project-intent-task-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 正式任务执行器主链
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：intent draft import successful run code alignment
- 本轮完成后准备回写到哪一条更新：最新一条 roadmap 更新

## 计划修改点
- 在导入正式任务前，查询同草稿最近成功 intent run 的最终 attempt 代码
- 命中时优先写入正式任务 plan，并在 prompt / summary 中保留来源标记
- 未命中时保持现有 `draft.planCode` fallback

## 验证
- `npm run build`
- `npx vitest run tests/unit/project-intent-task-service.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮只修“导入/同步正式任务”脚本来源，不回写草稿表里的 `planCode`
- 匹配条件仍保持保守，不扩到 family / 语义级泛化复用

## 完成后动作
- 回写 roadmap
