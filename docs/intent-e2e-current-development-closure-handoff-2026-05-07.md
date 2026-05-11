# Intent E2E Current Development Closure Handoff

## 结论

- 当前开发计划内的 release-readiness 与 traffic-quality 收口已完成。
- 当前项目 `proj_default` 的发布状态为 `ready`，traffic-quality 原始门禁仍为 `ready_for_document_family_governance`。
- `doc_create_reopen_verify`、`doc_search_open_verify`、`doc_edit_save_verify`、`doc_archive_restore_verify` 与 `doc_derive_capability_verify` 的 document family recipe / fixture / verifier 已完成；latest recommended top-3 的 independent guard 已通过。next-development 现在会阻断重复治理已完成 family，当前可执行动作是继续采集新的 document-like `source=real_click`，不应做 OCR-first。
- 最终交付摘要已沉淀到 [intent-e2e-final-delivery-readiness-summary-2026-05-11.md](/Users/xiaolongbao/Workspace/ai-test/docs/intent-e2e-final-delivery-readiness-summary-2026-05-11.md)：当前没有新的可开发代码切片，后续只在真实观测信号触发时再进入开发。
- 新意图 readiness 第一刀已接入 launch-decision：AI 生成按钮会返回 `newIntentReadiness`，traffic-quality metadata 会记录同一摘要，并可通过 `npm run intent:new-intent:readiness` 生成最近窗口风险报表。该能力只补充新意图开跑前的缺口与补救判断，不改变 release-readiness 或 traffic-quality 成功率口径。
- `needs_fixture` bootstrap 第一刀已完成：带 `fixture_contract` 缺口的 readiness item 会附带 `fixtureBootstrap` 草稿，可通过 `npm run intent:fixture-bootstrap` 筛出最近窗口候选；该入口只生成契约草稿，不自动执行 fixture 脚本。
- `modal_or_drawer_save` repo-owned fixture 第一刀已完成：`fixture://project/proj_default/modal_or_drawer_save/setup` 与 `cleanup` 能被 executor 真实执行，并为服务分佣配置保存类样本写入本地 fixture state；项目认证 / runtime governance 合并链路会对 `proj_default + 服务分佣配置 + modal_or_drawer_save` 窄匹配请求自动补这些 refs。服务分佣配置远端恢复 adapter `fixture://project/proj_default/modal_or_drawer_save/remote-restore` 已落地，默认 contract-only 不碰远端；显式 `snapshot_restore + INTENT_E2E_FIXTURE_STORAGE_STATE` 时 setup 快照原比例、cleanup 通过 UI 恢复。
- `business_create_list_verify` repo-owned fixture 第二刀已完成：`fixture://project/proj_default/business_create_list_verify/setup` 与 `cleanup` 能被 executor 真实执行，并为“商机列表新建商机 -> 我创建的列表回查 -> 新入库”类样本写入唯一数据契约；项目认证 / runtime governance 合并链路会对 `proj_default + business_create_list_verify` 窄匹配请求自动补这些 refs。cleanup 当前只记录清理线索，不自动删除或作废远端商机。
- `business_to_order` repo-owned fixture 第三刀已完成：`fixture://project/proj_default/business_to_order/setup` 与 `cleanup` 能被 executor 真实执行，并为“创建商机 -> 目标行生成订单 -> createOrder 主断言”类样本写入唯一数据契约；项目认证 / runtime governance 合并链路会对 `proj_default + business_to_order` 窄匹配请求自动补这些 refs。cleanup 当前只记录 businessId/orderId/contactPhone/contactName 等清理线索，不自动删除或作废远端订单。
- priority traffic triage 第一刀已完成：`npm run intent:priority-triage -- --project-uid proj_default --windows 30,90,365` 会把 `source=real_click` 的 `untracked` 拆成 document-like、可回填 priority family 和未知业务/产品缺口，并单独复核 `business_to_order` 的 latest terminal pass rate 与 governance。当前 30 天窗口结论为 `no_actionable_priority_gap`，没有新的 priority family / fixture 治理切片。

## 当前可发布范围

