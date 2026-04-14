# Task Brief

## 标题
- intent-e2e analyzing 阶段子步骤耗时透明化

## 背景
- 真实 run `intent-run-22b72655-66bd-4d95-a35f-9ebee2e4c466` 在 `analyzing -> attempt_started` 之间存在接近 2 分钟的黑箱停顿。
- 当前 run 归档只知道进入了 `analyzing`，但看不出慢在页面快照、experience search、planning，还是历史脚本候选加载。

## 本轮目标
- 把 `analyzing` 阶段拆成可审计的 timing 子步骤，后续任何 run 都能直接看出慢点落在哪一段。

## 验收标准
- [ ] `analyzing` 阶段会输出页面快照、经验检索、planning、历史脚本候选等子步骤 timing message
- [ ] timing message 使用累计耗时和分步耗时，不依赖额外 API 字段也能审计
- [ ] 相关 unit / build / e2e / doc checks 通过

## 范围
- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `docs/intent-e2e-analyze-stage-timing-task-brief-2026-04-14.md`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - 无关 UI
  - analyze 阶段的实际并发 / 缓存策略

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：R6 / reuse + runtime observability 收口
- 对应小步：把 analyzing 黑箱拆成子阶段 timing evidence
- 本轮完成后准备回写到哪一条更新：2026-04-14 最新一条 roadmap 更新

## 计划修改点
- 给 `analyzing` 阶段补统一 timing message builder
- 对页面快照、规则反馈、experience search、planning、历史脚本候选加载分别打点
- 单测补 analyze timing message 回归

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `npm run test:e2e`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 这轮只增加可观测性，不直接缩短 analyzing 时间
- 这轮不新增事件 schema 字段，run 审计仍靠已有消息流

## 完成后动作
- 回写 roadmap
- 用下一条真实 run 观察到底是哪一个 analyzing 子步骤在拖慢启动
