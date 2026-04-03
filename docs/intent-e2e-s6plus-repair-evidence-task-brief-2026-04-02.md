# Task Brief

## 标题
- S6+ 更强 repair 运行时证据：DOM delta 最小切片

## 背景
- `S1-S6` 已完成，但当前 repair 受控观察仍主要提供“最新页面 surface + anchor/frame presence”。
- 文档里 `S6+` 候选明确提到要补“更强的 Repair 运行时证据”，但这一步不能发散到新 worker 协议或更重 agent loop。

## 本轮目标
- 只补最小的 `DOM delta` 证据：让 repair prompt 除了知道“现在页面长什么样”，还知道“相对初始分析快照发生了什么变化”。
- 不改会话复用，不引入新 artifact 类型，不改执行器契约。

## 验收标准
- [ ] repair observation report 能产出相对初始分析快照的 `surface_delta`
- [ ] repair prompt 能带出 `surface_delta`，指导模型优先沿新增 / 消失 surface 修补
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `docs/intent-e2e-s6plus-repair-evidence-task-brief-2026-04-02.md`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/test-generator.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/test-generator.spec.ts`
- 不会改：
  - `lib/test-worker.mjs`
  - 新 artifact 协议
  - 会话复用 / auth session 语义

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening `S6+` 候选
- 对应小步：更强 repair 运行时证据
- 本轮完成后准备回写到哪一条更新：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条进度更新

## 计划修改点
- 在 `intent-e2e-service` 的 repair observation report 中补 `surface_delta` probe
- 在 `test-generator` 的 repair prompt 渲染中增加 `surface_delta` 使用边界
- 补 service / prompt builder 单测，验证 delta 证据已真正进入 repair 输入

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/test-generator.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不补列表 JSON / 详情字段专用 artifact；仍只在现有观察主链上补最小 DOM delta
- 本轮不改 worker，所以 delta 基于“初始 analyze snapshot vs 最新 repair observation snapshot”，不是失败瞬间 DOM dump

## 完成后动作
- 回写 `docs/intent-e2e-success-hardening-plan-2026-04-01.md`
- 回写 `docs/intent-e2e-production-roadmap-2026-03-29.md`