- release-ready families：
  - `business_batch_add_contacts_verify`
  - `business_create_list_verify`
  - `business_to_order`
  - `list_search_detail`
  - `modal_or_drawer_save`
- 发布证据：
  - release guard preflight 通过。
  - release guard compare 通过，`5/5` baseline passed。
  - knowledge-hit guard 通过，`5/5` evidence passed。
  - release status with current compare 为 `ready`，`canRelease=true`。
  - release summary 完整模式为 `status=ready canRelease=yes checks=3/3 families=5/5`。

## 当前 traffic-quality 准入与 next-development 结论

- `npm run intent:traffic-quality:development-ready -- --project-uid proj_default --window-days 30` 当前通过。
- 最新 30 天 traffic-quality（2026-05-11 document balanced family signal 追加补样后刷新）：
  - `real_click=122/147 (83.0%)`
  - `benchmark_rerun=455/627 (72.6%)`
  - `document_selection=post_instrumentation_real_click`
  - `recommendedTopFamilies=doc_archive_restore_verify,doc_search_open_verify,doc_create_reopen_verify`
  - `development_gate=ready_for_document_family_governance`
- 准入原因：
  - 最近窗口已有真实 document-like `source=real_click` 请求。
  - real_click readiness 已达标，候选 family 来自 post-instrumentation real_click，不混入 benchmark / replay / draft_import。
- next-development 最新结论：
  - `developmentReady=false`
  - `decision=collect_document_real_click`
  - `eligibleFamilies=[]`
  - 原因：latest recommended top-3 document 候选 `doc_archive_restore_verify / doc_search_open_verify / doc_create_reopen_verify` 均已 `contract_ready` 且独立 guard `passed`，当前没有新的未治理 document code work。
- priority traffic triage 最新结论：
  - `recommendation=no_actionable_priority_gap`
  - 30 天 `untracked.launch_click_count=54`，其中 `document_like=40`、`reroutable_priority_family=14`、`unknown_business_or_product=0`。
  - `reroutable_priority_family` 当前全部可回填到 `business_batch_add_contacts_verify`。
  - 30 天 `business_to_order=10/10 terminal passed`，`terminalPassRate=100%`，`governance=ready`，`releaseGuard=passed`，`knowledgeHit=passed`。
  - 结论：`untracked` 和 `business_to_order` 目前不是新的可开发缺口；继续等待新的真实 top failure signature，或继续采集新的 document-like `real_click`。

## 本轮样本采集补充

- 当前系统 scope：`uat-service.yikaiye.com`。
- `mixed` real-click seed：`4/4` 通过。
- `with_image` real-click seed：`1/1` 通过。
- 采样暴露并已修复：
  - `business_create_list_verify` 复用成功脚本时，页面已返回商机列表但旧 submit 槽位误判失败。
  - `business_batch_add_contacts_verify` 在商机列表残留筛选为空时，模板未先清空筛选导致没有可勾选行。
- 早前业务样本采样后 next-development plan 仍为 `no_admissible_code_work`；追加真实知识文档 UI 样本后，next-development gate 已变为 `ready_for_document_family_governance`。
- 2026-05-08 追加 document-assisted real-click 采集：
  - 稳定样本 `document-assisted-business-create-list-verify` 通过，runId=`intent-run-c9c21395-6e2f-4263-a3b3-01004b817647`。
  - 数据依赖型 `document-assisted-business-batch-add-contacts` 真实执行失败，原因是“页面前置检查失败: 目标页面当前未返回可用数据”。
  - 两类样本都属于“参考知识文档执行业务流”，不是真实文档页面操作；traffic-quality classifier 已防止其进入 document family selection。
