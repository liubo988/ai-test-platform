# Task Brief

## 标题
- E1 experience recall MVP：把同页面相似成功 run 变成结构化提示

## 背景
- 当前 `successful run code reuse` 只能命中几乎完全相同的请求；自然语言换个说法后，很容易退回从零生成。
- 仓库已经有 run snapshots、`snapshotSignature`、`matchedRecipeSlugs`、`usedHelpers` 等结构化运行证据，足够支撑一层轻量 recall。

## 本轮目标
- 新增项目作用域的 `experience search` helper。
- 在 `intent-e2e-service` 里把 recall 结果接入 generate / repair prompt 的 planning 上下文。
- 在运行结果里返回本次命中的经验摘要，方便 workbench 可见。

## 验收标准
- [ ] 同项目、同页面、同 family 的相似请求，能返回结构化 `experienceHints`
- [ ] prompt 中能看到经验摘要，而不是整段历史脚本
- [ ] exact-match successful run reuse 仍优先，不被 recall 覆盖

## 范围
- 会改：
  - `lib/intent-e2e-experience-search.ts`
  - `lib/test-generator.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-experience-search.spec.ts`
  - `tests/unit/test-generator.spec.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
- 不会改：
  - DB schema
  - route contract
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/intent-e2e-experience-recall-playbook-plan-2026-04-09.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：post-`success-hardening` / `E1`
- 对应小步：experience recall MVP
- 本轮完成后回写：专项文档阶段状态 + roadmap 最新进度

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-experience-search.spec.ts tests/unit/test-generator.spec.ts tests/unit/intent-e2e-service.spec.ts`

## 风险 / 未覆盖
- 首版仅做项目作用域 recall，不做跨项目共享
- 首版只返回结构化摘要，不做全文 transcript / 历史代码注入
