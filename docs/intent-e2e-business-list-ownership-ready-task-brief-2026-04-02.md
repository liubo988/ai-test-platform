# Task Brief

## 标题
- post-R14 success hardening：business list ownership ready 最小收口

## 背景
- `2026-04-02` 最新真实 rerun `3` 次后，当前场景仍未恢复通过。
- 最新业务失败里有一条已经前移到 `Step 1: 进入商机列表页并确认页面就绪`：
  - `expect(page.getByText('我创建的').first()).toBeVisible(...)`
- 这条失败不属于真正的业务成功标准，而是页面 ready 阶段把裸 `我创建的` 文本当成稳定锚点。

## 本轮目标
- 只修这条最小缺口：
  - 商机列表 page-ready 阶段，不再鼓励或回流 `getByText('我创建的').first()` 这类裸文本可见性断言
- 收口范围：
  - compiler 注释 / slot 指令
  - generate prompt 的默认约束
  - repair diagnosis 的定向修复提示

## 验收标准
- [x] compiler 对 business-list page-ready step 输出明确约束：不用裸 `我创建的` 文本做 ready 断言
- [x] generate / repair prompt 都包含同一口径
- [x] 单测覆盖 compiler 与 repair prompt
- [x] `npm run build` 与受影响 vitest 通过

## 范围
- 会改：
  - `docs/intent-e2e-business-list-ownership-ready-task-brief-2026-04-02.md`
  - `lib/intent-execution-compiler.ts`
  - `lib/test-generator.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
  - `tests/unit/test-generator.spec.ts`
- 不会改：
  - `lib/test-worker.mjs`
  - `lib/ai/intent-e2e-service.ts`
  - route / component / db / worker runtime 主链

## 必读上下文
- `AGENTS.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`
- `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`

## 验证
- `npx vitest run tests/unit/intent-execution-compiler.spec.ts tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 本轮只收口 page-ready 阶段的 ownership text assertion，不处理后续 `status_evidence_missing`
- 本轮不改 runtime helper，仅改编译与提示链
- 本轮未重新触发真实 UAT rerun，真实效果仍待下一轮同场景回放确认

## 完成后动作
- 若验证通过，按 roadmap 固定模板回写本轮目标 / 已完成 / 验证 / 风险 / 下一步
- 下一步仍只围绕最新 top failure cluster 决定是否继续开刀
