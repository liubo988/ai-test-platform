# Runbook

## 本地前置
- Node.js：建议使用当前稳定 LTS。
- npm：随 Node 安装即可。
- MySQL：integration tests 与项目化工作台 API 需要。
- Playwright browsers：跑 E2E 前执行 `npx playwright install --with-deps`。

## 初始化
1. `npm ci`
2. 复制 `.env.example` 为 `.env`
3. 把数据库配置写入 `.env`
4. `npm run db:init`

## 常用命令
- 启动开发服务器：`npm run dev`
- TypeScript 检查：`npm run build`
- Next 构建检查：`npm run build:web`
- 单测：`npm run test:unit`
- 集成测：`npm run test:integration`
- E2E：`npm run test:e2e`
- 预发 E2E：`E2E_BASE_URL=https://your-preprod-host npm run test:e2e:preprod`
- 全量回归：`npm run test:all`
- 生成边缘用例测试：`npm run edge:generate`
- 批量沉淀历史 playbook 到项目 recipe：`npm run intent:playbook:promote -- --project-uid <projectUid>`
- 列出 benchmark holdout candidates：`npm run intent:benchmark:candidates -- --project-uid <projectUid>`
- 冻结 benchmark：`npm run intent:benchmark:freeze -- --project-uid <projectUid>`
- 声明官方 current-slice：`npm run intent:benchmark:slice -- --project-uid <projectUid> --after-terminal-run-id <runId> --declared-reason <text>`
- 回放 benchmark：`npm run intent:benchmark:replay -- --project-uid <projectUid>`
- 对比当前 benchmark：`npm run intent:benchmark:compare -- --project-uid <projectUid>`
- 用 tracked corpus 发起 fresh family rerun：`npm run intent:benchmark:rerun -- --project-uid <projectUid> --request-corpus <path>`
- 执行多 family release guard：`npm run intent:release-guard -- --config <path>`
- 校验 release guard 配置与可移植资产：`npm run intent:release-guard:preflight`
- 校验默认 project knowledge 命中证据：`npm run intent:knowledge-hit-guard`
- 汇总发布状态：`npm run intent:release-status`
- 生成 CI / PR 可读发布摘要：`npm run intent:release-summary`
- 生成真实流量质量报表：`npm run intent:traffic-quality -- --project-uid <projectUid> --window-days 30`
- 阻断无可开发候选的真实流量质量报表：`npm run intent:traffic-quality:development-ready -- --project-uid <projectUid> --window-days 30`
- 生成新意图 readiness 报表：`npm run intent:new-intent:readiness -- --project-uid <projectUid> --window-days 30`
- 筛出 fixture bootstrap 候选：`npm run intent:fixture-bootstrap -- --project-uid <projectUid> --window-days 30`
- 生成下一轮开发计划报表：`npm run intent:next-dev:plan -- --project-uid <projectUid> --window-days 30`
- 校验下一轮开发准入：`npm run intent:next-dev:check -- --project-uid <projectUid> --window-days 30`
- 拆解 priority untracked / business_to_order：`npm run intent:priority-triage -- --project-uid <projectUid> --windows 30,90,365`
- 审计正式任务 seed 候选：`npm run intent:formal-task-seeds -- --project-uid <projectUid>`
- 将正式任务 seed 重新发起为 real-click 样本：`npm run intent:formal-task-seed-runs -- --project-uid <projectUid> --priority-scenario-family <family>`
- 轻量扫描 document-like 样本线索：`npm run intent:document-sample:scout -- --project-uid <projectUid> --windows 30,90,365`
- 执行 document-like real-click 采集尝试：`npm run intent:document-real-click:seed -- --project-uid <projectUid> --max-samples 1`，有界扩样可追加 `--repeat <n>`

## 推荐工作流
### 改 AI / 业务逻辑
1. `npm run build`
2. `npm run test:unit`
3. 如果涉及 DB 或 route，再跑 `npm run db:init && npm run test:integration`

