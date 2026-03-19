# OpenAI 意图驱动 E2E MVP 迭代文档（2026-03-16）

## 2026-03-19 第十七次更新（历史运行洞察与回滚候选已接入工作台）
本次继续围绕“简单上手、成功率高”推进，但没有再加新开关，而是把已有运行记录真的转成能指导动作的反馈：
- 已新增 `GET /api/intent-e2e/insights`，会直接聚合最近终态 run snapshot 和项目知识审计，输出通过率、知识命中率、推荐 helper 复用率、Top 规则 / helper / 失败类别
- 已新增 `lib/ai/intent-e2e-insights.ts`，不引入新表，直接复用现有持久化的 run snapshot 与 `project-knowledge` audit log 做轻量聚合
- 已在 `IntentE2EWorkbench` 的“项目知识草稿”区域补上“历史运行洞察”卡片，默认显示最近成功率、知识命中率、helper 复用率，以及最该优先看的规则 / helper / 失败模式
- 已补一层基于 merge 审计的回滚候选提示：当某次知识合并后，前后窗口各至少 3 次、最多 5 次终态运行的通过率下滑达到 20 个点时，工作台会直接提示可疑规则和对应备份路径
- 已把“半自动回滚 guardrail”补到洞察卡片上：看到可疑回滚候选后，可以直接在卡片里一键回滚到对应备份，不必再去备份列表里手动找
- 已把 merge guardrail 补到接口返回上：如果本次新增规则与历史可疑回滚候选的 ruleId 重合，`POST /api/intent-e2e/project-knowledge/merge` 会返回 `guardrailWarning`，提醒先小范围验证
- 已把历史规则表现真正接回 generate / repair 规划阶段：最近通过率更高的规则会前置进 DSL / Prompt，命中过去可疑回滚候选且历史表现差的规则会被自动降权，必要时直接跳过
- 这一步的价值是把“跑完一次看日志”推进成“看趋势决定下一步”：先判断是知识没命中、helper 没复用，还是某次规则沉淀把成功率拖下来了

新增 / 更新关键文件：
- `lib/db/repository.ts`
- `lib/ai/intent-e2e-insights.ts`
- `app/api/intent-e2e/insights/route.ts`
- `components/IntentE2EWorkbench.tsx`
- `lib/test-generator.ts`
- `lib/ai/intent-e2e-service.ts`
- `tests/unit/intent-e2e-insights.spec.ts`
- `tests/unit/intent-e2e-service.spec.ts`
- `tests/unit/intent-project-knowledge.spec.ts`
- `tests/unit/api-intent-e2e-insights-route.spec.ts`
- `README.md`
- `docs/openai-intent-e2e-mvp-2026-03-16.md`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- P1.8：服务端 runId / 断线恢复 / 服务端停止，已完成
- P2.1：动作约束 DSL，已完成
- P2.3：高频动作库 + 新 runtime helper，已完成
- P2.4：修复记忆（失败聚类 + 策略回写），已完成
- P2.5：项目知识驱动裁剪，已完成
- P2.6：repair memory 反推项目规则草稿，已完成
- P2.7：工作台项目知识草稿面板，已完成
- P2.8：候选规则一键合并回项目知识文件，已完成
- P2.9：合并前自动备份 + 变更预览，已完成
- P3.0：从 backup 一键回滚项目知识规则，已完成
- P3.1：项目工作台 / 需求编排联调收口（前置检查阻断 / Next 16 build / smoke 对齐），已完成
- P3.2：项目知识 merge / restore 收益对比 + 审计记录，已完成
- P3.3：运行结果知识命中 / helper 使用可观测性，已完成
- P3.4：历史运行洞察 / 回滚候选提示，已完成
- 下一步建议优先做：基于这批 insights 做规则排序、自动降级或半自动回滚 guardrail，再继续补业务 helper / capability 资产
## 2026-03-19 第十六次更新（运行结果已补知识命中与 helper 使用可观测性）
本次没有继续加新的操作面板，而是补“为什么这次成功/失败”的透明度：
- `IntentE2ERunResult` 现在会附带结构化 `knowledge` 摘要，直接记录本次 run 命中的项目知识规则、能力标签、推荐 helper 和规则文件路径
- 每次 attempt 现在都会附带 `helperUsage`，可以看到脚本实际用了哪些 `__e2e.*` helper，以及其中有多少是命中了项目知识推荐 helper
- `IntentE2EWorkbench` 结果区现在会直接展示“知识命中与 Helper 使用”卡片，并在每次尝试卡片里补充 helper 摘要，方便快速判断当前成功是否来自既有知识沉淀，还是纯靠通用脚本侥幸通过
- 这一步的核心价值不是直接抬高单次成功率，而是让后续真正能做“规则命中 -> helper 使用 -> 最终通过率”的闭环分析，为下一轮自动回滚、规则排序和成功率看板打基础

