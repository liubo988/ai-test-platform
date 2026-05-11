# Intent E2E Next Development Prep

## 目的

这份文档用于后续继续开发前的统一准备入口。它不替代 traffic-quality gate，也不授权在证据不足时开发 document / OCR / verifier 主链路。

当前最终交付摘要见 [intent-e2e-final-delivery-readiness-summary-2026-05-11.md](/Users/xiaolongbao/Workspace/ai-test/docs/intent-e2e-final-delivery-readiness-summary-2026-05-11.md)。后续默认进入观测状态，只有 next-development gate 暴露新的真实可开发缺口时才继续编码。

## 当前准入命令

先生成下一轮开发计划报表：

```bash
npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30
```

后续任何新开发切片开始前，先运行：

```bash
npm run intent:next-dev:check -- --project-uid proj_default --window-days 30
```

该命令等价于：

```bash
npm run intent:traffic-quality:development-ready -- --project-uid proj_default --window-days 30
```

只有命令返回 `0`，且 next-development plan 没有把候选判定为“已治理/已通过 guard”时，才允许进入下一轮代码开发。原始 traffic-quality `developmentGate.status` 为以下任一状态只是前置条件，不代表一定有新代码工作：

- `ready_for_document_family_governance`
- `ready_for_ungoverned_priority_family`

如果命令返回失败，不要新增 recipe / fixture / verifier / OCR 开发切片。

如果当前目标是评估一个全新业务意图是否适合直接 AI 生成，先运行：

```bash
npm run intent:new-intent:readiness -- --project-uid proj_default --input "<任务描述>" --target-url "<入口URL>" --json
```

该命令输出推荐模式、信心、缺失契约、失败补救类别和关键 signals；不传 `--input` 时扫描最近窗口的 traffic-quality `launch_click_count`，并按 `source=real_click|draft_import|benchmark_rerun|replay` 分离统计。它只用于新意图开跑前的风险判定，不替代 next-development gate，也不改变 release-readiness / traffic-quality 成功率口径。

如果 `new-intent readiness` 显示高频 `needs_fixture`，先运行：

```bash
npm run intent:fixture-bootstrap -- --project-uid proj_default --window-days 30
```

该命令只保留带 `fixtureBootstrap` 的 item，输出 setup / cleanup fixture ref、owner、idempotencyKey、required fields 与 recommended runtime governance。它是 fixture 契约草稿，不会自动创建或执行 repo-owned fixture 脚本。

如果下一步候选看起来是高频 `untracked` 或已治理的 `business_to_order`，先运行：

```bash
npm run intent:priority-triage -- --project-uid proj_default --windows 30,90,365
```

该命令只使用 `source=real_click` 的 traffic-quality JSONL 事件，并复用 latest traffic-quality / release governance 报表；它会把 `untracked` 拆成 `document_like / reroutable_priority_family / unknown_business_or_product`，并单独输出 `business_to_order` 的 terminal pass rate、release guard 与 knowledge-hit 状态。只有出现稳定重复的 `unknown_business_or_product`，或 `business_to_order` 的 pass-rate / governance 出现缺口时，才允许另起 priority family 治理切片。

`intent:next-dev:plan` 会写出：

- `reports/intent-e2e/projects/<projectUid>/intent-e2e.next-development-plan.latest.json`
- `reports/intent-e2e/projects/<projectUid>/intent-e2e.next-development-plan.latest.md`
- 同步刷新 latest traffic-quality JSON / Markdown 报表。

如果需要参考项目工作台“正式任务”中已经跑通的真实测试案例，先运行：

```bash
npm run intent:formal-task-seeds -- --project-uid proj_default
```

该命令会写出：

- `reports/intent-e2e/projects/<projectUid>/intent-e2e.formal-task-seed-audit.latest.json`
- `reports/intent-e2e/projects/<projectUid>/intent-e2e.formal-task-seed-audit.latest.md`