### 冻结 AI 生成 holdout
1. 若要先把历史成功 run 的 `playbookCandidates` 回填成项目 recipe，可执行：
   `npm run intent:playbook:promote -- --project-uid <projectUid> --module-uid <moduleUid> --run-limit 200`
2. 先列出当前 scope 的 benchmark candidates；如果你要正式建立 non-weak proof window，直接带上：
   `npm run intent:benchmark:candidates -- --project-uid <projectUid> --module-uid <moduleUid> --test-type browser_e2e --proof-window non_weak`
3. 视需要用 `--eval-case-id` 明确挑选 case，或直接按推荐候选冻结：
   `npm run intent:benchmark:freeze -- --project-uid <projectUid> --module-uid <moduleUid> --test-type browser_e2e --max-cases 12 --release-candidate <label>`
4. 如果你这次只想建立 non-weak family baseline，优先用正式 proof window：
   `npm run intent:benchmark:freeze -- --project-uid <projectUid> --module-uid <moduleUid> --test-type browser_e2e --proof-window non_weak --release-candidate <label>`
   这会显式隔离 `taskMode=unknown` 或 `stepCount=0 / snapshotSignature=no_steps` 的 weak case，并把排除原因写进 benchmark / replay / compare 结果。
5. 改完策略后跑：
   `npm run intent:benchmark:compare -- --project-uid <projectUid> --compared-label <label>`
6. 如果只想复核某个 tracked family，直接复用同一套 CLI：
   `npm run intent:benchmark:freeze -- --project-uid <projectUid> --module-uid <moduleUid> --test-type browser_e2e --priority-scenario-family list_search_detail --release-candidate <label>`
7. 如果需要把当前项目 recipe 资产显式落盘，补上：
   `--recipe-asset-output <tracked-path>`
8. 如果要按同一份 recipe 资产复核，先导回当前项目 registry 再 replay / compare：
   `npm run intent:benchmark:compare -- --project-uid <projectUid> --priority-scenario-family list_search_detail --recipe-asset-input <tracked-path> --compared-label <label>`
9. family compare 的 `priorityScenarioFamilies` 汇总如果显示 `insufficient_evidence`，表示冻结窗口或当前窗口的 terminal 样本少于 3；此时只能继续补样本，不能宣称收益。
10. 如果 current compare 被 pre-recovery 的旧 terminal runs 污染，可先声明 official current-slice，再显式让 replay / compare 消费它：
   `npm run intent:benchmark:slice -- --project-uid <projectUid> --priority-scenario-family modal_or_drawer_save --proof-window non_weak --after-terminal-run-id <boundaryRunId> --declared-reason "exclude pre-recovery terminal runs" --created-from-compare-report <compare-report-path>`
   `npm run intent:benchmark:replay -- --project-uid <projectUid> --priority-scenario-family modal_or_drawer_save --current-slice reports/intent-e2e/projects/<projectUid>/intent-e2e.current-slices/<timestamp>-slice_<uid>.json`
   `npm run intent:benchmark:compare -- --project-uid <projectUid> --priority-scenario-family modal_or_drawer_save --current-slice reports/intent-e2e/projects/<projectUid>/intent-e2e.current-slices/<timestamp>-slice_<uid>.json --compared-label <label>`
11. `current-slice` 是官方 current-side boundary，不允许手工按 case 删除旧失败样本；它统一按 `afterTerminalRunId + afterFinishedAt` 切出“严格晚于 boundary”的 terminal run 窗口，并把 slice metadata、pre-slice 过滤计数和实际纳入的 runIds 写进 replay / compare 报告。
12. 如果某个 family 在 recent window 里还是 `0-case`，先补 tracked corpus rerun，再 freeze / replay / compare：
   `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid <moduleUid> --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json`
13. 当前 repo 已跟踪的 family request corpus：
   `artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json`
   `artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json`
