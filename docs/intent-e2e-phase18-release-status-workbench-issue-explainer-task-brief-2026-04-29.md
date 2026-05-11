# Task Brief

## 标题
- Phase 18 release status workbench issue explainer

## 背景
- Phase 15 已提供 `intent:release-status` CLI。
- Phase 16 已提供受权限保护的 `GET /api/intent-e2e/release-status`。
- Phase 17 已在 `/intent-e2e` 工作台“历史运行洞察”区接入只读面板。
- 当前面板能显示 ready / attention / blocked，但对缺证据、warning / blocked 的具体处理线索还不够直观。

## 本轮目标
- 强化 release status 工作台面板的可视化解释能力。
- 对 `ready / attention / blocked` 给出更明确的摘要文案。
- 对非 passed check、缺失 family evidence、release / knowledge failures 展开可读原因。
- API 错误时保留只读空状态，区分权限、缺证据和其他读取失败。

## 验收标准
- [x] 不改 release status API 合约和发布判定逻辑。
- [x] 面板能展示 ready 状态的“证据齐全”收口提示。
- [x] 面板能展示 warning / blocked / skipped check 的原因与 blocking 属性。
- [x] family card 能展示缺失 release / knowledge evidence 或 failure 摘要。
- [x] API 读取失败时有清晰空状态，而不是只有裸错误文本。
- [x] 构建、文档和 roadmap 检查通过。

## 范围
- 会改：
  - `components/IntentE2EWorkbench.tsx`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `app/api/intent-e2e/release-status/route.ts`
  - `lib/intent-e2e-release-status.ts`
  - release guard / knowledge-hit 判定规则
  - 数据库 schema

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 18
- 对应小步：release status workbench issue explainer
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- 增加 release status 面板展示 helper，不重新计算 readiness。
- 在面板顶部增加 status-specific 摘要。
- 在 checks 区展示非 passed 的 blocking / evidence 信息。
- 在 family 区展开 release / knowledge 缺口和 failures。
- API 错误时展示只读空状态标题和说明。

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/api-intent-e2e-release-status-route.spec.ts tests/unit/intent-e2e-release-status.spec.ts`
- `npm run intent:release-status -- --require-current-compare --json`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`
- `git diff --check`

## 风险 / 未覆盖
- 本轮只提升可读性，不做 live compare，也不自动生成缺失 artifacts。
- 如果 API 返回的是未知服务端错误，UI 只能展示保守的“暂不可用”空状态。

## 完成后动作
- 回写 roadmap。
- 同步 README / runbook。