正式任务审计结果只作为 `formal_task_seed_only` 候选；除非后续重新通过 `launch-decision -> /api/intent-e2e/runs` 产生 `source=real_click` 事件，否则不能进入 traffic-quality 的真实点击成功率分母。

如果需要把正式任务 seed 重新发起为可计入 traffic-quality 的真实点击样本，运行：

```bash
npm run intent:formal-task-seed-runs -- --project-uid proj_default --priority-scenario-family <family>
```

该命令只用正式任务作为输入语义参考，实际请求仍重新走 `launch-decision -> /api/intent-e2e/runs`，且不携带 `intentDraftUid`，因此产出的 run 会进入 `source=real_click` 分母。输出路径：

- `reports/intent-e2e/projects/<projectUid>/intent-e2e.formal-task-real-click-seed-report.<timestamp>.json`
- `reports/intent-e2e/projects/<projectUid>/intent-e2e.formal-task-real-click-seed-report.<timestamp>.md`
- `reports/intent-e2e/projects/<projectUid>/intent-e2e.formal-task-real-click-seed-report.latest.json`
- `reports/intent-e2e/projects/<projectUid>/intent-e2e.formal-task-real-click-seed-report.latest.md`

如果只需要轻量确认当前窗口是否有 document-like `real_click`，运行：

```bash
npm run intent:document-sample:scout -- --project-uid proj_default --windows 30,90,365
```

该命令只读 traffic-quality JSONL 事件和 formal-task seed audit，不连接数据库。它不能替代完整 traffic-quality 报表，但可以快速回答“是否已经有 document-like real_click / formal seed 线索”。

如果需要执行当前系统 document-like 真实点击采集尝试，运行：

```bash
npm run intent:document-real-click:seed -- --project-uid proj_default --max-samples 1
```

该命令重新走 `launch-decision -> /api/intent-e2e/runs`，不携带 `intentDraftUid`。默认第一样本操作当前平台 `/projects/:projectUid?intentView=knowledge` 的真实知识文档 UI：打开需求编排工作台、进入知识文档、导入文档、预览并校验文档块正文锚点；它会以 `documentFamily=doc_create_reopen_verify` 进入 document family 治理候选。也可用 `--sample-id project-knowledge-document-search-open-preview` 采集知识目录打开、当前预览和搜索文档块正文锚点链路，对应 `documentFamily=doc_search_open_verify`；用 `--sample-id project-knowledge-document-edit-save-preview` 采集同名文档编辑保存、旧锚点无匹配和更新正文锚点链路，对应 `documentFamily=doc_edit_save_verify`；用 `--sample-id project-knowledge-document-archive-restore-preview` 采集归档、恢复和恢复后重新预览链路，对应 `documentFamily=doc_archive_restore_verify`；或用 `--sample-id project-knowledge-document-derive-capability-preview` 采集自动沉淀能力、能力目录和知识提炼状态链路，对应 `documentFamily=doc_derive_capability_verify`。需要有界扩样时追加 `--repeat <n>`。后续 document-assisted 业务样本仍会被标记为 `document_reference_only_business_flow`，不能作为 document family 候选。

如果需要复核 document family 第一刀 recipe / fixture / verifier 契约，运行：

```bash
npm run intent:document-family:governance -- --project-uid proj_default --require-ready
```

该命令默认读取 latest traffic-quality 的 `recommendedTopFamilies`，输出：

- `reports/intent-e2e/projects/<projectUid>/intent-e2e.document-family-governance.latest.json`
- `reports/intent-e2e/projects/<projectUid>/intent-e2e.document-family-governance.latest.md`

如果需要复核 document family 独立 guard baseline，运行：

```bash
npm run intent:document-family:guard -- --project-uid proj_default --require-passed
```

该命令会聚合 latest traffic-quality、document governance profile 和 document real-click seed reports，默认阈值为 `minRealClickSignals=3`、`minAdmissiblePassedRuns=3`，输出：

