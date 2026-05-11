# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions `assert_extract_ui` verification primary-only bookedMgmt lookup stale-shape code-recovery

## 背景
- 当前阶段仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 在当前代码状态下，secondary compare regressions 已恢复：
  - shared-path `modal 3/3` clean
  - shared-path `list 3/3` clean
  - dedicated `ui_assert_extract 1/1 + replay` clean
  - dedicated `ui_extract 1/1 + replay` clean
- 但 dedicated `assert_extract_ui 1/1` 停在 fresh run `intent-run-943c7d37-27c1-445f-a561-9a83ee20ddad`。
- final repair output 的 `verification` 没有复用现有 hardened bookedMgmt lookup，而是回退成 `selectedOrderNoFromStep2Resp + finalPrimaryValue + finalRecordCheck=resolvePrimaryRecord(...) + not_found throw` 这条 primary-only stale shape，最终在 `Verification` 报 `record_lookup_miss`。

## 本轮目标
- 只补 `assert_extract_ui` 这条 final verification stale shape 的 generator rewrite。
- 命中后统一改写到现有 canonical bookedMgmt verification lookup。
- 用一条 exact unit regression 固定这次 trace-shaped 输出必须被 canonicalize。

## 验收标准
- [ ] `lib/test-generator.ts` 能接住这次 `assert_extract_ui` final verification stale shape
- [ ] rewrite 后输出复用 canonical bookedMgmt verification lookup，而不是继续保留 primary-only `resolvePrimaryRecord(...)` 骨架
- [ ] 新增 exact regression 并通过 `tests/unit/test-generator.spec.ts`
- [ ] `npm run build`、`npm run build:web`、`bash scripts/check-boundaries.sh` 通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - 本 brief
- 不会改：
  - `lib/test-worker.mjs`
  - `lib/ai/intent-e2e-service.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - benchmark harness / corpus / compare 口径

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions `assert_extract_ui` final verification stale-shape recovery
- 本轮完成后准备回写到哪一条更新：第三百九十一次更新

## 计划修改点
- 在 batch account verification sanitizer 中新增一条只命中本次 `assert_extract_ui` final repair shape 的 rewrite 分支
- 在单测里固定 `selectedOrderNoFromStep2Resp + finalPrimaryValue + finalRecordCheck` 旧骨架必须改写成 canonical bookedMgmt verification lookup

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只处理 generator stale shape，不处理新的 live env / replay / compare 问题
- 因为会再次改 `lib/test-generator.ts`，现有 shared-path proof 将失效，后续 benchmark 必须重新从 shared-path `modal 3/3` 起跑

## 完成后动作
- 回写 roadmap
- 本地验证通过后，再进入新的 read-only release judgement
