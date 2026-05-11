# Task Brief

## 标题
- Intent E2E next development preparation pack

## 背景
- 当前 release-readiness 与 traffic-quality 收口已经完成。
- 当前 `proj_default` 的 `developmentGate.status=no_admissible_code_work`，继续开发必须先准备清晰的准入、证据和 brief 模板，避免后续误开 document / OCR / verifier 切片。

## 本轮目标
- 固化后续开发准入命令。
- 新增后续开发计划报表命令。
- 新增后续开发准备文档与切片 brief 模板。
- 同步 README / roadmap，明确下一轮只有 gate 通过才允许开发。

## 验收标准
- [x] 有统一的 next-dev check 命令。
- [x] 有统一的 next-dev plan 报表命令。
- [x] 有后续开发准备文档。
- [x] 有下一轮开发切片 brief 模板。
- [x] README / roadmap 已回写。

## 范围
- 会改：
  - `package.json`
  - `lib/intent-e2e-next-development-plan.ts`
  - `lib/intent-e2e-traffic-quality-governance.ts`
  - `scripts/intent-e2e-next-development-plan.ts`
  - `README.md`
  - `docs/intent-e2e-next-development-prep-2026-05-07.md`
  - `docs/intent-e2e-next-development-slice-brief-template-2026-05-07.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `tests/unit/intent-e2e-next-development-plan.spec.ts`
- 不会改：
  - 业务主链路
  - release-readiness 语义
  - traffic-quality source 语义
  - benchmark harness
  - document verifier / OCR 主链路

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-current-development-closure-handoff-2026-05-07.md`

## Roadmap 对齐
- 当前阶段：Traffic Quality / current closure handoff 后的后续开发准备
- 对应小步：把后续准入与模板固化到 repo
- 本轮完成后回写：第五百三十四次更新

## 验证
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30`
- `npm run intent:next-dev:check -- --project-uid proj_default --window-days 30`
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-next-development-plan.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`

## 风险 / 未覆盖
- 当前 next-dev check 预期仍失败，因为当前没有 admissible development work。
- 本轮只做准备，不制造真实 document-like `real_click`。

## 完成后动作
- 回写 roadmap。
- 保持当前 handoff 结论不变。