新增 / 更新关键文件：
- `lib/ai/intent-e2e-service.ts`
- `lib/ai/intent-e2e-run-registry.ts`
- `lib/test-generator.ts`
- `components/IntentE2EWorkbench.tsx`
- `tests/unit/intent-e2e-service.spec.ts`
- `tests/unit/intent-e2e-run-registry.spec.ts`
- `tests/unit/test-generator.spec.ts`
- `README.md`
- `docs/openai-intent-e2e-mvp-2026-03-16.md`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- P1.8：服务端 runId / 断线恢复 / 服务端停止，已完成
- P2.1：动作约束 DSL，已完成
- P2.3：高频动作库 + 新 runtime helper，已完成
- P2.4：修复记忆（失败聚类 + 策略回写），已完成
- P2.5：项目知识驱动裁剪，已完成
- P2.6：repair memory 反推项目规则草稿，已完成
- P2.7：工作台项目知识草稿面板，已完成
- P2.8：候选规则一键合并回项目知识文件，已完成
- P2.9：合并前自动备份 + 变更预览，已完成
- P3.0：从 backup 一键回滚项目知识规则，已完成
- P3.1：项目工作台 / 需求编排联调收口（前置检查阻断 / Next 16 build / smoke 对齐），已完成
- P3.2：项目知识 merge / restore 收益对比 + 审计记录，已完成
- P3.3：运行结果知识命中 / helper 使用可观测性，已完成
- 下一步建议优先做：基于这批 run telemetry 做“规则命中 -> helper 使用 -> 通过率”的趋势看板，再决定自动回滚和规则排序策略

## 2026-03-19 第十五次更新（项目知识 merge / restore 已补收益对比与审计记录）
本次把上一轮留下的“可回退但还不够可量化 / 可追踪”缺口补齐了：
- `POST /api/intent-e2e/project-knowledge/merge` 现在除了 `backupPath / diffPreview / summary` 之外，还会返回结构化 `comparison`，直接给出规则数、启用规则数、能力覆盖、Helper 覆盖、Step Patch 覆盖、URL 模式覆盖的前后变化
- `POST /api/intent-e2e/project-knowledge/backups/restore` 现在也会返回同样的 `comparison`，可以明确看到这次回滚到底撤回了哪些规则、移除了哪些覆盖、是否有同 ID 规则内容被改写
- 已新增本地审计日志：`GET /api/intent-e2e/project-knowledge/audits`，默认落到 `reports/intent-e2e.project-knowledge.audit.jsonl`，会保留最近 merge / restore 的标题、摘要、来源备份、备份产物和规则增删改明细
- 当请求里带 `projectUid` 时，merge / restore 会先校验该项目的 `owner/editor` 权限，再尝试把这次规则沉淀或回滚同步写进项目 activity log；即使 DB activity 写入失败，本地审计仍会保留，避免“实际已改文件但前端误以为全失败”
- `IntentE2EWorkbench` 里的“项目知识草稿”面板现在已直接展示本次 merge / restore 的收益对比卡片、最近审计记录列表，以及是否成功同步到项目 activity 的状态

新增 / 更新关键文件：
- `lib/intent-project-knowledge.ts`
- `lib/intent-project-knowledge-draft.ts`
- `app/api/intent-e2e/project-knowledge/merge/route.ts`
- `app/api/intent-e2e/project-knowledge/backups/restore/route.ts`
- `app/api/intent-e2e/project-knowledge/audits/route.ts`
- `components/IntentE2EWorkbench.tsx`
- `components/ProjectWorkspace.tsx`
- `tests/unit/intent-project-knowledge.spec.ts`
- `tests/unit/intent-project-knowledge-draft.spec.ts`
- `tests/unit/api-intent-project-knowledge-merge-route.spec.ts`
- `tests/unit/api-intent-project-knowledge-backup-restore-route.spec.ts`
- `tests/unit/api-intent-project-knowledge-audits-route.spec.ts`
- `README.md`
- `docs/openai-intent-e2e-mvp-2026-03-16.md`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- P1.8：服务端 runId / 断线恢复 / 服务端停止，已完成
- P2.1：动作约束 DSL，已完成
- P2.3：高频动作库 + 新 runtime helper，已完成
- P2.4：修复记忆（失败聚类 + 策略回写），已完成
- P2.5：项目知识驱动裁剪，已完成
- P2.6：repair memory 反推项目规则草稿，已完成
- P2.7：工作台项目知识草稿面板，已完成
- P2.8：候选规则一键合并回项目知识文件，已完成
- P2.9：合并前自动备份 + 变更预览，已完成
- P3.0：从 backup 一键回滚项目知识规则，已完成
- P3.1：项目工作台 / 需求编排联调收口（前置检查阻断 / Next 16 build / smoke 对齐），已完成
- P3.2：项目知识 merge / restore 收益对比 + 审计记录，已完成
- 下一步建议优先做：把“配置覆盖对比”继续联到真实 repair 命中率 / 通过率趋势、评估是否拆 project-scoped knowledge 文件、继续补业务 capability / workflow 资产

