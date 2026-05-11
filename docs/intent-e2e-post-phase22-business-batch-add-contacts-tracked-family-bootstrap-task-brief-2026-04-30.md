# Task Brief

## 标题
- Post Phase 22：business batch-add-contacts tracked family bootstrap

## 背景
- `AI生成` 主链路当前 release readiness 已闭环的 tracked family 只有：
  - `business_create_list_verify`
  - `business_to_order`
  - `list_search_detail`
- post-Phase 22 已经证明“手册批量加入通讯录验收”在当前系统真实可跑，并且这条样本已经成为 real_click / draft dual-write 的 canonical 积样任务之一。
- 但这条链路仍停留在：
  - `recipe/template` 已存在
  - `priorityScenarioFamily=untracked`
  - launch decision / planning / scenario-card stabilizer / action library 不能把它作为稳定 family path 前置收口
- 用户当前要求继续提升 `AI生成` 主链路成功率，而不是转去做外部 document family；因此更直接的下一刀是把这条已跑通、高价值、当前系统内真实存在的任务升级成 tracked family。

## 本轮目标
- 新增 tracked family：`business_batch_add_contacts_verify`。
- 让“商机列表批量加入通讯录并最终在我的通讯录按手机号验收”的请求，进入稳定 family 路由，而不是继续作为 `untracked`。
- 把 family 接到：
  - priority family route
  - recipe family 归属
  - scenario-card stabilizer
  - action library capability 注入
  - execution / verifier family hints
  - playbook / project-recipe family normalization

## 验收标准
- [x] `resolveIntentE2EPriorityScenarioFamilyRoute(...)` 能把完整“批量加入通讯录 + 通讯录按手机号验收”语义收口到 `business_batch_add_contacts_verify`。
- [x] `business.batch-add-contacts` recipe 具备 family 归属，不再只是 untracked recipe。
- [x] planning / prompt / verifier policy 会注入这条 family 的固定骨架：
  - 先命中真实行
  - 再勾选
  - 再点击批量加入通讯录
  - 最终到我的通讯录按同一手机号验收
- [x] scenario-card normalization 会补：
  - `contactPhone / contactName`
  - “不要只看 toast”
  - “不要直接点第一条可见 checkbox”
  - “最终在我的通讯录按同一手机号检索命中”
- [x] action library 新增 `ui.click-antd-row-checkbox` capability，并可被 family 首屏注入。
- [x] 相关 unit tests / build / build:web / boundaries / docs / roadmap checks 通过。

## 范围
- 会改：
  - `lib/intent-e2e-priority-scenario-family.ts`
  - `lib/intent-action-library.ts`
  - `lib/test-generator.ts`
  - `lib/intent-execution-compiler.ts`
  - `lib/intent-execution-plan.ts`
  - `lib/intent-e2e-playbook.ts`
  - `lib/intent-project-recipe-registry.ts`
  - `lib/intent-recipe-registry.ts`
  - `lib/ai/scenario-card.ts`
  - `lib/ai/intent-e2e-insights.ts`
  - `components/IntentE2EWorkbench.tsx`
  - 对应 unit tests
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - release-readiness 已完成的 3 条 baseline 配置
  - benchmark harness / compare 口径
  - traffic-quality source 语义
  - 外部 document family / OCR 主链路

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：
  - `Phase 15-20` release readiness 已完成
  - `Phase 22` 真流量口径与 readiness 已完成
  - post-Phase 22 real_click current-system / dedupe / canonical seeding 已完成
- 对应小步：
  - 把已跑通但仍 `untracked` 的 current-system 高价值任务升级成 tracked family，以直接改善 `AI生成` 首轮路由和固定骨架命中率
- 本轮完成后准备回写到哪一条更新：
  - roadmap 最新一条 post-Phase 22 更新之后的新增更新

## 计划修改点
- 在 family route 中补 `business_batch_add_contacts_verify`
- 给该 family 增加 asset profile / verifier / readiness / label / rank
- 给 action library 补 `ui.click-antd-row-checkbox`
- 给 scenario-card 增加 batch-add-contacts stabilizer
- 给 recipe / playbook / project recipe normalization 补 family 白名单
- 补针对性的 unit tests

## 验证
- `npx vitest run tests/unit/intent-e2e-priority-scenario-family.spec.ts tests/unit/scenario-card.spec.ts tests/unit/test-generator.spec.ts tests/unit/intent-action-library.spec.ts tests/unit/intent-e2e-playbook.spec.ts`
- `npx vitest run tests/unit/intent-project-recipe-registry.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-execution-compiler.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check`

## 风险 / 未覆盖
- 本轮只把这条链路升级成 tracked family，还没有同时为它补 release-guard baseline / knowledge-hit guard / compare window。
- 这条链路最终能否进一步进入 release readiness，仍取决于后续 benchmark / guard 资产建设，不等于本轮已纳入 release readiness。
- 本轮没有扩 current-system document family，也没有提升 OCR 为这条 family 的主判定信号。