14. release 前可统一执行多 family guard：
   `npm run intent:release-guard:preflight`
   `npm run intent:release-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json`
   preflight 不连接数据库，只校验配置、tracked benchmark、current-slice 和 recipe asset 是否齐全且匹配；完整 release guard 会执行 current compare。当前默认配置覆盖 `business_create_list_verify`、`business_to_order`、`list_search_detail`、`business_batch_add_contacts_verify`、`modal_or_drawer_save` 五条已治理 family；任一 compare 出现 regression、missing case 或 insufficient evidence 都会返回非 0。
15. 如果只需要确认默认 project knowledge 的 expected rule 仍有可复核命中证据，执行：
   `npm run intent:knowledge-hit-guard`
   默认配置会检查 `business.create-list-status-detail-entry`、`business.create-order-flow`、`order.list-search-detail-primary-record`、`business.batch-add-contacts`、`commission.service-ratio-config` 五条规则；它不查询数据库，也不替代完整 release compare。
16. 如果需要汇总 release guard 资产、knowledge 命中证据与最近一次 release compare，执行：
   `npm run intent:release-status -- --json`
   `npm run intent:release-status -- --require-current-compare --json`
   该命令输出 `ready / attention / blocked`：静态证据通过但本地没有 compare report 时是 `attention`；发布前要求必须有 compare report 时加 `--require-current-compare`。
17. 如果要为 CI / PR 生成可读摘要，执行：
   `npm run intent:release-summary -- --skip-current-compare`
   默认写出 `reports/ci/intent-e2e-release-readiness.json` 和 `reports/ci/intent-e2e-release-readiness.md`；CI 静态检查会把 Markdown 追加到 GitHub step summary，并上传 artifact。该摘要用于让静态 release guard / knowledge-hit 证据可见，不替代发布前完整 `intent:release-guard` compare。
18. 如果要从系统内读取同一份摘要，调用只读 API：
   `GET /api/intent-e2e/release-status?projectUid=proj_default&requireCurrentCompare=1`
   该 API 会校验项目 `owner/editor/viewer` 权限，只根据 `projectUid` 读取服务端约定的 tracked artifacts，不接受任意文件路径参数。