- 2026-05-08 追加真实知识文档 UI real-click 采集：
  - 样本 `project-knowledge-document-import-preview` 通过，runId=`intent-run-bfbe8058-e8f3-45b4-bd0b-fa08c916f366`。
  - 追加补样再次通过，runId=`intent-run-5b11cad5-d987-4da1-9ce7-bd055832d4db`。
  - 使用 `--repeat 3` 做有界扩样时，前两次通过，runIds=`intent-run-910f45eb-6d15-4786-97aa-2befd8624096`、`intent-run-b3012d38-9d9d-44c6-8a4a-a6c00b06a341`；第三次 `intent-run-86409b32-6477-4b8a-8368-4ab2f9092a78` 暴露“需求编排工作台”弹层打开同步不稳。
  - 已修复 deterministic 模板：点击“需求编排”后按工作台 heading 精准定位弹层并最多重试 3 次，避免只取最后一个固定层导致偶发等待失败。
  - 修复后复跑通过，runId=`intent-run-a32f8a2d-5123-4875-a3cb-80a9f56af476`。
  - 样本打开 `/projects/proj_default?intentView=knowledge`，通过 UI 执行“导入知识文档 -> 当前预览 -> 文档块正文锚点校验”。
  - 报表结果为 `admissibility=document_family_admissible`、`documentFamily=doc_create_reopen_verify`，已进入 document family selection。
- 2026-05-09 追加真实知识文档 UI 编辑保存 real-click 采集：
  - 初次 `--repeat 3` 暴露本地 `3666` Next dev server DB 连接池陈旧，API 返回 `read ETIMEDOUT`；直连 MySQL 正常，重启本地 dev server 后恢复。
  - 修复后 `project-knowledge-document-edit-save-preview` 通过 `3/3`，runIds=`intent-run-b707f239-e6cc-47fa-8ea3-22309700470d`、`intent-run-62d8bca2-ee79-44ed-9285-c650d290d7cb`、`intent-run-a483413a-4590-4535-8c93-7735d7713ab6`。
  - 样本打开 `/projects/proj_default?intentView=knowledge`，通过 UI 执行“已有知识文档预览 -> 同名文档编辑保存 -> 旧锚点无匹配 -> 更新锚点可见”。
  - 报表结果为 `admissibility=document_family_admissible`、`documentFamily=doc_edit_save_verify`，已进入 document family selection；修复前失败样本保留为真实信号，不计入 admissible passed runs。
  - 继续执行 `project-knowledge-document-edit-save-preview` 单样本补充采集通过，runId=`intent-run-24eb8f73-d6d7-4ef1-a356-876cc3a59ea5`；刷新后 `doc_edit_save_verify` 进入 latest recommended top-3，独立 document-family guard `passed`。
- 2026-05-09 追加真实知识文档 UI 搜索打开 real-click 采集：
  - 执行 `project-knowledge-document-search-open-preview --repeat 5` 通过 `5/5`，runIds=`intent-run-349b92f1-2b99-459c-a5f4-b4f114b05382`、`intent-run-6d35a855-0347-42bb-b57e-0533a80f4b0c`、`intent-run-df916941-f650-4b26-b8db-abfc812b4458`、`intent-run-d3e14859-6f99-4b08-a4b8-45ea1c4068a2`、`intent-run-33d70d86-cc2e-46e7-a360-28d0ee0c6ada`。
  - 样本打开 `/projects/proj_default?intentView=knowledge`，通过 UI 执行“知识目录打开文档 -> 搜索文档块正文锚点 -> 当前预览和正文锚点校验”。
  - 刷新后 `doc_search_open_verify` 进入 latest recommended top-3，独立 document-family guard `passed`。
- 2026-05-09 追加真实知识文档 UI 归档恢复 real-click 采集：
  - 初次模板暴露两个真实 UI 自动化问题：原生 confirm 不能稳定通过 `page.waitForEvent('dialog')` 捕获，且归档/恢复按钮的 role name 来自 `aria-label`，不是可见短文本。
  - 修复为页面级 `window.confirm = () => true` 自动确认，并按 `归档知识文档 <name>` / `恢复知识文档 <name>` 的可访问名称定位按钮。
  - 修复后 `project-knowledge-document-archive-restore-preview` 通过 `3/3`，runIds=`intent-run-f50ff588-84d4-433c-aa6b-bfa2d50ff8b4`、`intent-run-0716b3cd-6c07-4383-9189-175a96b376c6`、`intent-run-ab435e59-10cb-470f-a9fc-34b965c2c0b7`。
  - 样本打开 `/projects/proj_default?intentView=knowledge`，通过 UI 执行“已有知识文档预览 -> 归档 -> 已归档状态 -> 恢复 -> 恢复后重新预览正文锚点”。
  - 报表结果为 `admissibility=document_family_admissible`、`documentFamily=doc_archive_restore_verify`，已进入 document family selection；修复前失败样本保留为真实信号，不计入 admissible passed runs。
