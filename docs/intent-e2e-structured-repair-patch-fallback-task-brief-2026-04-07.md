# Task Brief

## 标题
- intent-e2e：结构化 repair patch 瞬时失败时回退自由代码修复

## 背景
- 真实 run `intent-run-1455594f-0002-49b4-a2f7-0dd0e1952a74` 已证明：首轮 generate 能进入执行，但 repair 阶段会直接失败在 `LLM 结构化 repair patch 失败: fetch failed`。
- generate 首轮已经有 structured slot patch 失败 -> legacy code generation 的降级兜底。
- repair 阶段当前还没有对称兜底，导致结构化 repair patch 一旦失败，整轮直接结束。

## 本轮目标
- 只为 repair 阶段增加最小降级兜底。
- 当 structured repair patch 失败时，改走现有 legacy 自由代码 repair 链路。
- 不改 repair memory、grader、ExecutionPlan 语义。

## 验收标准
- [ ] structured repair patch 失败时，repair 不再直接结束
- [ ] 实时事件会明确提示“结构化 repair 失败，已回退到自由代码修复”
- [ ] legacy repair prompt 仍沿用现有构造逻辑
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator-structured.spec.ts`
- 不会改：
  - 数据库 schema
  - route 契约
  - repair memory 存储结构

## 必读上下文
- `AGENTS.md`
- `docs/testing.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening follow-up
- 对应小步：repair 链路抗瞬时 LLM 失败降级
- 本轮完成后准备回写到：真实 rerun 再观察 repair 阶段是否还会直接报错退出

## 计划修改点
- 让结构化 repair patch 生成函数返回成功/失败状态
- repair 主链路在失败时发出降级提示并继续走现有 legacy repair prompt
- 补充“structured repair 失败 -> legacy repair fallback”单测

## 验证
- `npm run build`
- `npx vitest run tests/unit/test-generator-structured.spec.ts`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 本轮只处理 repair 阶段的结构化 patch 瞬时失败
- 不处理模型端真实低质量 repair 输出

## 完成后动作
- 用新的真实 run 验证 repair 阶段不再因为 `fetch failed` 直接结束