19. `/intent-e2e` 工作台的“历史运行洞察”区会展示同一份 release status，只读面板不执行 live compare；面板会展开非 passed check、缺失 family evidence 和 release / knowledge failure 摘要，API 读取失败时只显示空状态；发布前仍以完整 `intent:release-guard` 和 `intent:release-status -- --require-current-compare` 为准。
20. `/projects/:projectUid` 项目工作台顶部会复用同一份 release status API 展示项目级摘要；它只读显示 ready / attention / blocked、check/family 计数和最近 compare message，详细排查仍跳转 `/intent-e2e?projectUid=...`。
21. 如果需要选择下一批 top family，先生成真实流量质量报表：
   `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30 --json`
   报表会同时写出 JSON 和 Markdown，按 `source / attachment / launchDecision / priorityScenarioFamily` 分桶；`real_click`、`draft_import`、`benchmark_rerun`、`replay` 的终态成功率保持分离，不能把 release window 的 synthetic 结果外推成所有真实 AI 生成结果。
   报表还会给出 `Sample Readiness`、`Document Family Selection` 和 `Next Plan Recommendation`：
   只有 `real_click.launch_click_count / auto_run_started_count / terminal_run_count` 达到阈值时，才允许直接从 post-instrumentation `real_click` 选 document families；否则只允许历史意图草稿做 fallback，若仍无 document-like 证据就会输出 `insufficient_evidence`。`Next Plan Recommendation` 会把 source policy、分母口径、候选 family、验收条件和 guardrails 固定下来；若真实分母达标但没有 document-like 请求，`realClickPriorityFamilyCandidates` 会列出可另起治理计划的非 document top family，并标注 release guard / knowledge-hit governance 状态；`developmentGate.status` 是机器可读的下一步开发准入结论。
   如需临时调整判定阈值，可追加 `--min-real-click-launches`、`--min-real-click-auto-runs`、`--min-real-click-terminal-runs`、`--historical-draft-limit`。
   如果结果是 `readiness=not_ready`、`document_selection=insufficient_evidence` 或 `document_selection=no_document_candidates`，说明当前 project 还不能继续 document family 治理，应先积累真实点击样本、更换存在真实 document traffic 的 project，或用 `realClickPriorityFamilyCandidates` 另起非 document family 治理计划；若候选 `governanceStatus=ready` 或 `developmentGate.status=no_admissible_code_work`，不要重复治理同一 family。
   自动化需要强制阻断无候选开发时，可追加 `--require-development-ready`；只有 `developmentGate.status=ready_for_document_family_governance` 或 `ready_for_ungoverned_priority_family` 时命令才会通过。
   等价短命令：`npm run intent:traffic-quality:development-ready -- --project-uid proj_default --window-days 30`；CLI 参数可用 `npm run intent:traffic-quality -- --help` 查看。
   如果要单独评估新业务意图的直接生成风险，运行：
   `npm run intent:new-intent:readiness -- --project-uid proj_default --input "<任务描述>" --target-url "<入口URL>" --json`
   不传 `--input` 时会扫描最近窗口的 `launch_click_count`，按 `source` 分离 real_click / draft_import / benchmark_rerun / replay，并输出推荐模式、信心、缺口、失败补救类别与 fixture bootstrap 草稿；该报表不改变 release-readiness 或 traffic-quality 成功率口径。
   已识别为 document family 且 `documentGovernanceStatus=contract_ready` 的请求会复用 document governance 契约，不会再因为底层 raw priority family 的 `requiresFixture` 被误报成 `fixture_contract` 缺口。
   如果只想处理 `needs_fixture` 候选，运行：
   `npm run intent:fixture-bootstrap -- --project-uid proj_default --window-days 30`
   该命令只过滤带 `fixtureBootstrap` 的 item，输出 setup / cleanup fixture ref、owner、idempotencyKey 和 recommended runtime governance；它只生成契约草稿，不自动创建或执行 fixture 脚本。
   当前 `proj_default` 已落地 `modal_or_drawer_save` 的 first-cut repo-owned fixture：`fixture://project/proj_default/modal_or_drawer_save/setup` 与 `cleanup`。`launch-decision` / `/api/intent-e2e/runs` 会对 `proj_default + 服务分佣配置 + modal_or_drawer_save` 窄匹配请求自动补这些 refs；其他场景仍需请求或项目 runtime governance 显式写入。脚本默认记录本地 fixture state。
   服务分佣配置 fixture 还提供远端恢复 adapter：`fixture://project/proj_default/modal_or_drawer_save/remote-restore`。默认 `INTENT_E2E_FIXTURE_REMOTE_RECOVERY_MODE=contract_only`，不会启动浏览器或修改远端；需要真实恢复时，设置 `INTENT_E2E_FIXTURE_REMOTE_RECOVERY_MODE=snapshot_restore` 并提供 `INTENT_E2E_FIXTURE_STORAGE_STATE=<已登录 Playwright storage state>`，setup 会快照原佣金比例，cleanup 会通过 UI 恢复原值。
   当前 `proj_default` 还落地 `business_create_list_verify` 的 repo-owned fixture：`fixture://project/proj_default/business_create_list_verify/setup` 与 `cleanup`。`launch-decision` / `/api/intent-e2e/runs` 会对 `proj_default + business_create_list_verify` 窄匹配请求自动补这些 refs；cleanup 只记录 businessId/contactPhone/contactName 等清理线索，不自动删除或作废远端商机。
   当前 `proj_default` 还落地 `business_to_order` 的 repo-owned fixture：`fixture://project/proj_default/business_to_order/setup` 与 `cleanup`。`launch-decision` / `/api/intent-e2e/runs` 会对 `proj_default + business_to_order` 窄匹配请求自动补这些 refs；cleanup 只记录 businessId/orderId/contactPhone/contactName 等清理线索，不自动删除或作废远端订单。
   后续开发准备可先跑 `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30`，它会写出 next-development JSON / Markdown，并同步刷新 traffic-quality 报表；真正开始下一刀前再跑 `npm run intent:next-dev:check -- --project-uid proj_default --window-days 30`。
   如果要把项目工作台里的正式任务作为后续采样参考，先跑 `npm run intent:formal-task-seeds -- --project-uid proj_default`；该报表只输出 `formal_task_seed_only` 候选，不能把正式任务执行历史直接算进 `source=real_click` 成功率。
   如果要把这些 seed 变成 traffic-quality 分母，使用 `npm run intent:formal-task-seed-runs -- --project-uid proj_default --priority-scenario-family <family>`；脚本会重新走 `launch-decision -> /api/intent-e2e/runs`，不携带 `intentDraftUid`，因此生成 `source=real_click` 事件，并写出 `intent-e2e.formal-task-real-click-seed-report.*.json/.md`。
   如果只是要快速确认 30/90/365 天窗口是否出现 document-like `real_click`，先跑 `npm run intent:document-sample:scout -- --project-uid proj_default --windows 30,90,365`；该命令只读 `intent-e2e.traffic-quality-events.jsonl` 和 formal-task seed audit，不连接数据库，适合在完整 traffic-quality 长窗口查询较慢时先做准入判断。
   如果下一步候选看起来是高频 `untracked` 或 `business_to_order`，先跑 `npm run intent:priority-triage -- --project-uid proj_default --windows 30,90,365`；该命令把 `untracked` 拆成 `document_like / reroutable_priority_family / unknown_business_or_product`，并读取 latest traffic-quality 的 `business_to_order` 终态成功率与 release / knowledge governance 状态。只有 `unknown_business_or_product` 有稳定重复样本，或 `business_to_order` governance / pass-rate 出现缺口时，才另起 priority family 治理切片。
   如果要执行当前系统 document-like 真实点击采集尝试，运行 `npm run intent:document-real-click:seed -- --project-uid proj_default --max-samples 1`；有界扩样可追加 `--repeat <n>`。该入口不携带 `intentDraftUid`，默认第一样本操作当前平台真实知识文档 UI，并在报告里区分 `documentFamily` 与 `admissibility`，避免把“参考知识文档执行业务流”误当作真实 document family 治理证据。
   如果要复核 document family recipe / fixture / verifier 契约，运行 `npm run intent:document-family:governance -- --project-uid proj_default --require-ready`；当前 `doc_create_reopen_verify`、`doc_search_open_verify`、`doc_edit_save_verify`、`doc_archive_restore_verify` 与 `doc_derive_capability_verify` 已固化为当前平台知识文档 UI 契约，只接受 `source=real_click` 的样本，不把 benchmark / replay / draft_import 混入真实分母。
   如果要复核独立 document-family guard baseline，运行 `npm run intent:document-family:guard -- --project-uid proj_default --require-passed`；该 guard 会聚合 latest traffic-quality、document governance profile 和 document real-click seed reports，只校验 document family 自己的 `post_instrumentation_real_click_only` 证据，默认阈值为 `minRealClickSignals=3`、`minAdmissiblePassedRuns=3`，不改既有 priority family release-readiness summary。