- 2026-05-11 追加 underrepresented document family real-click 采集：
  - `project-knowledge-document-edit-save-preview --repeat 3` 通过 `3/3`，runIds=`intent-run-adcbec77-e681-4f64-811a-02e44be2211c`、`intent-run-3f128221-38c9-4082-8ef9-1dc49bab5c56`、`intent-run-6f3e992b-2e0d-4f6d-84de-272c893b2093`，均为 `document_family_admissible`。
  - `project-knowledge-document-derive-capability-preview --repeat 3` 通过 `3/3`，runIds=`intent-run-df49ffde-9cad-49ac-b941-e4a1e41d0109`、`intent-run-7cae380d-c573-409e-be1d-3d77c9c1559a`、`intent-run-e531e818-76c0-42f0-8b02-c52557918bc1`，均为 `document_family_admissible`。
  - 刷新后 `real_click=117/142 (82.4%)`，latest recommended top-3 变为 `doc_derive_capability_verify / doc_edit_save_verify / doc_archive_restore_verify`，三者均 `contract_ready + release_guard=passed`。
- 2026-05-11 追加 balanced document family signal real-click 采集：
  - `project-knowledge-document-import-preview --repeat 2` 通过 `2/2`，runIds=`intent-run-30f37597-aca0-423b-a6be-78dde63552d6`、`intent-run-10b7af7b-11da-4e11-8f3a-c14c1275cc74`，均为 `document_family_admissible`。
  - `project-knowledge-document-search-open-preview --repeat 2` 通过 `2/2`，runIds=`intent-run-55f70f6f-0b7b-49ef-803a-0e904f57df93`、`intent-run-bf67576c-129d-4e33-be24-c17d229be4cf`，均为 `document_family_admissible`。
  - `project-knowledge-document-archive-restore-preview --repeat 1` 通过 `1/1`，runId=`intent-run-a1d20c73-d23e-4b16-a565-b35b2e0679f3`，为 `document_family_admissible`。
  - 刷新后 `real_click=122/147 (83.0%)`，五个已治理 document family 在 document sample scout 中均达到 `10` 条真实信号。

## Document family 第一刀

- `doc_create_reopen_verify` 已固化 `contract_ready` governance profile。
- recipe：`document.project-knowledge-import-preview`，仅匹配当前平台 `/projects/:projectUid?intentView=knowledge` 与知识文档导入/预览信号。
- fixture：`project-knowledge-document-import-preview-v1`，每次运行使用唯一知识文档名称和正文锚点。
- `doc_search_open_verify` 已固化 `contract_ready` governance profile。
- recipe：`document.project-knowledge-search-open-preview`，仅匹配当前平台知识目录打开文档、当前预览和搜索文档块信号。
- fixture：`project-knowledge-document-search-open-preview-v1`，每次运行使用 fixture setup 准备唯一知识文档，再通过 UI 打开预览和搜索正文锚点。
- `doc_edit_save_verify` 已固化 `contract_ready` governance profile。
- recipe：`document.project-knowledge-edit-save-preview`，仅匹配当前平台同名知识文档编辑保存、当前预览和更新正文锚点信号。
- fixture：`project-knowledge-document-edit-save-preview-v1`，每次运行使用 fixture setup 准备唯一已有知识文档，再通过 UI 覆写保存并校验旧锚点无匹配、更新锚点可见。
- `doc_archive_restore_verify` 已固化 `contract_ready` governance profile。
- recipe：`document.project-knowledge-archive-restore-preview`，仅匹配当前平台知识文档归档、恢复和恢复后预览信号。
- fixture：`project-knowledge-document-archive-restore-preview-v1`，每次运行使用 fixture setup 准备唯一已有知识文档，再通过 UI 归档恢复并校验恢复后预览正文锚点。
- verifier required evidence：
  - `knowledge_import_notice`
  - `current_preview_document_name`
  - `original_document_chunk_body_anchor`
  - `old_anchor_no_match_after_save`
  - `archive_notice`
  - `archived_status_badge`
  - `restore_notice`
  - `restored_document_chunk_body_anchor`
  - `document_chunk_body_anchor`