## 2026-03-19 第十四次更新（项目工作台 / 需求编排 smoke 已对齐当前 UI，构建与前置检查回归已收口）
本次不是继续堆功能，而是把上一轮大改之后的联调缺口和回归面真正收口：
- 已修正 `intent-e2e` 前置检查的阻断分支：当前当 `precheckPageAccess()` 返回 `blocked` 时，会直接给出结构化 `final_result` 和失败归类，不再错误地继续读取 `storageState` 并进入 `analyzePage`
- 已补上 OpenAI Responses API 的重试兜底：遇到 `"type 'reasoning' was provided without its required following item"` 这类上游瞬时错误时，会自动重试，避免 CLI / repair 链路被单次异常打断
- 已兼容 Next 16 的生产构建约束：`/intent-e2e` 和 `/projects/[projectUid]` 页面中依赖 `useSearchParams()` 的工作台入口已包进 `Suspense`，`npm run build:web` 可稳定通过
- 已修正需求编排工作台的已归档能力目录展示，恢复动作重新可达；此前目录只展示 active 能力，导致“归档后无法恢复”在 UI 层形成真空
- 已同步更新 `scenario-task-smoke` 的 API mock 与交互断言，使其对齐当前“AI 生成 / 手动新建 / 需求编排草稿 / 能力弹框分组”这套真实界面，而不是停留在旧版文案与布局
- 本轮最终验证结果：`npm run build`、`npm run build:web`、`npm run test:integration`、`npm run test:e2e` 全部通过；其中 `product-create.spec.ts` 因缺少 `E2E_USERNAME / E2E_PASSWORD` 按预期跳过

新增 / 更新关键文件：
- `lib/ai/intent-e2e-service.ts`
- `lib/openai-responses.js`
- `lib/llm-client.ts`
- `app/intent-e2e/page.tsx`
- `app/projects/[projectUid]/page.tsx`
- `components/ProjectIntentWorkbench.tsx`
- `tests/e2e/scenario-task-smoke.spec.ts`
- `tests/unit/intent-e2e-service.spec.ts`
- `tests/unit/llm-client.spec.ts`
- `README.md`
- `docs/openai-intent-e2e-mvp-2026-03-16.md`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- P1.8：服务端 runId / 断线恢复 / 服务端停止，已完成
- P2.1：动作约束 DSL，已完成
- P2.3：高频动作库 + 新 runtime helper，已完成
- P2.4：修复记忆（失败聚类 + 策略回写），已完成
- P2.5：项目知识驱动裁剪，已完成
- P2.6：repair memory 反推项目规则草稿，已完成
- P2.7：工作台项目知识草稿面板，已完成
- P2.8：候选规则一键合并回项目知识文件，已完成
- P2.9：合并前自动备份 + 变更预览，已完成
- P3.0：从 backup 一键回滚项目知识规则，已完成
- P3.1：项目工作台 / 需求编排联调收口（前置检查阻断 / Next 16 build / smoke 对齐），已完成
- 下一步建议优先做：补 restore / knowledge merge 的收益对比与审计、把更多高频业务流沉淀成正式 capability / workflow 资产、再决定是否接真实账号 E2E 用例进 CI

## 2026-03-16 第十三次更新（项目知识规则已支持从 backup 一键回滚）
本次把“可回退”也接到工作台里，保证你让 AI 自动沉淀项目规则时，始终还能一键撤回：
- 已新增备份列表接口：`GET /api/intent-e2e/project-knowledge/backups`
- 已新增规则回滚接口：`POST /api/intent-e2e/project-knowledge/backups/restore`
- 工作台里的“项目知识草稿”面板现在会直接展示规则备份列表，并支持对任意一个备份执行一键回滚
- 回滚前会再次自动备份当前 live 规则文件，因此整条链路是“合并可回退、回退也可继续回退”的安全闭环
- 回滚成功后，工作台会自动刷新草稿预览和备份列表，不需要你手动刷新页面或重新调接口

新增 / 更新关键文件：
- `lib/intent-project-knowledge.ts`
- `app/api/intent-e2e/project-knowledge/backups/route.ts`
- `app/api/intent-e2e/project-knowledge/backups/restore/route.ts`
- `components/IntentE2EWorkbench.tsx`
- `tests/unit/intent-project-knowledge.spec.ts`
- `tests/unit/api-intent-project-knowledge-backups-route.spec.ts`
- `tests/unit/api-intent-project-knowledge-backup-restore-route.spec.ts`
- `README.md`
- `docs/openai-intent-e2e-mvp-2026-03-16.md`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- P1.8：服务端 runId / 断线恢复 / 服务端停止，已完成
- P2.1：动作约束 DSL，已完成
- P2.3：高频动作库 + 新 runtime helper，已完成
- P2.4：修复记忆（失败聚类 + 策略回写），已完成
- P2.5：项目知识驱动裁剪，已完成
- P2.6：repair memory 反推项目规则草稿，已完成
- P2.7：工作台项目知识草稿面板，已完成
- P2.8：候选规则一键合并回项目知识文件，已完成
- P2.9：合并前自动备份 + 变更预览，已完成
- P3.0：从 backup 一键回滚项目知识规则，已完成
- 下一步建议优先做：支持“回滚前后收益对比”、补 restore 审计记录、继续补业务 helper

