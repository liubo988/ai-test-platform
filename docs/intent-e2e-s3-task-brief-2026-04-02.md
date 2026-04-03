# Task Brief

## 标题
- S3：动态 repair budget + 失败 CTA

## 背景
- `S1/S2` 已把 run 前 `assetReadiness`、`launch decision route` 和 blocked flow 接到入口，但进入自动运行链路后的 repair 预算仍然只看统一 `selfHealRetries`。
- 当前失败结果虽然已经有 `finalFailureTriage / qualitySplit / assetReadiness`，workbench 里仍主要停留在总结文案，用户看不到“现在该做什么”的明确动作。

## 本轮目标
- 在 `intent-e2e-service` 内按失败类和 `assetReadiness` 动态收紧 repair 次数。
- 保持并复用现有单 run `repair stagnation` 早停，不新增并行 suppression 体系。
- 在 workbench 失败区补最小 CTA 面板，把失败结果转成明确下一步动作。

## 验收标准
- [ ] blocker 类失败不再跑满默认 repair 配额。
- [ ] `asset_missing` 与分析后确认的 `no_hit` 会收紧 repair budget。
- [ ] workbench 失败后至少提供“补前置 / 生成知识草稿 / 改描述 / 转手动任务”四个动作入口。
- [ ] `repairBudget / failureCta` 能随 run snapshot 保留并恢复。

## 范围
- 会改：
  - `lib/intent-e2e-repair-budget.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/intent-e2e-run-registry.spec.ts`
- 不会改：
  - `launch-decision route` 语义
  - family route
  - fixture executor
  - 新 suppression 系统

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening
- 对应小步：`S3`
- 本轮完成后回写：`docs/intent-e2e-success-hardening-plan-2026-04-01.md` 与 `docs/intent-e2e-production-roadmap-2026-03-29.md`

## 计划修改点
- 新增独立 `repair budget` helper，统一根据 `assetReadiness / triage / selfHealRetries` 计算修复上限。
- 在 service 的 blocked / terminal failure 输出里补 `repairBudget` 和 `failureCta`。
- 在 workbench 失败区接入 CTA 面板与 repair budget 摘要，并复用现有治理 / workbench / workspace 入口。
- 补 service 与 run registry 单测，覆盖预算收紧、CTA contract 和 snapshot 恢复。

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-run-registry.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不调整 `launch decision` 入口语义，service 直调下仍允许 generate + execute 首轮尝试。
- 本轮只补 failure CTA 最小面板，不提前扩成新的运营或人工协作流程。

## 完成后动作
- 回写 success hardening 文档中的 `S3` 状态与度量模板。
- 回写 production roadmap 最新进度。
