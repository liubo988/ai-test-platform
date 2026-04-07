# Task Brief

## 标题
- intent-e2e：结构化 slot patch 瞬时失败时回退自由代码生成

## 背景
- 最新真实 run `intent-run-9f6513c9-e066-4c75-85b5-c18d74f00f5b` 已命中旧草稿骨架保护，不再复用历史 `planCode`。
- 但该 run 随后失败在当前生成链路的结构化 slot patch 调用，错误为 `LLM 结构化 slot patch 失败: fetch failed`。
- 这类失败更像瞬时模型/网络异常，不应让整轮 generate 在生成前直接终止。

## 本轮目标
- 只为 generate 首轮增加最小降级兜底。
- 当 `ExecutionPlan -> structured slot patch` 调用失败时，改走现有 legacy 自由代码生成链路。
- 保留现有 compiler / prompt / repair 行为，不扩大到其它链路。

## 验收标准
- [ ] 结构化 slot patch 调用失败时，generate 不再直接结束
- [ ] 实时事件会明确提示“结构化失败，已回退到自由代码生成”
- [ ] legacy 自由代码生成仍沿用现有 prompt 构造逻辑
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator-structured.spec.ts`
- 不会改：
  - 数据库 schema
  - repair 主链路
  - 项目知识 / starter helper / route 契约

## 必读上下文
- `AGENTS.md`
- `docs/testing.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening follow-up
- 对应小步：generate 链路抗瞬时 LLM 失败降级
- 本轮完成后准备回写到：真实 rerun 再观察是否还有生成前直接失败

## 计划修改点
- 让结构化 slot patch 生成函数返回成功/失败状态，而不是仅发错误事件
- generate 主链路在失败时发出降级提示并继续走现有 legacy prompt
- 补充“structured 失败 -> legacy fallback”单测

## 验证
- `npm run build`
- `npx vitest run tests/unit/test-generator-structured.spec.ts`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 本轮只处理 generate 首轮的结构化 slot patch 瞬时失败
- 不处理 repair patch 的同类降级

## 完成后动作
- 用真实 run 继续观察是否还会在生成前因为 `fetch failed` 直接中断
