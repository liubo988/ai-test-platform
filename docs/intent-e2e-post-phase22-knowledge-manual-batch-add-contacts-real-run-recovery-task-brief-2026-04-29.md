# Task Brief

## 标题
- Post Phase 22：knowledge-manual batch-add-contacts real-run recovery

## 背景
- `Phase 22 / 第一刀` 和 `第二刀` 已完成，但 `proj_default` 的 traffic-quality 结论仍是 `readiness=not_ready / document_selection=insufficient_evidence`。
- 用户要求直接复用“知识目录”里的《管帮手PC端操作手册》，生成相关 AI 测试并在当前系统里真实执行。
- 手册导入脚本与项目知识里已经存在“商机列表批量加入通讯录并校验结果”能力，但 fresh `real_click` 首次落地时暴露了两层阻塞：
  - `intent-run-b7988190-2ac4-40b8-adc8-fbdccf2a81ce` 在 precheck 阶段被 `data_missing` 误杀，虽然 flow 明确声明“若当前筛选结果为空，则切换到当前有数量的商机进展阶段”。
  - `intent-run-098d75b7-0516-41a2-91d9-53fb5b55a21a` 通过 precheck 后，又因为 `business.batch-add-contacts` 确定性模板硬编码短信登录 placeholder 链，在共享登录态场景下触发 `selector_drift`。

## 本轮目标
- 以最小改动修补这条手册驱动真实 AI 测试链路：
  - 允许“可恢复空态”的列表场景绕过 `data_missing` precheck 阻断。
  - 让 `business.batch-add-contacts` 模板优先复用共享登录态，而不是手写短信登录 DOM 链。
- 产出一条 fresh manual-derived `real_click` passed 证据，并刷新最近 1 天 traffic-quality 报表。

## 验收标准
- [x] `intent-e2e` precheck policy 新增仅命中“空结果时切换到有数据列表视角”的窄范围 `data_missing` bypass。
- [x] `business.batch-add-contacts` 确定性模板改成 `__e2e.ensureLoggedIn(page, { targetUrl: BUSINESS_LIST_URL })`，并等待可见 `input#businessList_keywords`。
- [x] 相关 unit tests 通过。
- [x] fresh manual-derived `real_click` `intent-run-640e0a6d-17e0-4233-8f2b-80ee779b04d8` 通过。
- [x] `npm run intent:traffic-quality -- --project-uid proj_default --window-days 1` 产出更新报表，并诚实保持 `readiness=not_ready / document_selection=insufficient_evidence`。

## 范围
- 会改：
  - `lib/intent-e2e-precheck-policy.ts`
  - `lib/test-generator.ts`
  - `tests/unit/intent-e2e-precheck-policy.spec.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `docs/intent-e2e-post-phase22-knowledge-manual-batch-add-contacts-real-run-recovery-task-brief-2026-04-29.md`
- 不会改：
  - benchmark harness / compare / replay 主链路
  - release-guard 既有基线
  - OCR route / verifier 主链路
  - `priorityScenarioFamily` tracked family 集合
  - 数据库 schema

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `scripts/import-gbs-manual-knowledge.mjs`
- `intent-e2e.project-knowledge.json`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：
  - `Phase 22 / 第一刀` 与 `第二刀` 已闭环；本轮不是 document family 治理延伸，而是 post-Phase 22 的手册驱动 real-run recovery。
- 对应小步：
  - knowledge-manual `business.batch-add-contacts` real-click recovery
- 本轮完成后准备回写到哪一条更新：
  - 第四百九十七次更新

## 计划修改点
- 在 precheck policy 增加 `recoverable_list_empty_state`，仅对“显式声明空结果时切换到有数据列表视角”的场景忽略 `data_missing`。
- 把 `business.batch-add-contacts` 模板的登录流程收口到 `__e2e.ensureLoggedIn(...)`，消除共享会话下的 placeholder 漂移。
- 用同一条手册驱动请求连续验证：
  - precheck 不再误杀
  - 模板不再被登录链阻塞
  - 最终 fresh `real_click` passed

## 验证
- `npx vitest run tests/unit/intent-e2e-precheck-policy.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 1`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check`

## 验证结果
- `npx vitest run tests/unit/intent-e2e-precheck-policy.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/test-generator.spec.ts`
  - 通过，`3` files / `268` tests。
- `npm run build`
  - 通过。
- fresh manual-derived real runs
  - `intent-run-b7988190-2ac4-40b8-adc8-fbdccf2a81ce`
    - `failed`，原因：precheck `data_missing` 误杀。
  - `intent-run-098d75b7-0516-41a2-91d9-53fb5b55a21a`
    - `failed`，原因：`business.batch-add-contacts` 模板硬编码短信登录 placeholder，触发 `selector_drift`。
  - `intent-run-640e0a6d-17e0-4233-8f2b-80ee779b04d8`
    - `passed`，说明 precheck 与模板两处修补后，手册驱动 `real_click` 已能在当前系统完成真实执行。
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 1`
  - 通过。
  - 当前摘要：
    - `real_click=3/5 (60%)`
    - `benchmark_rerun=12/16 (75%)`
    - `replay=0/0`
    - `readiness=not_ready`
    - `document_selection=insufficient_evidence`

## 当前阶段状态
- 本轮 recovery 已完成：
  - 手册驱动 `business.batch-add-contacts` real-click 可以在当前系统真实跑通。
  - `Phase 22 / 第一刀` 与 `第二刀` 的报表语义没有被改坏。
- 这不代表 `proj_default` 已经满足 document family selection readiness。
  - 当前最新 1 天窗口虽然多了一条 passed `real_click`，但阈值仍未满足。

## 风险 / 未覆盖
- `business.batch-add-contacts` 目前仍是 recipe/template 级能力，`priorityScenarioFamily` 仍为 `untracked`，还没有 release-guard baseline。
- 本轮没有把这条能力升格为 tracked family，也没有接 compare / replay / release-status 面板。
- 当前 traffic-quality 里的 `real_click=3/5` 包含两条修复前失败 run；统计口径是正确的，但不应用来外推长期产品成功率。

## 完成后动作
- 回写 roadmap。
- 保留这条手册驱动通过证据，后续如继续扩知识目录能力，优先：
  - 要么把 `business.batch-add-contacts` 升级成 tracked family。
  - 要么继续新增 manual-derived `real_click` 样本，再观察 traffic-quality readiness 收敛情况。