## 2026-03-16 第十二次更新（合并规则时已支持自动备份和变更预览）
本次把“候选规则一键合并”补到更安全、更可追踪：
- 已在项目知识 merge 流程中新增自动备份，合并前会把旧的项目规则文件保存到 `reports/intent-e2e.project-knowledge.backups/`
- 已新增结构化变更摘要和可读 diff preview，前端工作台会直接展示“这次新增了哪些规则、命中了哪些 URL、附带了哪些 capability / promptNotes”
- `POST /api/intent-e2e/project-knowledge/merge` 现在会返回 `backupPath / diffPreview / summary`，方便后续继续做 restore、Git diff 或审计
- 工作台里合并成功后会把 backup 路径同步写进实时 feed，并在面板里展示本次变更预览
- 这一步的意义是：让 AI 自动沉淀知识的同时，仍然给你留出“可回退、可审阅、可继续迭代”的安全边界

新增 / 更新关键文件：
- `lib/intent-project-knowledge.ts`
- `lib/intent-project-knowledge-draft.ts`
- `app/api/intent-e2e/project-knowledge/merge/route.ts`
- `components/IntentE2EWorkbench.tsx`
- `tests/unit/intent-project-knowledge-draft.spec.ts`
- `tests/unit/api-intent-project-knowledge-merge-route.spec.ts`
- `.env.example`
- `README.md`
- `docs/openai-intent-e2e-mvp-2026-03-16.md`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- P1.8：服务端 runId / 断线恢复 / 服务端停止，已完成
- P2.1：动作约束 DSL，已完成
- P2.3：高频动作库 + 新 runtime helper，已完成
- P2.4：修复记忆（失败聚类 + 策略回写），已完成
- P2.5：项目知识驱动裁剪，已完成
- P2.6：repair memory 反推项目规则草稿，已完成
- P2.7：工作台项目知识草稿面板，已完成
- P2.8：候选规则一键合并回项目知识文件，已完成
- P2.9：合并前自动备份 + 变更预览，已完成
- 下一步建议优先做：支持“从 backup 一键回滚”、补收益统计面板、继续补业务 helper

## 2026-03-16 第十一次更新（工作台已支持勾选候选后一键合并回项目规则）
本次把“项目知识草稿预览”再推进半步，直接补上了从候选规则到正式规则文件的最后一跳：
- 已新增后端接口：`POST /api/intent-e2e/project-knowledge/merge`，会按当前阈值重新生成草稿，并把选中的 `candidateIds` 合并回项目知识文件
- `/intent-e2e` 工作台的“项目知识草稿”面板已支持勾选建议项、全选 / 清空、一键合并到主规则文件
- 合并后会立即刷新草稿预览，因此刚刚合并成功的候选会马上转成 `alreadyCovered`，方便继续迭代剩余候选
- 这一步的目标是尽量不让用户碰 JSON：用户看卡片、点选择、点合并，后续生成阶段就自动吃到新规则
- 这让 repair memory → knowledge draft → live knowledge profile 形成真正闭环，后面你继续只要跑用例，系统就会越来越贴近你的项目

新增 / 更新关键文件：
- `lib/intent-project-knowledge.ts`
- `lib/intent-project-knowledge-draft.ts`
- `app/api/intent-e2e/project-knowledge/merge/route.ts`
- `components/IntentE2EWorkbench.tsx`
- `tests/unit/intent-project-knowledge-draft.spec.ts`
- `tests/unit/api-intent-project-knowledge-merge-route.spec.ts`
- `README.md`
- `docs/openai-intent-e2e-mvp-2026-03-16.md`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- P1.8：服务端 runId / 断线恢复 / 服务端停止，已完成
- P2.1：动作约束 DSL，已完成
- P2.3：高频动作库 + 新 runtime helper，已完成
- P2.4：修复记忆（失败聚类 + 策略回写），已完成
- P2.5：项目知识驱动裁剪，已完成
- P2.6：repair memory 反推项目规则草稿，已完成
- P2.7：工作台项目知识草稿面板，已完成
- P2.8：候选规则一键合并回项目知识文件，已完成
- 下一步建议优先做：支持“合并时自动生成 Git diff / 变更说明”、补收益统计面板、继续补业务 helper

## 2026-03-16 第十次更新（工作台已支持项目知识草稿预览 / 写出）
本次把前一轮已经落地的 `repair memory -> project knowledge draft` 能力正式接进了 `/intent-e2e` 工作台，避免你还要单独调 API 或打开 JSON：
- 已在 `/intent-e2e` 表单区新增“项目知识草稿”面板，支持直接调整 `minSeenCount / minResolvedCount / maxCandidates`
- 可一键预览草稿，并在面板里直接看到 `confidence / seen / resolved / successRate / sampleUrls / successfulStrategies / antiPatterns / alreadyCovered`
- 可一键把草稿写出到 `reports/intent-e2e.project-knowledge.draft.json`（或环境变量指定路径）
- 预览 / 写出结果会同步进入右侧“实时进展” feed，让整条 AI 工作链仍保持统一的流式反馈体验
- 这一步的核心意义是：用户继续只管输入目标与图片，AI 不仅自己修复，还会把修复经验自动沉淀成下一轮更稳的规则素材

新增 / 更新关键文件：
- `components/IntentE2EWorkbench.tsx`
- `README.md`
- `docs/openai-intent-e2e-mvp-2026-03-16.md`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- P1.8：服务端 runId / 断线恢复 / 服务端停止，已完成
- P2.1：动作约束 DSL，已完成
- P2.3：高频动作库 + 新 runtime helper，已完成
- P2.4：修复记忆（失败聚类 + 策略回写），已完成
- P2.5：项目知识驱动裁剪，已完成
- P2.6：repair memory 反推项目规则草稿，已完成
- P2.7：工作台项目知识草稿面板，已完成
- 下一步建议优先做：支持“挑选候选规则后直接合并回 profile”、补收益统计面板、继续补业务 helper