22. 如果要批量积累“既出现在意图草稿，又计入 real_click”的 fresh samples，使用：
   `node --env-file-if-exists=.env scripts/intent-e2e-seed-real-click-samples.mjs --project-uid proj_default --module-uid mod_1773303139537_c84d8476`
   这条工具链会先创建意图草稿，再用同一语义独立请求 `launch-decision -> /api/intent-e2e/runs`，但不会把 `intentDraftUid` 带进 run，所以不会把 source 污染成 `draft_import`。
   当前这条 seeding 工具已经内建两层硬护栏：
   - 只允许命中当前系统 host：`uat-service.yikaiye.com`
   - 若活动草稿里已存在相同语义（按 `moduleUid + targetUrl + input` 归一化，且内置 legacy 变体 prompt 也会并入同一 canonical sample），则直接跳过，不再重复写入新的 `[AI测试样本]`
   默认 built-in sample pack 已收敛为当前系统内的唯一任务，不再保留同一流程的 `01 / 02 / 03` 改写版：
   - 《管帮手PC端操作手册》批量加入通讯录验收
   - `business_to_order` 商机转订单主链路
   - `business_create_list_verify` 新建商机后列表验收
   - `list_search_detail` 订单列表详情校验
   其中前 3 条是当前更适合作为 real_click 积样主路径的唯一任务；`list_search_detail` 在真实窗口里仍可能因为目标页面当前无可用数据而波动，只适合作为观察样本。
   如需专门积累“AI生成 + 图片/OCR”真实点击样本，使用：
   `node --env-file-if-exists=.env scripts/intent-e2e-seed-real-click-samples.mjs --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --profile with_image`
   `with_image` profile 会创建一条带内联 PNG 附件的当前系统样本，用于刷新 `real_click.with_image.*` 和 OCR metrics 分母；不要把单条样本的 `1/1` 结果外推为长期成功率。
   扩大同一语义样本的运行分母时，先跑通一条 fresh draft，再使用：
   `node --env-file-if-exists=.env scripts/intent-e2e-seed-real-click-samples.mjs --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --profile with_image --repeat 9 --max-samples 9 --reuse-existing-drafts`
   当前 with-image 内置样本已显式要求“批量加入通讯录 toast 只作为可选日志，最终以我的通讯录按同一手机号检索命中为准”；若历史报告里仍包含旧 toast 硬断言失败，不要和修复后 fresh/reuse 窗口混为同一口径。