- `reports/intent-e2e/projects/<projectUid>/intent-e2e.document-family-release-guard.latest.json`
- `reports/intent-e2e/projects/<projectUid>/intent-e2e.document-family-release-guard.latest.md`

## Gate 结果处理

| developmentGate.status | 允许动作 | 禁止动作 |
| --- | --- | --- |
| `ready_for_document_family_governance` | 从 `documentFamilySelection.recommendedTopFamilies` 选择尚未 `contract_ready + release_guard=passed` 的 top-1/top-3 document family，另起治理切片 | 混入 benchmark / replay / draft_import 作为真实成功率分母，或重复治理已完成 document family |
| `ready_for_ungoverned_priority_family` | 从 `realClickPriorityFamilyCandidates` 选择 `governanceStatus != ready` 的真实 top family，另起非 document 治理切片 | 重复治理已 ready family |
| `blocked_on_real_click_readiness` | 只做真实点击样本采集或项目切换准备 | 冻结 baseline 或承诺真实成功率 |
| `blocked_on_document_real_click` | 收集真实 document-like `real_click` 或切换到有 document traffic 的 project | 凭空创建 document baseline |
| `no_admissible_code_work` | 停止开发，只保留验证与交接 | 继续改 document / OCR / verifier 主链路 |

## 后续切片必备证据

每个后续开发 brief 必须引用以下证据：

- traffic-quality JSON / Markdown report 路径。
- `developmentGate.status` 和 gate 命令输出。
- 若是 document family：
  - `documentFamilySelection.mode`
  - `recommendedTopFamilies`
  - 候选 examples 的 `source=real_click` 证据。
- 若是非 document priority family：
  - `realClickPriorityFamilyCandidates` 中对应 family 的 `launchClickCount / autoRunStartedCount / terminalRunCount / terminalPassRate`
  - `governanceStatus / releaseGuardStatus / knowledgeHitStatus`
- release status：
  - `npm run intent:release-status -- --require-current-compare --json`