## 2026-03-16 第九次更新（repair memory 反推项目规则草稿已落地）
本次把“AI 修成功一次”继续往前推成“AI 能把修成功经验自动草拟成项目知识规则”：
- 已新增 `repair memory -> project knowledge draft` 生成器，会从重复出现且修成功过的失败簇里自动产出候选规则
- 草稿会自动标注：命中的失败类别、相关 cluster、成功修法、常见误区、推导出的 match 条件和步骤补丁
- 如果当前 `intent-e2e.project-knowledge.json` 已经覆盖了同一页面 + 同类 helper/capability，草稿也会标记为 `alreadyCovered`，避免重复沉淀
- 已新增 API：`GET /api/intent-e2e/project-knowledge/draft` 预览，`POST /api/intent-e2e/project-knowledge/draft` 写出草稿文件
- 这一步的意义是把“repair memory 是被动记录”升级成“repair memory 可以主动产出下一轮首轮成功率优化素材”

新增 / 更新关键文件：
- `lib/intent-project-knowledge-draft.ts`
- `app/api/intent-e2e/project-knowledge/draft/route.ts`
- `lib/ai/intent-repair-memory.ts`
- `lib/intent-project-knowledge.ts`
- `tests/unit/intent-project-knowledge-draft.spec.ts`
- `tests/unit/api-intent-project-knowledge-draft-route.spec.ts`
- `.env.example`
- `README.md`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- P1.8：服务端 runId / 断线恢复 / 服务端停止，已完成
- P2.1：动作约束 DSL，已完成
- P2.3：高频动作库 + 新 runtime helper，已完成
- P2.4：修复记忆（失败聚类 + 策略回写），已完成
- P2.5：项目知识驱动裁剪，已完成
- P2.6：repair memory 反推项目规则草稿，已完成
- 下一步建议优先做：把草稿接到前端工作台、支持一键挑选合并、补更多 helper 与收益面板

---

## 2026-03-16 第八次更新（项目知识驱动裁剪已落地）
本次把“AI 自己写脚本”再往前推进成“AI 先理解这是哪个项目 / 哪类页面，再决定怎么写”：
- 已新增项目知识层，默认读取根目录 `intent-e2e.project-knowledge.json`
- 每条规则都可以按 URL、标题、正文、iframe URL、用户意图命中后，自动裁剪 DSL、补充动作库能力，并把项目级 Prompt 提示注入生成与 repair
- 这样做的重点不是再堆一层固定 Prompt，而是把“这个项目里某些页面必须怎么做”从代码里抽出来，后面优先改 JSON 规则文件就能持续提效
- 当前 generate / repair 流式事件里也会提示是否命中项目知识规则，方便你观察这层是否真的生效
- 这一步对“首轮生成成功率”帮助会比 repair memory 更直接，因为它在脚本第一次生成前就开始收敛模型自由度

新增 / 更新关键文件：
- `lib/intent-project-knowledge.ts`
- `intent-e2e.project-knowledge.json`
- `lib/test-generator.ts`
- `lib/intent-action-library.ts`
- `tests/unit/intent-project-knowledge.spec.ts`
- `tests/unit/intent-action-library.spec.ts`
- `tests/unit/test-generator.spec.ts`
- `.env.example`
- `README.md`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- P1.8：服务端 runId / 断线恢复 / 服务端停止，已完成
- P2.1：动作约束 DSL，已完成
- P2.3：高频动作库 + 新 runtime helper，已完成
- P2.4：修复记忆（失败聚类 + 策略回写），已完成
- P2.5：项目知识驱动裁剪，已完成
- 下一步建议优先做：继续沉淀项目规则、补更多业务 helper、做知识命中收益量化

---

## 2026-03-16 第七次更新（修复记忆已落地）
本次把“AI 自己修”继续往前推成“AI 记得自己以前怎么修”：
- 已新增轻量本地 `repair memory`，会对失败按类别 + 归一化错误签名聚类，而不是每次从零开始 repair
- repair 前会先检索历史相似失败，把 `常用修法 / 常见误区` 自动注入 Prompt，优先复用已经验证过的策略
- repair 成功后会把本次有效策略回写到记忆里，形成“越修越懂这个项目”的闭环
- 默认持久化到 `reports/intent-e2e-repair-memory.json`，也支持通过 `INTENT_E2E_REPAIR_MEMORY_PATH` 切换路径
- 这一步的目标不是暴露更多脚本给用户，而是让用户继续只给简单文本/图片，AI 在后台少走重复弯路

新增 / 更新关键文件：
- `lib/ai/intent-repair-memory.ts`
- `lib/ai/intent-e2e-service.ts`
- `lib/test-generator.ts`
- `tests/unit/intent-repair-memory.spec.ts`
- `tests/unit/intent-e2e-service.spec.ts`
- `tests/unit/test-generator.spec.ts`
- `README.md`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- P1.8：服务端 runId / 断线恢复 / 服务端停止，已完成
- P2.1：动作约束 DSL，已完成
- P2.3：高频动作库 + 新 runtime helper，已完成
- P2.4：修复记忆（失败聚类 + 策略回写），已完成
- 下一步建议优先做：项目知识驱动动作裁剪、更多业务 helper、修复收益量化

