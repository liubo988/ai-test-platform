# Task Brief

## 标题
- Phase 1 family 证据补强与 recipe 资产显式链路

## 背景
- 当前 `intent-e2e` 的 Phase 1 family 资产已经接进主链路，且全项目 fresh compare 已出现正向变化，但证据仍停留在全项目窗口，缺少 `priorityScenarioFamily` 维度的正式 benchmark / replay / compare 能力。
- 项目 recipe 资产当前仍默认落在 ignored 的 `reports/intent-e2e/projects/<projectUid>/intent-e2e.project-recipes.json`，缺少显式导出 / 导入链路，导致 family-scoped 证据难以稳定复核。

## 本轮目标
- 在现有 benchmark harness 上正式补齐 `priorityScenarioFamily` 维度。
- 让 benchmark CLI 支持 family-scoped freeze / replay / compare。
- 给项目 recipe 资产补显式 export / import / replay 链路，不再只依赖 ignored 本地文件。
- 对 `business_create_list_verify`、`list_search_detail`、`modal_or_drawer_save` 跑出 fresh family-scoped compare 结论。

## 验收标准
- [ ] benchmark case / replay / compare 数据模型正式承载 `priorityScenarioFamily`，且读取旧 benchmark 文件保持兼容。
- [ ] `npm run intent:benchmark:freeze|replay|compare -- --priority-scenario-family <family>` 可工作。
- [ ] 项目 recipe 资产支持显式 export / import，并能通过现有 benchmark CLI 串到验证流程里。
- [ ] 相关 unit tests、build、e2e、boundary、doc/roadmap 检查通过。
- [ ] 三个目标 family 都有 fresh family-scoped report 路径与独立结论；样本不足时明确记为 `insufficient evidence`。

## 范围
- 会改：
  - `lib/intent-e2e-benchmark.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - `lib/ai/intent-e2e-insights.ts`
  - `lib/intent-project-recipe-registry.ts`
  - `tests/unit/intent-e2e-benchmark.spec.ts`
  - `tests/unit/intent-project-recipe-registry.spec.ts`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - Phase 2/3/4 runtime loop
  - family 主执行逻辑的大范围重写
  - 无关 UI
  - 数据库 schema

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-90-success-codex-implementation-brief-2026-04-13.md`

## Roadmap 对齐
- 当前阶段：Phase 1 证据补强与可复现化
- 对应小步：family-scoped benchmark evidence + project recipe asset explicit chain
- 本轮完成后回写：roadmap 最新一条进度更新

## 计划修改点
- benchmark baseline candidate / suite / replay / compare 模型补 `priorityScenarioFamily`
- benchmark CLI 补 `--priority-scenario-family` 与 recipe asset 输入输出参数
- 项目 recipe registry 补 export / import 能力
- 单测补 family scope、旧 benchmark 兼容、recipe asset roundtrip

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-project-recipe-registry.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family <family> ...`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family <family> ...`

## 风险 / 未覆盖
- family-scoped compare 仍依赖当前 benchmark window 内存在足够样本；若样本过少，本轮只能输出 `insufficient evidence`。
- recipe 资产导入只是显式化链路，不会在本轮把 ignored 本地资产平台化成 Phase 2 级别的统一分发系统。

## 完成后动作
- 回写 roadmap
- 更新 README / runbook 的 benchmark 与 recipe asset 用法
- 给出三个目标 family 的 fresh report 路径与结论