### 改前端工作台
1. `npm run build`
2. `npm run build:web`
3. 需要时跑 `npm run test:e2e`

### 改生成器或边缘用例
1. `npm run edge:generate`
2. 检查 `tests/integration/generated/**`
3. `npm run test:unit`

## 常见问题
### integration tests 报缺少数据库配置
- 确认根目录 `.env` 存在。
- 确认 `.env` 里至少有 `DB_HOST`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`、`DB_PORT`。
- 跑一次 `npm run db:init`。

### E2E 报找不到浏览器
- 执行 `npx playwright install --with-deps`。

### `build:web` 或 smoke server 构建失败
- 先跑 `npm run build` 看 TypeScript 是否已经报错。
- 再检查 `app/**` 页面、`useSearchParams()`、服务端导入链和 Next 构建日志。

### product-create E2E 直接跳过
- 这是正常行为。该用例属于真实预发 E2E，需要 `E2E_BASE_URL`、`E2E_USERNAME` 与 `E2E_PASSWORD`。
- 如果只想先确认预发服务可访问，可先配置 `E2E_BASE_URL` 后执行 `npm run test:e2e:preprod`；`E2E_PREPROD_SMOKE_PATH` 可覆盖默认 `/` 路径。

## CI 期望
- CI 会验证生成产物、入口文档链接、分层边界、TypeScript / Next 构建、unit、integration 和 e2e。
- CI 的静态检查 job 会执行 `npm run intent:release-guard:preflight`，确保 release guard 引用的 tracked baseline/current-slice 资产没有断链。
- CI 的静态检查 job 也会执行 `npm run intent:knowledge-hit-guard`，确保默认 project knowledge 的 tracked 命中证据没有断链或漏规则。
- 集成测试 job 会在工作流内自建 MySQL，并写入一份最小 `.env`。
