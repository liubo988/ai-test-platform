# Task Brief

## 背景

- `2026-04-02` 最新真实 rerun `3` 次已确认：
  - `business-list page-ready ownership ready` 已把首轮 `Step 1 / 我创建的` 失败推出去。
  - `status-evidence derived businessId fallback` 已把 `状态证据缺失：列表行已命中，但列表响应未返回状态` 推出去。
- 当前最新主失败已收敛为：
  - `2 / 3`：`create_form_ready_strict_mode`
  - 典型报错：
    - `getByRole('heading', { name: '商机联系人信息' }).first().or(locator('label[title="商机来源"]').first())`
    - `strict mode violation`
- 真实生成代码里，Step 2 把“创建页 ready 任一锚点可见”写成了 union locator：
  - `await expect(contactStepHeading.or(sourceLabel)).toBeVisible(...)`

## 目标

- 只收口 `create_form_ready_strict_mode`：
  - 新建商机页第一页 ready 锚点不再生成 `locatorA.or(locatorB)` 这种 strict-mode 易炸写法。
  - 改为“单一主锚点 + 顺序 fallback”的约束。

## 范围

- `lib/intent-execution-compiler.ts`
  - 新增 create-form-ready step 识别，并改写该类 step 的 goal / requiredAssertions / instructions。
- `lib/test-generator.ts`
  - 在创建商机向导规则里补 `.or()` 禁止项。
  - 补针对 `contactStepHeading.or(sourceLabel)` strict mode 的 repair diagnosis。
- `tests/unit/intent-execution-compiler.spec.ts`
- `tests/unit/test-generator.spec.ts`
- 文档回写：
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`

## 非目标

- 不改 runtime helper。
- 不处理 `createdBusinessId` 提取失败。
- 不并行改提交链、列表链、详情链。

## 验收标准

- compiler 生成的 create-form-ready step 注释里，明确出现：
  - 不要写 `await expect(contactStepHeading.or(sourceLabel)).toBeVisible(...)`
  - 如需备用锚点，按顺序 fallback，不要 union locator
- general / repair prompt 里出现同一条约束。
- 受影响单测通过。

## 验证命令

- `npx vitest run tests/unit/intent-execution-compiler.spec.ts tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
