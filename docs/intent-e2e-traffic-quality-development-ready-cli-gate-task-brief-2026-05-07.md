# Task Brief

## 标题
- Traffic Quality development-ready CLI gate

## 背景
- traffic-quality 已能输出 `developmentGate.status`。
- 当前 `proj_default` 的 gate 是 `no_admissible_code_work`，但自动化入口还不会在“继续开发前”主动失败。

## 本轮目标
- 给 `intent:traffic-quality` 报表入口增加 `--require-development-ready`。
- 当 `developmentGate.status` 不是 `ready_for_document_family_governance` 或 `ready_for_ungoverned_priority_family` 时，命令返回失败。
- 保持默认报表生成行为不变，避免影响现有 traffic-quality reporting。

## 验收标准
- [ ] `--require-development-ready` 能在当前 `no_admissible_code_work` 下返回失败。
- [ ] JSON / Markdown 报表仍正常写出。
- [ ] 单测覆盖 development gate ready 判断和摘要文案。
- [ ] 不改 release-readiness 既有报表语义。

## 范围
- 会改：
  - `lib/intent-e2e-traffic-quality.ts`
  - `scripts/intent-e2e-traffic-quality-report.ts`
  - `tests/unit/intent-e2e-traffic-quality.spec.ts`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - document family recipe / verifier / fixture
  - OCR route / verifier
  - benchmark harness
  - release-readiness 既有报表语义

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：traffic-quality next-plan execution bootstrap
- 对应小步：把 development gate 接到可自动化阻断入口
- 本轮完成后回写：第五百三十一次更新

## 验证
- `npx vitest run tests/unit/intent-e2e-traffic-quality.spec.ts`
- `npm run build`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30 --require-development-ready`（预期失败）
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 该 gate 只阻断“继续开发”自动化，不负责生成真实 document traffic。
- 默认命令不加 `--require-development-ready` 时仍只生成报表，不改变现有 reporting 兼容性。

## 完成后动作
- 回写 roadmap。
- 用当前 `proj_default` 验证 require gate 的失败路径。