- 明确禁止：
  - 只断言 textarea 原文。
  - 把 reference-only 业务流作为 document family 证据。
  - 混用 `benchmark_rerun / replay / draft_import` 作为真实点击分母。
  - 进入 OCR-first 或外部文档系统治理。
- 新增复核入口：
  - `npm run intent:document-family:governance -- --project-uid proj_default --require-ready`
  - `npm run intent:document-family:guard -- --project-uid proj_default --require-passed`
- 独立 guard 最新结果：
  - `passed=yes`
  - `baselines=3`
  - `passedBaselines=3`
  - `real_click_signals=30`
  - `admissible_passed_runs=22`
  - 默认阈值：`minRealClickSignals=3`、`minAdmissiblePassedRuns=3`
  - 该 guard 不接入既有 priority family release-readiness `5/5` summary。

## 正式任务参考补充

- `npm run intent:formal-task-seeds -- --project-uid proj_default` 已生成正式任务 seed audit。
- 当前项目 active 正式任务：`24`。
- 当前系统 scope 内且有 passed 执行证据的 seed 候选：`24`。
- document-like 正式任务候选：`0`。
- 这些正式任务可以作为后续 real-click seed/reference corpus；但正式任务执行历史本身不能直接计入 traffic-quality `source=real_click` 分母。
- `npm run intent:formal-task-seed-runs -- --project-uid proj_default --priority-scenario-family <family>` 可把正式任务 seed 重新走 `launch-decision -> /api/intent-e2e/runs`，产出 `source=real_click` 样本。
- 已完成 formal-task seed 转 real-click：
  - `modal_or_drawer_save`：`12/12` 通过；补充 service commission 知识命中证据 `3/3`，已接入 release guard 与 knowledge-hit guard。
  - `business_create_list_verify`：发现并修复 `商机222` 的“新建商机”检测缺口后，`3/3` 通过，追加 `商机222` 单样本 `1/1` 通过。

## 商机222 根因与修复

- 失败根因：正式任务 `商机222` 的语义是“新建商机”，旧 `business_create_list_verify` detector 只识别“创建商机 / 新增商机 / createbusiness”，没有命中“新建商机”。
- 失败表现：未走已验证的 create-business list verification 确定性模板，而退回通用 ExecutionPlan 路径；该路径期待从商机列表打开可见 Modal/Drawer，于是报错“新建商机表单未出现可见 Modal/Drawer 容器”。
- 修复内容：将“新建商机”纳入 business-create detector，并新增 create-business list verification 模板复用入口，避免纯新建商机场景误走订单生成或 modal/drawer 通用路径。
- 复核结果：修复后 `商机222` 已通过 `intent-run-702414b3-aaaa-4bb7-8130-99f7db872c8d` 与追加单样本 `intent-run-92bb3f5d-a184-48f2-af20-8885d15bbaa2`。

## 本轮最终验证

