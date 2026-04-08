# Task Brief

## 标题
- capability verify 优先锚定“点击沉淀能力”当下的正式任务成功脚本

## 背景
- 当前正式任务点击“沉淀能力”后，新能力验证理论上应优先复用来源正式任务的已通过脚本。
- 新链路已经支持在 capability meta 中保存 `sourceTaskConfigUid / sourceTaskLatestPlanUid`，但历史上更早沉淀的能力没有这组来源锚点，verify 会退回重新生成，和“沉淀能力应继承来源正式任务脚本”的预期不一致。

## 本轮目标
- 对新沉淀能力继续坚持“按点击当下的正式任务 plan 精确复用”。
- 对缺少 `sourceTask*` 元数据的旧能力，只补一层保守兼容：从同项目已通过正式任务中推断唯一语义匹配来源，并回填来源锚点后复用。

## 验收标准
- [ ] capability meta 已有 `sourceTaskConfigUid / sourceTaskLatestPlanUid` 时，verify 继续按该正式任务成功 plan 复用。
- [ ] capability meta 缺少 `sourceTask*` 锚点时，若能唯一命中同项目已通过正式任务，verify 会回填来源锚点并直接复用该 passed plan。
- [ ] 若找不到唯一匹配正式任务，或来源脚本不满足现有 compatibility gate，verify 仍保守回退生成，不做拍脑袋复用。

## 范围
- 会改：
  - `lib/capability-verification-service.ts`
  - `tests/unit/capability-verification-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 正式任务 / 能力保存 API 契约
  - 需求编排工作台 UI 交互

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：capability verify restore-source anchor backfill
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md`

## 计划修改点
- 在 capability verify source-plan 解析里补“显式来源锚点优先、旧能力唯一语义匹配回填兜底”。
- 回填时只写最小来源任务元数据，不扩新 schema，不改变现有 verified-plan 优先级。
- 补单测覆盖“旧能力唯一命中已通过正式任务后回填并复用”的回归。

## 验证
- `npx vitest run tests/unit/capability-verification-service.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 历史能力若存在多个语义相同且都通过的正式任务，本轮会保守放弃自动推断，仍回退生成。
- 本轮不处理“已进入工作台但未保存能力时直接验证已有旧能力”的前端交互提示。

## 完成后动作
- 回写 roadmap
