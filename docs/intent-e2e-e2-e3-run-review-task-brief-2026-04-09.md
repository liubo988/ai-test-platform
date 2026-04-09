# Task Brief

## 标题
- E2/E3 playbook candidate + run review：把成功经验和失败下一步动作结构化输出

## 背景
- 当前成功 run 主要沉淀到 `knowledgeCandidates`，但缺少更程序化的 playbook 候选摘要。
- 当前失败时已有 `failureCta`，但 workbench 还缺“最相似经验摘要 / 下一步建议”的统一复盘面板。

## 本轮目标
- 为成功 run 生成结构化 `playbookCandidates`
- 为 run 生成统一 `review` 结果，至少包含：
  - `playbookCandidates`
  - `nextStepAdvice`
- 在 run result / run registry / workbench 中透出这些 review 信息

## 验收标准
- [ ] 成功 run 会产出可复用的 playbook candidate 摘要
- [ ] 失败 run 会产出明确下一步建议
- [ ] workbench 能直接看到 review 信息

## 范围
- 会改：
  - `lib/intent-e2e-run-review.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/intent-e2e-run-review.spec.ts`
  - `tests/unit/intent-e2e-run-registry.spec.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
- 不会改：
  - DB schema
  - 新增 route
  - 项目能力工作台其它流程

## 必读上下文
- `AGENTS.md`
- `docs/intent-e2e-experience-recall-playbook-plan-2026-04-09.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：post-`success-hardening` / `E2-E3`
- 对应小步：playbook candidate / run review
- 本轮完成后回写：专项文档阶段状态 + roadmap 最新进度

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-run-review.spec.ts tests/unit/intent-e2e-run-registry.spec.ts tests/unit/intent-e2e-service.spec.ts`

## 风险 / 未覆盖
- 首版 review 仍在当前 run 同步尾部生成，不单独引入后台 worker
- playbook 首版先做 candidate，不直接自动写入 recipe registry