## 完成后动作
- 回写 roadmap
- 保持后续“手册批量加入通讯录验收” real_click 积样仍沿 current-system canonical 样本继续

## 追加切片：tracked corpus / guard 资产准备

### 背景
- 上一切片已完成 `business_batch_add_contacts_verify` 代码层 bootstrap，但它仍未具备 release-readiness family 的资产闭环。
- 当前可安全落地的是 repo-owned tracked request corpus 与 preflight test；release-guard baseline / knowledge-hit guard 只能在真实 rerun / freeze evidence 存在后接入。

### 本轮目标
- 为 `business_batch_add_contacts_verify` 增加可复用的 benchmark rerun 输入资产。
- 用单测固定该 corpus 会被路由到 `business_batch_add_contacts_verify`，避免后续回退到 `untracked`。
- 明确 knowledge-hit / release-guard 暂不接线的原因：没有真实通过的 benchmark / rerun evidence 时，提前配置 guard 只会制造引用缺失或伪 baseline。

### 本轮完成
- [x] 新增 tracked request corpus：
  - `artifacts/intent-e2e-family-evidence/proj_default.business-batch-add-contacts.request-corpus.json`
- [x] corpus 固化了该 family 的关键验收链：
  - 先定位带手机号真实商机行
  - 记录 `contactPhone / contactName / businessId`
  - 勾选同一行并点击顶部“批量加入通讯录”
  - 最终进入我的通讯录按同一手机号或同一联系人命中
  - toast 只作为中间反馈，不作为最终通过标准
- [x] `tests/unit/intent-e2e-benchmark.spec.ts` 增加 repo-owned corpus preflight，确认 `matchesExpectedFamily=true`。

### Guard 接线状态（corpus bootstrap 时）
- corpus bootstrap 当时暂不修改：
  - `artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit-guard.json`
  - `artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json`
- 原因：
  - knowledge-hit guard 需要真实 evidence 中出现 `business.batch-add-contacts`。
  - release-guard baseline 需要真实 benchmark / current-slice 文件，并满足最小 evidence run count。
  - 在 evidence 不存在时提前接线会让 guard 失败，且会把“候选 family”错误包装成“已 release-ready”。

### 追加切片：live evidence / guard 接线
- [x] 使用该 corpus 连续执行 3 次 `intent:benchmark:rerun`。
- [x] 3 次 fresh rerun 全部 `terminal passed`，且均命中：
  - `matchedRuleIds` 包含 `business.batch-add-contacts`
  - `matchedRecipeSlugs` 包含 `business.batch-add-contacts`
- [x] 新增 knowledge-hit guard evidence：
  - `artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit/business-batch-add-contacts-phase503-rerun.json`
- [x] 冻结新 family benchmark：
  - `artifacts/intent-e2e-family-evidence/proj_default.release-guard/benchmarks/2026-04-30T02-40-10-980Z-bench_6a39fe026233.json`
- [x] 声明 current slice：
  - `artifacts/intent-e2e-family-evidence/proj_default.release-guard/current-slices/2026-04-30T02-40-39-358Z-slice_e094152bcb49.json`
- [x] `business_batch_add_contacts_verify` 已加入 release-guard baseline。
- 注意：完整 release guard 当前仍失败，失败来自已有 `business_create_list_verify` 与 `list_search_detail` 当前窗口回归；新 family 自身 compare 为 `passed / improved`。

### 追加切片：cross-family release guard current window refresh
- [x] 复核完整 release guard 失败来源，确认不是新 family 接线问题：
  - `business_create_list_verify` 旧 current slice 包含一个 stale unknown 失败样本。
  - `list_search_detail` 旧 current slice 包含一个 stale data_missing 失败样本。
- [x] 对 `business_create_list_verify` 使用既有 corpus fresh rerun `3` 条，全部 terminal passed：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-30T02-50-49-062Z-family-business_create_list_verify-fresh-rerun.json`
- [x] 对 `list_search_detail` 使用既有 corpus fresh rerun `3` 条，全部 terminal passed：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-30T02-53-42-712Z-family-list_search_detail-fresh-rerun.json`
- [x] 刷新两个旧 family 的 release-guard current slice：
  - `artifacts/intent-e2e-family-evidence/proj_default.release-guard/current-slices/2026-04-30T02-54-12-133Z-slice_02a6ff878d1e.json`
  - `artifacts/intent-e2e-family-evidence/proj_default.release-guard/current-slices/2026-04-30T02-54-35-751Z-slice_e754d1b4f642.json`
