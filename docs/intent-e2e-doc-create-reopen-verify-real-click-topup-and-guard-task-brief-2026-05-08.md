# Task Brief

## 标题
- Document family `doc_create_reopen_verify` real-click top-up and independent guard baseline

## 背景
- `doc_create_reopen_verify` 的 recipe / fixture / verifier 契约已完成第一刀。
- 当前仍只有少量真实 document-like real_click 证据，需要继续补样，并建立不影响现有 release-readiness summary 的独立 document-family guard。

## 本轮目标
- 追加执行当前平台知识文档导入/预览 real-click 样本。
- 新增独立 `document-family release guard` 报表入口。
- 将 next-development plan 同步输出 document governance 和 document guard 路径，并显示 document guard 状态。

## 验收标准
- [x] `doc_create_reopen_verify` document-like real_click 信号数从 `1` 增加到至少 `2`。
- [x] 独立 guard 只接受 `post_instrumentation_real_click_only`，并能校验 governance profile 与 admissible passed seed runs。
- [x] `npm run intent:document-family:guard -- --project-uid proj_default --require-passed` 通过。
- [x] `intent:next-dev:plan` 同步写出 document-family guard JSON / Markdown。
- [x] 不修改现有 release-readiness 5/5 summary 口径，不接入 OCR-first。

## 范围
- 会改：
  - `lib/intent-e2e-document-family-release-guard.ts`
  - `scripts/intent-e2e-document-family-release-guard.ts`
  - `lib/intent-e2e-next-development-plan.ts`
  - `scripts/intent-e2e-next-development-plan.ts`
  - 相关 unit tests、README / runbook / roadmap
- 不会改：
  - `lib/intent-e2e-release-guard.ts` 的既有 priority family release-readiness 语义
  - benchmark harness
  - OCR route / verifier
  - 数据库 schema

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-doc-create-reopen-verify-first-cut-task-brief-2026-05-08.md`

## Roadmap 对齐
- 当前阶段：Document family governance 第一刀后的 guard baseline bootstrap。
- 对应小步：`doc_create_reopen_verify` real-click top-up + independent guard baseline。
- 本轮完成后回写：`2026-05-08 第五百四十三次更新`。

## 计划修改点
- 新增 document family release guard service / CLI。
- Guard 基于 latest traffic-quality、document governance profile 和 document real-click seed reports 聚合判定。
- `next-dev:plan` 同步生成 document-family guard report，并在候选表中展示 separate guard status。
- 补充单测和稳定文档。

## 验证
- `npm run intent:document-real-click:seed -- --project-uid proj_default --max-samples 1 --poll-interval-ms 3000`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30`
- `npm run intent:document-family:guard -- --project-uid proj_default --require-passed`
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30`
- `npx vitest run tests/unit/intent-e2e-document-family-release-guard.spec.ts tests/unit/intent-e2e-document-family-governance.spec.ts tests/unit/intent-e2e-next-development-plan.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮 document guard 是独立 guard，不代表所有 AI 生成或所有 document family 已 release-ready。
- 当前只覆盖 `doc_create_reopen_verify`，不覆盖 document edit/share/export/search families。

## 完成后动作
- 回写 roadmap。
- 同步 README、runbook、next-development prep 与 handoff。