- 当前验证基线：
  - `npm run build`
  - `npm run build:web`
  - 受影响 unit / integration / e2e
  - `bash scripts/check-boundaries.sh`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`

## 下一轮开发切片模板

使用模板：

- [intent-e2e-next-development-slice-brief-template-2026-05-07.md](/Users/xiaolongbao/Workspace/ai-test/docs/intent-e2e-next-development-slice-brief-template-2026-05-07.md)

切片标题建议：

- `Document family <family> recipe / fixture / verifier first cut`
- `Priority family <family> governance first cut`
- `Real-click sample collection for <family>`

## 固定非目标

- 不做 OCR-first。
- 不把 release window 的 benchmark 结果外推成所有 AI 生成成功率。
- 不把 `draft_import` 当作 `real_click`。
- 不把 replay / benchmark_rerun 混入真实点击分母。
- 不重复治理 `governanceStatus=ready` 的 family。
- 不使用跨系统样本污染当前系统真实流量。

## 当前项目状态

截至 2026-05-11 balanced document family signal real-click 采集后：

- 当前发布状态：ready。
- 当前 release-ready families：`5/5`。
- 当前最终交付状态：开发计划已完成，暂无新的可开发代码切片；后续只保留真实流量观测、报表刷新和 gate 复核。
- 当前 traffic-quality gate：`ready_for_document_family_governance`。
- 当前 next-development actionable gate：`developmentReady=false`、`decision=collect_document_real_click`，因为 latest recommended top-3 document 候选 `doc_archive_restore_verify / doc_search_open_verify / doc_create_reopen_verify` 都已 `contract_ready` 且独立 guard `passed`，当前没有新的未治理 document code work。
- 当前 next-development plan 已包含 `newIntentReadinessSnapshot`；当前 `total=100`、`directGenerate=99`、`needsFixture=0`、`realClickFixtureBootstrap=0`，用于证明新意图 fixture bootstrap 当前也没有 real-click 可开发缺口。后续若 `realClickFixtureBootstrap>0`，plan 会直接切到 `decision=start_new_intent_fixture_contract`。
- 当前 new-intent readiness：`launch-decision` route 已返回 `newIntentReadiness`，并可用 `npm run intent:new-intent:readiness -- --project-uid proj_default --window-days 30` 生成最近窗口风险报表；当前 30 天窗口 `total=100`，`mode={"direct_generate":99,"draft_only":1}`。该报表仅补充新意图开跑前判断，不改变发布或真实成功率分母；已 `contract_ready` 的 document family、known priority fixture family 和 `business_to_order` 不再被误计入 `fixture_contract`。
- 当前 fixture bootstrap：`npm run intent:fixture-bootstrap -- --project-uid proj_default --window-days 30` 可筛出最近窗口缺 fixture 契约的候选，并为每个 item 生成 setup / cleanup ref、owner、idempotencyKey 和 recommended runtime governance 草稿；当前为 `total=0`，`real_click` 无剩余 fixture bootstrap 候选。
- 当前 repo-owned fixture first cut：`fixture://project/proj_default/modal_or_drawer_save/setup` 与 `cleanup` 已落地，覆盖最近窗口最高频 `real_click` needs_fixture family 的服务分佣配置保存类样本；项目认证 / runtime governance 合并链路会对 `proj_default + 服务分佣配置 + modal_or_drawer_save` 窄匹配请求自动补这些 refs，脚本默认写本地 fixture state。远端恢复 adapter `fixture://project/proj_default/modal_or_drawer_save/remote-restore` 已落地，默认 contract-only；显式启用 `snapshot_restore` 且提供已登录 Playwright storage state 时才执行 UI 恢复。
- 当前 repo-owned fixture second cut：`fixture://project/proj_default/business_create_list_verify/setup` 与 `cleanup` 已落地，覆盖商机新建回列表验收类样本；项目认证 / runtime governance 合并链路会对 `proj_default + business_create_list_verify` 窄匹配请求自动补这些 refs，脚本默认写本地 fixture state 和清理线索，不执行远端商机删除。
- 当前 repo-owned fixture third cut：`fixture://project/proj_default/business_to_order/setup` 与 `cleanup` 已落地，覆盖商机创建后生成订单类样本；项目认证 / runtime governance 合并链路会对 `proj_default + business_to_order` 窄匹配请求自动补这些 refs，脚本默认写本地 fixture state 和清理线索，不执行远端订单删除或作废。
- 最新 traffic-quality：`real_click=122/147 (83.0%)`，`benchmark_rerun=455/627 (72.6%)`，`document_selection=post_instrumentation_real_click`，`recommendedTopFamilies=doc_archive_restore_verify,doc_search_open_verify,doc_create_reopen_verify`。
- 最新 priority traffic triage：
  - `npm run intent:priority-triage -- --project-uid proj_default --windows 30,90,365` 通过。
  - 报表路径：`reports/intent-e2e/projects/proj_default/intent-e2e.priority-traffic-triage.latest.json` 与 `reports/intent-e2e/projects/proj_default/intent-e2e.priority-traffic-triage.latest.md`。
  - `recommendation=no_actionable_priority_gap`。
  - 30 天 `untracked.launch_click_count=54`，其中 `document_like=40`、`reroutable_priority_family=14`、`unknown_business_or_product=0`。
  - `reroutable_priority_family` 当前全部可回填到 `business_batch_add_contacts_verify`。
  - 30 天 `business_to_order=10/10 terminal passed`，`terminalPassRate=100%`，`governance=ready`，`releaseGuard=passed`，`knowledgeHit=passed`。
  - 结论：当前不要从 `untracked` 或 `business_to_order` 强行拆新业务 fixture；等待新的真实 top failure signature，或继续采集新的 document-like `real_click`。