- `npm run build` 通过。
- `npm run build:web` 通过。
- `npx vitest run tests/unit/intent-action-dsl.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-execution-plan.spec.ts tests/unit/intent-e2e-document-family-governance.spec.ts tests/unit/intent-e2e-next-development-plan.spec.ts tests/unit/test-generator.spec.ts` 通过，`6` files / `250` tests。
- `npx vitest run tests/unit/intent-e2e-document-family-release-guard.spec.ts tests/unit/intent-e2e-document-family-governance.spec.ts tests/unit/intent-e2e-next-development-plan.spec.ts tests/unit/intent-action-dsl.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-execution-plan.spec.ts tests/unit/test-generator.spec.ts` 通过，`7` files / `255` tests。
- `npx vitest run tests/unit/intent-e2e-formal-task-seed-audit.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-project-knowledge.spec.ts tests/unit/test-generator.spec.ts` 通过，`5` files / `242` tests。
- `npm run intent:release-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json --json` 通过，`baselineCount=5`、`passedBaselines=5`。
- `npm run intent:release-guard:preflight` 通过。
- `npm run intent:knowledge-hit-guard -- --json` 通过，`evidenceCount=5`、`passedEvidences=5`。
- `npm run intent:release-status -- --require-current-compare --json` 通过，`status=ready`、`families=5/5`。
- `npm run intent:release-summary` 通过，`status=ready canRelease=yes checks=3/3 families=5/5`。
- `npm run intent:formal-task-seeds -- --project-uid proj_default` 通过，`formal_tasks=24 seed_eligible=24 document_like=0`。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --max-samples 1 --poll-interval-ms 3000` 通过，`1/1` passed，`admissibleDocumentSamples=1`，runId=`intent-run-bfbe8058-e8f3-45b4-bd0b-fa08c916f366`。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --max-samples 1 --poll-interval-ms 3000` 追加补样通过，`1/1` passed，runId=`intent-run-5b11cad5-d987-4da1-9ce7-bd055832d4db`。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --max-samples 1 --repeat 3 --poll-interval-ms 3000` 执行有界扩样，`2/3` passed、`1/3` failed；失败根因为工作台弹层打开等待不稳，已在模板中修复。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --max-samples 1 --repeat 1 --poll-interval-ms 3000` 修复后复跑通过，`1/1` passed，runId=`intent-run-a32f8a2d-5123-4875-a3cb-80a9f56af476`。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-search-open-preview --max-samples 1 --poll-interval-ms 3000` 通过，`1/1` passed，runId=`intent-run-6e56fb50-b15c-4dee-90fd-101b4d8a0011`。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-search-open-preview --max-samples 1 --repeat 2 --poll-interval-ms 3000` 通过，`2/2` passed，runIds=`intent-run-07be9964-4e3f-410b-8cec-a7fd2efd4cd2`、`intent-run-8cc08e8c-e706-4025-b40a-a5ad4e450e11`。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-edit-save-preview --max-samples 1 --repeat 3 --poll-interval-ms 3000` 初次运行 `0/3` passed，失败原因为本地 dev server DB 连接池 `read ETIMEDOUT`；直连 DB 正常，重启 dev server 后恢复。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-edit-save-preview --max-samples 1 --repeat 3 --poll-interval-ms 3000` 修复后通过，`3/3` passed，runIds=`intent-run-b707f239-e6cc-47fa-8ea3-22309700470d`、`intent-run-62d8bca2-ee79-44ed-9285-c650d290d7cb`、`intent-run-a483413a-4590-4535-8c93-7735d7713ab6`。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-archive-restore-preview --max-samples 1 --repeat 3 --poll-interval-ms 3000` 修复后通过，`3/3` passed，runIds=`intent-run-f50ff588-84d4-433c-aa6b-bfa2d50ff8b4`、`intent-run-0716b3cd-6c07-4383-9189-175a96b376c6`、`intent-run-ab435e59-10cb-470f-a9fc-34b965c2c0b7`。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-derive-capability-preview --max-samples 1 --repeat 3 --poll-interval-ms 3000` 通过，`3/3` passed，runIds=`intent-run-d09a3c57-66f4-4987-9d96-574a44f32ff3`、`intent-run-c6562a87-d793-4cbf-ada7-d0946810e889`、`intent-run-ed627ba5-8303-441f-913b-7bc44fb8687c`。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-derive-capability-preview --max-samples 1 --repeat 4 --poll-interval-ms 3000` 追加扩样通过，`4/4` passed，runIds=`intent-run-c624d00f-c158-47c4-ae8a-ea7afe5fe850`、`intent-run-116a9a2e-197d-46bd-92b2-a6d9acf9f460`、`intent-run-84af8a04-fc60-476f-8465-17152471921f`、`intent-run-d35ee4ec-5ede-4639-8621-94d10f7641c2`。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-edit-save-preview --max-samples 1 --repeat 3 --wait-timeout-ms 720000 --poll-interval-ms 5000` 追加扩样通过，`3/3` passed，runIds=`intent-run-adcbec77-e681-4f64-811a-02e44be2211c`、`intent-run-3f128221-38c9-4082-8ef9-1dc49bab5c56`、`intent-run-6f3e992b-2e0d-4f6d-84de-272c893b2093`。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-derive-capability-preview --max-samples 1 --repeat 3 --wait-timeout-ms 720000 --poll-interval-ms 5000` 追加扩样通过，`3/3` passed，runIds=`intent-run-df49ffde-9cad-49ac-b941-e4a1e41d0109`、`intent-run-7cae380d-c573-409e-be1d-3d77c9c1559a`、`intent-run-e531e818-76c0-42f0-8b02-c52557918bc1`。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-import-preview --max-samples 1 --repeat 2 --wait-timeout-ms 720000 --poll-interval-ms 5000` 追加扩样通过，`2/2` passed，runIds=`intent-run-30f37597-aca0-423b-a6be-78dde63552d6`、`intent-run-10b7af7b-11da-4e11-8f3a-c14c1275cc74`。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-search-open-preview --max-samples 1 --repeat 2 --wait-timeout-ms 720000 --poll-interval-ms 5000` 追加扩样通过，`2/2` passed，runIds=`intent-run-55f70f6f-0b7b-49ef-803a-0e904f57df93`、`intent-run-bf67576c-129d-4e33-be24-c17d229be4cf`。
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-archive-restore-preview --max-samples 1 --repeat 1 --wait-timeout-ms 720000 --poll-interval-ms 5000` 追加扩样通过，`1/1` passed，runId=`intent-run-a1d20c73-d23e-4b16-a565-b35b2e0679f3`。
- `npm run intent:document-sample:scout -- --project-uid proj_default --windows 30,90,365` 通过，`recommendation=ready_with_document_real_click windows=30d:50/140 90d:50/140 365d:50/140 formal_document_like=0`，五个已治理 document family 均为 `10` 条真实信号。
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30` 通过，`real_click=122/147 (83.0%)`、`benchmark_rerun=455/627 (72.6%)`、`document_selection=post_instrumentation_real_click`、`recommendedTopFamilies=doc_archive_restore_verify,doc_search_open_verify,doc_create_reopen_verify`。
- `npm run intent:new-intent:readiness -- --project-uid proj_default --input "登录后用手机号 13800001111 搜索商机，进入详情并校验状态字段可见" --target-url "https://uat-service.yikaiye.com/#/business/businesslist" --json` 可生成单意图 readiness JSON / Markdown。
- `npm run intent:new-intent:readiness -- --project-uid proj_default --window-days 30` 通过，`total=100`，`mode={"direct_generate":99,"draft_only":1}`；已 `contract_ready` 的 document family、known priority fixture family 和 `business_to_order` 不再被误计入 `fixture_contract`。
- `npm run intent:fixture-bootstrap -- --project-uid proj_default --window-days 30` 通过，当前 `total=0`，`real_click` 无剩余 fixture bootstrap 候选。
- `npm run intent:priority-triage -- --project-uid proj_default --windows 30,90,365` 通过，`recommendation=no_actionable_priority_gap`，30 天 `untracked=54`、`document_like=40`、`reroutable_priority=14`、`unknown_business=0`、`business_to_order=10/10 (100%)`。
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30` 通过，plan 已包含 `newIntentReadinessSnapshot`，当前 `total=100`、`directGenerate=99`、`needsFixture=0`、`realClickFixtureBootstrap=0`；后续若 `realClickFixtureBootstrap>0`，next-development 会切换为 `decision=start_new_intent_fixture_contract`。
- `npx vitest run tests/unit/intent-e2e-priority-traffic-triage.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-e2e-document-sample-scout.spec.ts` 通过，`3` files / `14` tests。
- `npx vitest run tests/unit/intent-e2e-new-intent-readiness.spec.ts tests/unit/intent-e2e-known-fixture-governance.spec.ts tests/unit/intent-e2e-fixture-executor.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-recipe-registry.spec.ts` 通过，`6` files / `54` tests；覆盖 repo-owned `modal_or_drawer_save`、`business_create_list_verify`、`business_to_order` setup / cleanup fixture 的解析、执行与 readiness 重算。
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30` 通过，`ready=no gate=ready_for_document_family_governance decision=collect_document_real_click eligible=-`。
- `npm run intent:next-dev:check -- --project-uid proj_default --window-days 30` 按预期返回非 0，原因是 latest recommended top-3 document 候选 `doc_archive_restore_verify / doc_search_open_verify / doc_create_reopen_verify` 均已完成，没有新的未治理 document code work。
- `npm run intent:document-family:governance -- --project-uid proj_default --require-ready` 通过，`governed=doc_archive_restore_verify,doc_search_open_verify,doc_create_reopen_verify missing=-`。
- `npm run intent:document-family:guard -- --project-uid proj_default --require-passed` 通过，`passed=yes baselines=3 passedBaselines=3 real_click_signals=30 admissible_passed=22`。
- `npx vitest run tests/unit/intent-e2e-document-real-click-seed.spec.ts tests/unit/intent-e2e-document-family-governance.spec.ts tests/unit/intent-e2e-document-family-release-guard.spec.ts tests/unit/intent-e2e-next-development-plan.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-execution-plan.spec.ts tests/unit/intent-action-dsl.spec.ts tests/unit/test-generator.spec.ts` 通过，`9` files / `278` tests。
- `bash scripts/check-boundaries.sh` 通过。
- `node scripts/check-doc-links.mjs` 通过。
- `node scripts/check-roadmap-progress.mjs` 通过，最新更新为“第五百六十七次（Final Delivery：closure and observability handoff）”。
- `git diff --check && git diff --cached --check` 通过。

## 最终交付收口

- 交付摘要：[intent-e2e-final-delivery-readiness-summary-2026-05-11.md](/Users/xiaolongbao/Workspace/ai-test/docs/intent-e2e-final-delivery-readiness-summary-2026-05-11.md)。
- 最新 traffic-quality：`real_click=122/147 (83.0%)`，`benchmark_rerun=455/627 (72.6%)`，两者继续分离统计。
- 最新 new-intent readiness：`total=100`，`direct_generate=99`，`draft_only=1`，`needs_fixture=0`，`realClickFixtureBootstrap=0`。
- 最新 fixture bootstrap：`total=0`。
- 最新 next-development：`developmentReady=false`，`decision=collect_document_real_click`；`intent:next-dev:check` 当前按预期返回非 0，因为 top-3 document candidates 已全部 `contract_ready + guard passed`。
- 后续开发只在以下信号出现时启动：`realClickFixtureBootstrapCount > 0`、稳定重复的 `unknown_business_or_product > 0`、新的未治理 document family、已治理 family pass-rate / governance 退化、或环境 / 认证 / 数据依赖退化需要 runbook 恢复。

## 下一次允许开发的触发条件

重新运行：

```bash
npm run intent:next-dev:check -- --project-uid proj_default --window-days 30
npm run intent:priority-triage -- --project-uid proj_default --windows 30,90,365
```

当前 `intent:next-dev:check` 会按预期阻断，直到出现新的未治理候选。下一轮开发必须满足：

- source policy：`post_instrumentation_real_click_only`
- 分母：只使用 `source=real_click` 的 launch / auto-run / terminal 窗口
- document candidate 不能已经是 `contract_ready + release_guard=passed`
- 若是 priority family，不能已经是 release / knowledge ready
- 若怀疑 `untracked` / `business_to_order` 是下一刀，必须先确认 `intent:priority-triage` 存在 `unknown_business_or_product > 0` 的稳定重复样本，或 `business_to_order` 出现 pass-rate / governance 缺口。

在此之前，只能继续收集真实 document-like `real_click`，或等待新的未治理 top priority family；不能用 benchmark / replay / draft_import 结果替代真实分母。

## 明确不做

- 不用跨系统 `docs.qq.com` 样本污染当前系统真实流量。
- 不把 release window 的 synthetic benchmark 成功率外推成所有 AI 生成成功率。
- 不重复治理已经 ready 的 top real_click family。
- 不在缺少新的未治理 document-like traffic 时新增 document / OCR / verifier 代码切片；当前 latest recommended top-3 `doc_archive_restore_verify / doc_search_open_verify / doc_create_reopen_verify` 已完成，不做 OCR-first。
