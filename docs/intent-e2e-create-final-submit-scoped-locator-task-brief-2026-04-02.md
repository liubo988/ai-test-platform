# Task Brief

## 背景

- `2026-04-02` 最新真实 rerun `3` 次已确认：
  - `create_form_ready_strict_mode` 已从最新 `3 / 3` 样本中退出。
  - 当前唯一仍留在真实 rerun 里的模型失败簇是：
    - `create_final_submit_page_regex_fallback`
- 典型报错：
  - `locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded`
  - `waiting for getByRole('button', { name: /^(?!.*保存并继续)(?!.*上一步).*(保\\s*存|提\\s*交|确\\s*定).*$/i }).last()`
- 真实生成代码已经退化成整页 page-level regex + `.last()`：
  - `page.getByRole('button', { name: /^(?!.*保存并继续)(?!.*上一步).*(保\\s*存|提\\s*交|确\\s*定).*$/i }).last()`

## 目标

- 只收口 `create_final_submit_page_regex_fallback`：
  - 新建商机第三页 / 附件页的最终提交按钮，不再直接退化成整页 regex + `.last()` 盲等。
  - 改为“末页锚点确认 + scoped candidate containers 顺序尝试”的约束。

## 范围

- `lib/intent-execution-compiler.ts`
  - 识别 business-create final submit step，并补强 goal / requiredAssertions / instructions。
- `lib/test-generator.ts`
  - 在创建商机向导规则里补 page-level regex fallback 禁止项。
  - 补针对 `page.getByRole(...).last()` 这类失败的 repair diagnosis。
- `tests/unit/intent-execution-compiler.spec.ts`
- `tests/unit/test-generator.spec.ts`
- 文档回写：
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`

## 非目标

- 不改 runtime helper。
- 不处理 `env_blocked`。
- 不并行改 `createdBusinessId` 提取失败。
- 不扩到列表链、详情链或其它 family。

## 验收标准

- compiler 生成的 business-create final submit step 注释里，明确出现：
  - 不要直接退化成 `page.getByRole('button', { name: /^(?!.*保存并继续)(?!.*上一步).*(保\\s*存|提\\s*交|确\\s*定).*$/i }).last()`
  - 先确认 `附件信息 / 上传录音文件 / 上传图片`
  - 再按 scoped candidate containers 顺序找最终按钮
- general / repair prompt 里出现同一条约束。
- 受影响单测通过。

## 验证命令

- `npx vitest run tests/unit/intent-execution-compiler.spec.ts tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