- 最新 document family governance：
  - `npm run intent:document-family:governance -- --project-uid proj_default --require-ready` 通过。
  - `doc_create_reopen_verify` 已标记 `contract_ready`：recipe=`document.project-knowledge-import-preview`，fixture=`project-knowledge-document-import-preview-v1`。
  - `doc_search_open_verify` 已标记 `contract_ready`：recipe=`document.project-knowledge-search-open-preview`，fixture=`project-knowledge-document-search-open-preview-v1`。
  - `doc_edit_save_verify` 已标记 `contract_ready`：recipe=`document.project-knowledge-edit-save-preview`，fixture=`project-knowledge-document-edit-save-preview-v1`。
  - `doc_archive_restore_verify` 已标记 `contract_ready`：recipe=`document.project-knowledge-archive-restore-preview`，fixture=`project-knowledge-document-archive-restore-preview-v1`。
  - `doc_derive_capability_verify` 已标记 `contract_ready`：recipe=`document.project-knowledge-derive-capability-preview`，fixture=`project-knowledge-document-derive-capability-preview-v1`。
  - verifier required evidence 覆盖导入后预览、知识目录打开、搜索文档块、同名文档编辑保存、旧锚点无匹配、归档恢复和恢复后正文锚点渲染。
- 最新 document family guard：
  - `npm run intent:document-family:guard -- --project-uid proj_default --require-passed` 通过。
  - `doc_archive_restore_verify`：`passed`。
  - `doc_search_open_verify`：`passed`。
  - `doc_create_reopen_verify`：`passed`。
  - `doc_edit_save_verify`：之前已通过独立 guard；当前 latest top-3 baseline 不再包含它。
  - `doc_derive_capability_verify`：之前已通过独立 guard；当前 latest top-3 baseline 不再包含它。
  - `real_click_signals=30`。
  - `admissible_passed_runs=22`。
  - 默认阈值：`minRealClickSignals=3`、`minAdmissiblePassedRuns=3`。