---

## 2026-03-16 第六次更新（高频动作库已落地）
本次把 DSL 再往前推进了一步，开始沉淀“AI 应该优先怎么写”：
- 已新增高频动作库层，把 DSL 里的高风险动作映射成可复用能力卡片（登录、下拉、行尾菜单、iframe、API 响应、变量提取）
- Prompt 现在不只告诉模型“不能乱写”，还会明确告诉它“优先用什么 helper / 代码骨架”
- runtime 也新增了 `__e2e.getFrame`、`__e2e.waitForApiResponse`，把 iframe 进入和关键接口等待从手写逻辑提升为可复用能力
- 这样做会直接减少模型重复发明脆弱 iframe 进入方式、漏注册响应等待、全局点击枚举值等问题

新增 / 更新关键文件：
- `lib/intent-action-library.ts`
- `lib/test-worker.mjs`
- `lib/test-generator.ts`
- `tests/unit/intent-action-library.spec.ts`
- `tests/unit/test-generator.spec.ts`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- P1.8：服务端 runId / 断线恢复 / 服务端停止，已完成
- P2.1：动作约束 DSL，已完成
- P2.3：高频动作库 + 新 runtime helper，已完成
- 下一步建议优先做：修复记忆、项目知识驱动动作裁剪、更多业务 helper

---

## 2026-03-16 第五次更新（动作约束 DSL 已落地）
本次开始把“AI 自己解决问题”从一句口号变成更可控的生成约束：
- 已新增 `Intent Action DSL`，把 ScenarioCard 步骤进一步收敛成“允许动作 / 优先 helper / 必须断言 / 禁止模式”
- 代码生成与修复 Prompt 现在都会自动注入 DSL，减少自由发挥导致的脚本漂移
- `ScenarioCard -> GenerateInput` 现在会产出 `scenarioSteps + actionDsl`，不再只有一段自由文本摘要
- DSL 已把高风险动作默认收敛到内置 helper（如 `__e2e.selectAntdOption`、`__e2e.clickAntdRowAction`）
- 这样做的目标不是让用户看 DSL，而是让 AI 写脚本时少走弯路、少发明不存在的操作路径

新增 / 更新关键文件：
- `lib/intent-action-dsl.ts`
- `lib/test-generator.ts`
- `lib/ai/scenario-card.ts`
- `tests/unit/intent-action-dsl.spec.ts`
- `tests/unit/test-generator.spec.ts`
- `tests/unit/scenario-card.spec.ts`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- P1.8：服务端 runId / 断线恢复 / 服务端停止，已完成
- P2.1：动作约束 DSL，已完成
- 下一步建议优先做：高频动作库、修复记忆、项目知识驱动 DSL 裁剪

---

## 2026-03-16 第四次更新（服务端 runId / 可恢复流式执行已落地）
本次继续把"用户不用懂脚本"这件事往前推了一步：
- 已新增服务端运行注册表：每次自动测试都会先创建 `runId`，由服务端后台持续执行
- 前端工作台 `/intent-e2e` 已切到 `runId + SSE` 模式，不再把整次运行绑定在单个请求生命周期上
- 页面现在会展示 `runId`，刷新页面后会自动尝试恢复当前运行和实时进度
- 停止当前测试已改为服务端 `cancel`，不再只是前端中断本地请求
- 浏览器实时画面能力继续保留，恢复订阅后仍可跟随最新 `sessionId` 展示
- 原有 `POST /api/intent-e2e` 和 `POST /api/intent-e2e/stream` 继续保留，作为 fallback / 调试入口

新增 / 更新关键文件：
- `lib/ai/intent-e2e-run-registry.ts`
- `app/api/intent-e2e/runs/route.ts`
- `app/api/intent-e2e/runs/[runId]/route.ts`
- `app/api/intent-e2e/runs/[runId]/stream/route.ts`
- `app/api/intent-e2e/runs/[runId]/cancel/route.ts`
- `components/IntentE2EWorkbench.tsx`
- `tests/unit/intent-e2e-run-registry.spec.ts`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- P1.8：服务端 runId / 断线恢复 / 服务端停止，已完成
- 下一步建议优先做：受限动作库、修复记忆、动作约束 DSL

---

## 2026-03-16 第三次更新（流式反馈已落地）
本次继续把“AI 亲密度高”的交互补到了执行过程本身：
- 已新增流式接口：`POST /api/intent-e2e/stream`
- 前端工作台 `/intent-e2e` 已改为使用 `fetch + SSE` 渐进消费，不再只能等整轮执行完一次性返回
- 用户现在可以在执行过程中实时看到：阶段状态、ScenarioCard、脚本生成事件、步骤反馈、执行日志、repair 尝试、浏览器实时画面和最终结果
- 用户现在也可以主动停止当前自动测试，后端会尽快中断 LLM 生成和 Playwright 执行
- 原有 `POST /api/intent-e2e` 仍保留，作为非流式 fallback