- [x] 更新 `artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json`，只替换上述两个 stale `currentSlicePath`。
- [x] 完整 release guard 重新通过：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.release-guard-reports/2026-04-30T02-56-29-500Z-phase11-cross-family-release-guard.json`
  - `baselines=4 / passedBaselines=4 / failedBaselines=0`
  - 三条旧 family 均保持 terminal / first-pass `100 -> 100`
  - `business_batch_add_contacts_verify` 为 `improved`：terminal / first-pass `87.5 -> 100`，blocked `6.3 -> 0`
- [x] release-status 摘要读取最新 compare 后为 ready：
  - `status=ready / canRelease=true / familyCount=4 / readyFamilies=4`

### 最终状态
- `business_batch_add_contacts_verify` 现在已具备 tracked corpus、3 条 fresh live evidence、knowledge-hit guard evidence、release-guard benchmark / current-slice / baseline。
- 当前 release guard 已是 4-family green window；该结论只代表这 4 个已治理 family 的固定证据窗口，不代表开放式 `AI生成` 全量请求 100% 成功。
- 后续最高优先级仍是扩大新 family current evidence 到 5-10 条，并补 playbook-level 命中证据。

### 追加切片：playbook-level evidence closure
- [x] 新增项目级 playbook recipe：
  - `intent.business-batch-add-contacts`
  - `artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json`
- [x] `business_batch_add_contacts_verify` family profile 已优先偏好该 playbook slug：
  - `lib/intent-e2e-priority-scenario-family.ts`
- [x] recipe registry 单测覆盖项目级 playbook recipe 命中：
  - `tests/unit/intent-recipe-registry.spec.ts`
- [x] 使用新 recipe asset 连续执行 3 条 live rerun，全部 terminal passed 且 `playbookHitRuns=1`：
  - `artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit/business-batch-add-contacts-phase506-playbook-rerun-1.json`
  - `artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit/business-batch-add-contacts-phase506-playbook-rerun-2.json`
  - `artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit/business-batch-add-contacts-phase506-playbook-rerun-3.json`
- [x] 声明新的 playbook current slice：
  - `artifacts/intent-e2e-family-evidence/proj_default.release-guard/current-slices/2026-04-30T03-13-54-498Z-slice_0518e2b26c72.json`
- [x] 更新 release-guard baseline，使新 family 指向该 playbook current slice。
- [x] 更新 knowledge-hit guard evidence，使新 family 指向带 playbook 命中的 rerun。
- [x] 新 family compare 通过且 improved：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-30T03-14-40-485Z-bench_6a39fe026233-phase506-business-batch-add-contacts-playbook-current-2026-04-30.json`
  - terminal / first-pass `87.5 -> 100`
  - blocked `6.3 -> 0`
  - playbook-hit `75 -> 100`
- [x] 完整 4-family release guard 重新通过：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.release-guard-reports/2026-04-30T03-15-59-887Z-phase11-cross-family-release-guard.json`
  - `passedBaselines=4 / failedBaselines=0`
- [x] release-status 摘要保持 ready：
  - `status=ready / canRelease=true / familyCount=4 / readyFamilies=4`

### 最终状态（playbook closure 后）
- `business_batch_add_contacts_verify` 已具备 tracked corpus、项目级 playbook recipe、3 条 playbook-hit live current evidence、knowledge-hit guard、release-guard baseline 和 4-family green release status。
- 当前 guarded 结论仍只覆盖 4 个已治理 family；开放式自然语言 + 图片 / 文档类请求需要先定义真实流量分母和 family，再进入同样闭环。
- 后续最高优先级变为：把新 family playbook current window 从 3 条扩到 5-10 条，并保持 terminal / first-pass / playbook `95%+`。

### 追加切片：playbook 5-run current window top-up
- [x] 继续补 2 条 live rerun，全部 terminal passed 且 `playbookHitRuns=1`：
  - `artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit/business-batch-add-contacts-phase507-playbook-rerun-4.json`
  - `artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit/business-batch-add-contacts-phase507-playbook-rerun-5.json`
- [x] 同一个 playbook current slice 现在纳入 5 条 terminal runs：
  - `artifacts/intent-e2e-family-evidence/proj_default.release-guard/current-slices/2026-04-30T03-13-54-498Z-slice_0518e2b26c72.json`
- [x] 5-run compare 通过且 improved：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-30T03-22-00-668Z-bench_6a39fe026233-phase507-business-batch-add-contacts-playbook-5run-current-2026-04-30.json`
  - `currentRunCount=5`
  - terminal / first-pass / knowledge / recipe / playbook 均为 `100`
  - blocked 为 `0`
- [x] 完整 4-family release guard 重新通过：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.release-guard-reports/2026-04-30T03-23-22-414Z-phase11-cross-family-release-guard.json`
  - `passedBaselines=4 / failedBaselines=0`
- [x] release-status 继续 ready：
  - `status=ready / canRelease=true / familyCount=4 / readyFamilies=4`

### 最终状态（5-run top-up 后）
- `business_batch_add_contacts_verify` 已达到最低建议 5-run playbook current window。
- 该 family 当前 evidence window：terminal / first-pass / knowledge / recipe / playbook 均为 `100`。
- 后续不建议继续只堆同一 family；更高收益是从真实 `AI生成` 流量里选下一个 top family，重复同样闭环。