- 最新样本采集：
  - `mixed` 当前系统 real-click seed：`4/4` 通过。
  - `with_image` 当前系统 real-click seed：`1/1` 通过。
  - `modal_or_drawer_save` formal-task seed real-click：`12/12` 通过；其中 service commission 知识命中证据为 `3/3`、`knowledgeHitRate=100%`。
  - `business_create_list_verify` formal-task seed real-click：修复后 `3/3` 通过，追加 `商机222` 单样本复核 `1/1` 通过。
  - `project-knowledge-document-import-preview` 真实知识文档 UI seed：累计 `7/8` 通过，最新 top-up runIds=`intent-run-30f37597-aca0-423b-a6be-78dde63552d6`、`intent-run-10b7af7b-11da-4e11-8f3a-c14c1275cc74`，`admissibility=document_family_admissible`，`documentFamily=doc_create_reopen_verify`。一次失败已定位为工作台弹层打开同步不稳，并已在 deterministic 模板中补重试等待。
  - `project-knowledge-document-search-open-preview` 真实知识文档 UI seed：累计 `10/10` 通过，最新 top-up runIds=`intent-run-55f70f6f-0b7b-49ef-803a-0e904f57df93`、`intent-run-bf67576c-129d-4e33-be24-c17d229be4cf`，`documentFamily=doc_search_open_verify`。
  - `project-knowledge-document-edit-save-preview` 真实知识文档 UI seed：本轮修复本地 Next dev server 陈旧 DB 连接池后 `3/3` 通过，runIds=`intent-run-b707f239-e6cc-47fa-8ea3-22309700470d`、`intent-run-62d8bca2-ee79-44ed-9285-c650d290d7cb`、`intent-run-a483413a-4590-4535-8c93-7735d7713ab6`；追加单样本通过，runId=`intent-run-24eb8f73-d6d7-4ef1-a356-876cc3a59ea5`；2026-05-11 underrepresented top-up `3/3` 通过，runIds=`intent-run-adcbec77-e681-4f64-811a-02e44be2211c`、`intent-run-3f128221-38c9-4082-8ef9-1dc49bab5c56`、`intent-run-6f3e992b-2e0d-4f6d-84de-272c893b2093`，`documentFamily=doc_edit_save_verify`。修复前 3 条失败样本保留为真实 `real_click` 信号，不计入 admissible passed runs。
  - `project-knowledge-document-archive-restore-preview` 真实知识文档 UI seed：修正 confirm 自动确认和 aria-label 定位后 `3/3` 通过，runIds=`intent-run-f50ff588-84d4-433c-aa6b-bfa2d50ff8b4`、`intent-run-0716b3cd-6c07-4383-9189-175a96b376c6`、`intent-run-ab435e59-10cb-470f-a9fc-34b965c2c0b7`；最新 top-up runId=`intent-run-a1d20c73-d23e-4b16-a565-b35b2e0679f3`，`documentFamily=doc_archive_restore_verify`。修复前 6 条失败样本保留为真实 `real_click` 信号，不计入 admissible passed runs。
  - `project-knowledge-document-derive-capability-preview` 真实知识文档 UI seed：`10/10` 通过，历史 runIds=`intent-run-d09a3c57-66f4-4987-9d96-574a44f32ff3`、`intent-run-c6562a87-d793-4cbf-ada7-d0946810e889`、`intent-run-ed627ba5-8303-441f-913b-7bc44fb8687c`、`intent-run-c624d00f-c158-47c4-ae8a-ea7afe5fe850`、`intent-run-116a9a2e-197d-46bd-92b2-a6d9acf9f460`、`intent-run-84af8a04-fc60-476f-8465-17152471921f`、`intent-run-d35ee4ec-5ede-4639-8621-94d10f7641c2`；2026-05-11 underrepresented top-up runIds=`intent-run-df49ffde-9cad-49ac-b941-e4a1e41d0109`、`intent-run-7cae380d-c573-409e-be1d-3d77c9c1559a`、`intent-run-e531e818-76c0-42f0-8b02-c52557918bc1`，`documentFamily=doc_derive_capability_verify`。
  - `document-assisted` real-click seed：`1/1` 通过，runId=`intent-run-c9c21395-6e2f-4263-a3b3-01004b817647`；另一次数据依赖型批量加入通讯录样本因“目标页面当前未返回可用数据”失败，未作为成功样本使用。
- 最新 formal-task seed audit：
  - `formal_tasks=24`
  - `seed_eligible=24`
  - `document_like=0`
  - `source_policy=formal_task_seed_only`
- 最新 document sample scout：
  - `30d: 50/140`
  - `90d: 50/140`
  - `365d: 50/140`
  - `doc_archive_restore_verify=10`
  - `doc_create_reopen_verify=10`
  - `doc_derive_capability_verify=10`
  - `doc_edit_save_verify=10`
  - `doc_search_open_verify=10`
  - `formal_document_like=0`
  - `recommendation=ready_with_document_real_click`
- `商机222` 已确认根因并修复：正式任务文案使用“新建商机”，旧检测只覆盖“创建商机/新增商机”，导致未复用 create-business 确定性模板而退回 modal/drawer 通用路径；现在已把“新建商机”纳入 business-create detector，并复用已验证的 create-business list verification 模板。
- 当前最终交付摘要：[intent-e2e-final-delivery-readiness-summary-2026-05-11.md](/Users/xiaolongbao/Workspace/ai-test/docs/intent-e2e-final-delivery-readiness-summary-2026-05-11.md)。
- 当前 handoff：[intent-e2e-current-development-closure-handoff-2026-05-07.md](/Users/xiaolongbao/Workspace/ai-test/docs/intent-e2e-current-development-closure-handoff-2026-05-07.md)。
