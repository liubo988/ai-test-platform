# Task Brief

## 标题
- Document family `doc_create_reopen_verify` recipe / fixture / verifier first cut

## 背景
- Traffic-quality 已通过真实项目知识文档 UI 样本确认 `recommendedTopFamilies=doc_create_reopen_verify`。
- 下一步需要把该 family 的 recipe / fixture / verifier 契约固化到代码，避免后续又退回泛化生成、OCR-first 或 reference-only 样本。

## 本轮目标
- 固化当前平台“知识文档导入后预览校验”的 deterministic recipe。
- 建立 `doc_create_reopen_verify` 独立 governance profile，写清 fixture 和 verifier 证据口径。
- 保持 source policy 为 `post_instrumentation_real_click_only`，不改变 release-readiness 既有口径。

## 验收标准
- [ ] DSL 能把“导入/上传知识文档”识别为需要接口收敛的 mutating action。
- [ ] recipe registry 能命中 `document.project-knowledge-import-preview`。
- [ ] document governance report 能输出 `doc_create_reopen_verify` 的 recipe / fixture / verifier 契约。
- [ ] next-development plan 能显示 document family governance profile 状态。
- [ ] 受影响单测、build、build:web、boundary、doc links、roadmap check 通过。

## 范围
- 会改：
  - `lib/intent-action-dsl.ts`
  - `lib/intent-recipe-registry.ts`
  - `lib/intent-e2e-document-family-governance.ts`
  - `lib/intent-e2e-next-development-plan.ts`
  - `scripts/intent-e2e-document-family-governance.ts`
  - `scripts/intent-e2e-next-development-plan.ts`
  - 相关 unit tests、README / runbook / roadmap
- 不会改：
  - 数据库 schema
  - OCR route / verifier
  - benchmark harness
  - release-readiness completion summary 既有口径
  - 外部 document family recipe

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-next-development-prep-2026-05-07.md`

## Roadmap 对齐
- 当前阶段：Traffic Quality 之后的 document family governance 第一刀。
- 对应小步：`doc_create_reopen_verify` recipe / fixture / verifier contract bootstrap。
- 本轮完成后回写：`2026-05-08 第五百四十二次更新`。

## 计划修改点
- 在 action DSL 中把 `导入 / 上传 / import / upload` 纳入 mutating intent 识别，并禁止只断言 textarea 原文。
- 在 recipe registry 中新增 `document.project-knowledge-import-preview`。
- 新增 document family governance service / CLI，输出 JSON / Markdown 报表。
- 将 next-development plan 接入 document governance profile 状态。
- 补充单测和稳定文档。

## 验证
- `npx vitest run tests/unit/intent-action-dsl.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-execution-plan.spec.ts tests/unit/intent-e2e-document-family-governance.spec.ts tests/unit/intent-e2e-next-development-plan.spec.ts tests/unit/test-generator.spec.ts`
- `npm run intent:document-family:governance -- --project-uid proj_default --require-ready`
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 当前只覆盖当前平台项目知识文档 UI，不覆盖外部文档系统、分享权限、导出或 OCR。
- 真实 document-like real_click 目前样本量仍小；本轮只固化第一刀契约，后续仍需扩样和 release guard baseline。

## 完成后动作
- 回写 roadmap。
- 同步 README、runbook、next-development prep 与 handoff。