新增 / 更新关键文件：
- `app/api/intent-e2e/stream/route.ts`
- `lib/ai/intent-e2e-request.ts`
- `lib/ai/intent-e2e-service.ts`
- `components/IntentE2EWorkbench.tsx`
- `tests/unit/intent-e2e-service.spec.ts`

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- P1.5：流式执行反馈，已完成
- 下一步建议优先做：受限动作库、修复记忆、服务端 runId/断点恢复

---

## 2026-03-16 第二次更新（前端工作台已落地）
本次继续完成了 P1 的第一版实现：
- 已新增前端工作台页面：`/intent-e2e`
- 首页已新增快捷入口按钮
- 用户现在可以直接在页面里输入一句话、上传截图、填写可选登录信息，并发起自动测试
- 前端已支持临时覆盖 `provider / model / baseUrl / apiStyle / visionEnabled / selfHealRetries / maxPlanSteps`
- 后端已支持请求级 `llmConfig` 覆盖，不再只能依赖 `.env`

新增关键文件：
- `components/IntentE2EWorkbench.tsx`
- `app/intent-e2e/page.tsx`

新增 / 更新接口：
- `POST /api/intent-e2e`：新增 `llmConfig` 入参
- `GET /api/llm/config`：返回当前默认 provider 配置及可选 API Style

当前状态更新：
- P0：后端最小闭环，已完成
- P1：前端工作台第一版，已完成
- 下一步建议优先做：流式执行反馈、受限动作库、修复记忆

---


## 目标
当前阶段的目标不是让用户写 Playwright 脚本，而是让用户只提供：
- 一句简单需求描述
- 可选目标 URL
- 可选截图 / 参考图
- 可选登录信息

系统自动完成：
1. AI 理解意图
2. 生成结构化 `ScenarioCard`
3. 把 `ScenarioCard` 编译为脚本生成输入
4. 调用现有 Playwright 生成器产出脚本
5. 执行脚本
6. 失败时自动触发 AI repair
7. 把最终结果返回给用户

---

## 本次已落地内容

### 1) LLM provider 抽象骨架
新增文件：`lib/llm/provider-config.ts`

作用：
- 支持从 `.env` 读取统一的 `LLM_*` 配置
- 保留 `openai / gemini / claude` provider 位
- 当前只真正实现 `openai`
- 后续切模型时，主流程不需要重写

当前生效配置：
```env
LLM_PROVIDER=openai
LLM_MODEL=api-proxy-codex/gpt-5.3-codex
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_API_STYLE=responses
LLM_VISION_ENABLED=true
LLM_SELF_HEAL_RETRIES=2
LLM_MAX_PLAN_STEPS=8
```

说明：
- `gemini / claude` 现在只是“预留位”，如果切过去会明确报错，提醒 provider 尚未实现。
- 这样做是为了先用你现有模型跑通，再逐步补 provider adapter。

---

### 2) `llm-client` 升级
更新文件：`lib/llm-client.ts`

新增能力：
- 保留原有 `callLLM` / `callLLMStream`
- 新增 `callLLMStructured<T>()`
- 支持：
  - `Responses API` 的 `json_schema`
  - Chat Completions 的 `response_format=json_schema`
  - 图片输入（data URL）
- 新增 `getPublicLLMConfig()`，给未来前端配置页使用

设计原则：
- **文本生成** 和 **结构化规划** 分开
- **图片只参与理解与规划**，不直接作为执行控制源
- **执行稳定性仍由 Playwright 负责**

---

### 3) ScenarioCard 中间层
新增文件：`lib/ai/scenario-card.ts`

这是本次最关键的中间层。

职责：
- 把“用户一句话 + 图片”转成严格 JSON 的 `ScenarioCard`
- 把 `ScenarioCard` 再编译成现有生成器能吃的：
  - `description`
  - `GenerateTestContext`
  - `targetUrl`

`ScenarioCard` 的核心字段：
- `title`
- `taskMode`
- `targetUrl`
- `featureDescription`
- `flowDefinition`
- `successCriteria`
- `visualAnchors`
- `notes`

为什么需要它：
- 让 AI 先做“规划”，不要直接做“自由脚本执行”
- 把高不确定性的自然语言，收敛成稳定的结构化输入
- 后面要接 Gemini / Claude 时，也只需要改 `ScenarioCard` 生成器，而不是重写执行层

---

### 4) 意图驱动执行服务
新增文件：`lib/ai/intent-e2e-service.ts`

闭环流程如下：
1. `generateScenarioCard()`
2. `buildGenerateInputFromScenarioCard()`
3. `analyzePage()`
4. `generateTest()`
5. `executeTest()`
6. 如果失败：`repairTest()`
7. 再执行，直到成功或达到 `LLM_SELF_HEAL_RETRIES`

当前策略：
- 第一次为 `generate`
- 后续为 `repair`
- 每次都会记录：
  - 生成事件
  - 执行日志
  - 测试结果
  - 最终脚本

这是一个**不依赖 DB 的最小闭环**，适合先把“简单输入 -> 自动执行”跑通。

---

### 5) 新 API
新增接口：`POST /api/intent-e2e`

请求示例：
```json
{
  "input": "访问结算页，输入有效手机号并提交，看到提交成功页面",
  "targetUrl": "http://127.0.0.1:4173/checkout",
  "attachments": [
    {
      "name": "expected-success.png",
      "dataUrl": "data:image/png;base64,...",
      "purpose": "预期成功页"
    }
  ],
  "auth": {
    "loginUrl": "https://example.com/login",
    "username": "13800138000",
    "password": "123456",
    "loginDescription": "密码登录"
  }
}
```

返回：
- `scenarioCard`
- `llmMeta`
- `targetUrl`
- `description`
- `attempts`
- `finalResult`

补充接口：`GET /api/llm/config`
- 作用：给未来前端配置页读取当前 provider / model / apiStyle / vision 开关

---

## 为什么这版方案是当前最优解

### 不选择“纯自然语言直驱浏览器”
原因：
- 成功率不稳定
- 对 DOM / 弹窗 / iframe / waiting 时机非常敏感
- 每次失败都不容易诊断

### 不继续走“复杂多节点编排”
原因：
- 用户输入成本高
- 节点多了依然不能从根上解决 flaky
- 维护成本会越来越高

### 选择“ScenarioCard 中间层 + Playwright 执行层”
因为它兼顾了：
- 用户输入轻
- AI 亲密性高
- 执行层可控
- 可以失败自愈
- 后续方便切模型

一句话总结：
> AI 负责理解和修复，Playwright 负责点击和断言。

---

## 当前限制

### 1) 当前只实现了 OpenAI provider
虽然 env 已预留：
- `gemini`
- `claude`

但代码层目前只接了 `openai`。

后续接入方式建议：
- `lib/llm/provider-config.ts` 继续保留统一配置
- 新建：
  - `lib/llm/providers/openai.ts`
  - `lib/llm/providers/gemini.ts`
  - `lib/llm/providers/claude.ts`
- 再把 `llm-client.ts` 下沉到 provider adapter 层

### 2) 新接口还没接前端工作台
当前可以直接通过 API 调用。
下一步应该新增一个前端页面：
- 输入框
- 图片上传
- URL 输入
- 登录信息（可折叠）
- 执行按钮
- 执行结果面板

### 3) `ScenarioCard` 还比较通用
后续应该针对业务域继续强化：
- 登录
- 搜索
- 下单
- 表单提交
- 列表过滤
- 订单状态校验
- 后台审批流

如果继续迭代，建议加“领域动作库”，例如：
- `login`
- `open_checkout`
- `apply_coupon`
- `submit_order`
- `assert_order_created`

这样会比直接生成裸脚本更稳。

---

## 推荐的下一阶段迭代顺序

### P1：接前端工作台
目标：真正做到“用户只说一句话 / 传一张图就能跑”。

建议新增页面能力：
- 简单描述输入框
- 目标 URL 输入框
- 图片上传
- 登录信息折叠区
- 模型配置区（provider/model/baseUrl/vision/self-heal）
- 执行日志 / 尝试次数 / 最终结果卡片
- 脚本默认折叠显示

### P2：加入领域动作库
目标：提升成功率。

方法：
- 让 `ScenarioCard` 不直接生成低层操作意图
- 而是落到“受限动作”上
- 再由动作映射到稳定 Playwright 代码

### P3：失败聚类与修复记忆
目标：让系统越跑越稳。

建议：
- 记录 repair 前后的错误类型
- 聚类 locator 问题 / 下拉问题 / iframe 问题 / auth 问题
- 将修复经验沉淀到 prompt 或规则库

### P4：Provider 插件化
目标：OpenAI / Gemini / Claude 可切换。

建议：
- `ScenarioCard` 生成接口统一
- provider 只负责：
  - 普通文本
  - 结构化输出
  - 图片理解
- 主流程不感知底层模型差异

---

## 推荐的前端配置项
后续前端页面建议只暴露下面几个配置：
- `provider`
- `model`
- `baseUrl`
- `visionEnabled`
- `selfHealRetries`

不要让用户看到太多复杂选项。

原因：
- 用户的目标是“把测试跑起来”
- 不是学习 E2E 或 Prompt Engineering

---

## 当前关键文件清单
- `lib/llm/provider-config.ts`
- `lib/llm-client.ts`
- `lib/ai/scenario-card.ts`
- `lib/ai/intent-e2e-service.ts`
- `app/api/intent-e2e/route.ts`
- `app/api/llm/config/route.ts`
- `.env.example`
- `README.md`

---

## 你后面继续迭代时，建议优先遵守的原则
1. 不让用户写脚本。
2. 不让用户理解 Playwright。
3. 尽量不让用户配置多步骤节点。
4. AI 负责规划与修复，不直接无限自由操作浏览器。
5. 执行层保持确定性、可追踪、可回放。
6. 图片主要用于理解和诊断，不作为唯一执行依据。
7. 优先做“最短闭环”，而不是“最全能力”。

---

## 当前最小验收标准
当下面 4 条都满足时，说明这版 MVP 跑通：
- 用户只输入一句话，也能拿到 `ScenarioCard`
- 用户附加截图时，AI 能把截图信息吸收到 `successCriteria / visualAnchors`
- 系统能自动生成脚本并执行
- 执行失败后，系统至少能自动 repair 1~2 次
