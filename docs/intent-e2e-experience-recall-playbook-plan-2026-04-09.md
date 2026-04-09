# Intent E2E 经验召回与 Playbook 增量方案（2026-04-09）

## 文档目的

这份文档用于把对 `~/Workspace/hermes-agent/` 的审计结论，收敛成当前 `ai-test` 仓库可直接执行的后续开发方案。

目标不是整体引入 Hermes，也不是重写现有 `intent-e2e` 主链路，而是在已经完成的：

- `ScenarioCard`
- `ExecutionPlan / VerificationPlan`
- `compiledTemplate / structured patch`
- `repair memory`
- `project knowledge draft -> merge`
- `starter helper / recipe / failure pressure / benchmark`

基础上，补齐当前最缺的一层：

> 相似成功经验召回 + 程序性 playbook 资产 + run 结束后的异步复盘。

这份文档可直接作为后续开发文档使用，但定位是：

- `intent-e2e-success-hardening-plan-2026-04-01.md` 的后续专项
- 不替代 `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不重复定义已经落地的 `S1-S6`

## 当前结论

### 不建议整体引入 Hermes

当前仓库已经具备较完整的结构化执行与学习闭环，直接引入 Hermes 的通用 memory / skill / gateway 体系，会同时带来：

- 概念重叠
- 资产双写
- prompt 注入失控
- 项目隔离被破坏
- Playwright 测试隔离退化

更合理的做法是只借 4 类能力：

1. `experience search`：跨运行的相似经验召回
2. `playbook`：可审计、可回滚、项目作用域的程序性技能资产
3. `async review`：run 结束后的异步复盘沉淀
4. `OCR / visual anchors`：图片入口的结构化文字锚点增强

### 当前项目已经有很多基础设施，不要重复造轮子

后续方案必须显式复用这些现有能力：

- `lib/ai/intent-e2e-service.ts`
  - 已有精确命中的 `successful run code reuse`
  - 已有单 run 内 `shared session / storageState` 复用
  - 已有 `starterHelpers / recipePerformance / repairMemoryHints` 注入
  - 已有 `knowledgeCandidates` 产出
- `lib/ai/intent-repair-memory.ts`
  - 已有相似失败提示召回
- `lib/ai/intent-e2e-insights.ts`
  - 已有 `snapshotSignature` 聚类
  - 已有 repeated failure suppression 和 `failure pressure`
- `lib/test-generator.ts`
  - 已有 planning 上下文注入点
- `lib/intent-project-knowledge-draft.ts`
  - 已有 successful run 候选进入项目知识草稿
- `lib/intent-project-recipe-registry.ts`
  - 已有配方资产、审计和回滚治理
- `lib/intent-e2e-benchmark.ts`
  - 已有冻结基线、回放、对比报告

结论：

- 后续要补的是“经验召回层”和“程序性资产层”
- 不是再造一套新的通用 memory system

## 当前最真实的缺口

### 1. 现有成功复用太窄

当前 `successful run code reuse` 主要依赖：

- `intentDraftUid`
- `requestInput`
- `targetUrl`
- `attachmentCount`

这意味着：

- 同一页面、同一 family、同一业务目标，只要自然语言换个说法，就很容易失去复用命中
- 现有复用更像“完全相同请求的直复用”，不是“相似成功经验召回”

### 2. 现有学习闭环偏规则化，缺程序性 playbook

当前已有：

- `repair memory`
- `project knowledge`
- `starter helper`
- `recipe performance`
- `successful run knowledge candidate`

但还缺一层更靠近“这类任务如何稳定做”的程序性资产：

- 这类列表回查应先看什么证据
- 这类抽屉保存要带哪些等待
- 这类图片描述通常该落到哪个 family

### 3. 当前失败后虽能分流，但用户下一步仍不够明确

现在已经有：

- `launch decision`
- `failure pressure`
- `finalFailureTriage`
- `qualitySplit`
- `assetReadiness`

但还不够像“给用户明确的下一步建议”：

- 最相似的成功任务是什么
- 失败与成功差别在哪里
- 现在应该改描述、补 fixture、补 onboarding，还是转手动

### 4. 图片已接入多模态，但还未形成稳定的文字锚点层

`ScenarioCard` 已经支持 `attachments` 和 `visualAnchors`，方向正确；但如果截图里大量关键信息是文字、表头、标签、按钮态，当前仍主要依赖模型一次性理解图片，不够稳定。

## 与官方最佳实践的对齐判断

## OpenAI

对齐点：

- 强化结构化上下文，而不是继续堆大 prompt
- 用工具返回结构化 recall 结果，而不是把长历史全文硬塞回模型
- 用 benchmark / holdout / compare report 做 eval 驱动迭代

保护边界：

- 不把历史成功脚本全文直接回灌 prompt
- 不在没有 benchmark 的情况下主观宣称“成功率大幅提升”

## Claude / Anthropic

对齐点：

- 更强调 context engineering，而不是“长期记忆神话”
- 复杂链路继续采用简单、可组合、可观测的 workflow
- 把 run 后复盘做成异步 review，而不是阻塞主路径

保护边界：

- 不引入面向“用户人格 / 自我认知”的长期 memory
- 不让记忆系统直接控制执行逻辑

## Playwright

对齐点：

- 继续保持稳定 locator、稳定 verifier、显式前置条件和可解释的断言证据
- 经验召回只应影响“怎么规划 / 该优先尝试什么”，不应破坏测试隔离
- 成功经验复用必须继续走受控脚手架、受控 helper、受控 verifier

保护边界：

- 不做跨 run `storageState` 污染式复用
- 不把历史页面脏状态当成 fixture
- 不把“一次跑通过”的动态脚本直接视为长期通用模板

## 对成功率的现实预期

先给结论：

- 不承诺“一句自然语言 + 图片”稳定 `95%-100%`
- 如果当前真实 `AI生成` holdout 成功率在 `50%-60%`，这套增量方案的现实目标更接近 `70%-85%`
- 若数据环境、locator 质量、业务主键证据和 fixture 契约不足，再好的 recall 也无法把成功率硬拉到 `90%+`

工程估算建议按下面理解：

- 仅做 `E1 experience recall MVP`
  - `terminal_pass_rate` 预计 `+6~15` 个百分点
  - `first_pass_rate` 预计 `+10~20` 个百分点
- 再叠加 `E2 playbook`
  - 在 top families 上，额外带来 `+5~12` 个百分点提升
- `E3 async review`
  - 主要价值不是立刻抬高单次通过率，而是降低“同类失败重复发生”的速度
- `E4 OCR`
  - 只对图片占比较高、且关键信号主要在截图文字中的任务带来小幅收益，优先级低于 `E1/E2/E3`

注意：

- 上面是工程评估，不是当前仓库已经验证过的数据
- 真正是否提升，只能由冻结 benchmark 和 holdout 回放决定

## 方案边界

### 本方案要做的

- 提高同页面、同 family、相近意图任务的首轮命中率
- 让成功经验以结构化摘要和受控资产形式进入后续规划
- 让 run 失败后给出更明确的下一步动作
- 保持项目作用域、可审计、可回滚

### 本方案不做的

- 不整体引入 Hermes agent runtime
- 不增加通用 persona memory / user profile
- 不引入自由格式 Markdown 技能直接生效
- 不重写为 browser agent 自由探索主链路
- 不靠增加 repair 次数来提升成功率
- 不破坏 Playwright 隔离和数据独立性

## 切片总览

- `E1`：experience recall MVP
- `E2`：project-scoped playbook candidate / promotion
- `E3`：post-run async review
- `E4`：OCR / structured visual anchors enhancement（可选）

当前阶段状态：

- `E1`：已完成（MVP）
- `E2`：已完成（project-scoped recipe promotion / merge；不做 knowledge draft 双写）
- `E3`：已完成（run 终态后异步补写 review）
- `E4`：未开始（可选）

## E1：Experience Recall MVP

### 目标

把当前“完全相同请求才可复用”的成功脚本复用，扩成“相似成功经验召回”。

### 为什么先做这一刀

这是当前最缺、收益也最直接的一层：

- 不需要推翻执行链路
- 不需要新造独立治理系统
- 能直接减少“换个说法就从零生成”的浪费

### 设计原则

1. 只返回结构化摘要，不返回长历史全文。
2. 只做项目作用域 recall，首版不做跨项目全局检索。
3. 只给 planner / generator / repair 提供“经验提示”，不直接接管执行。
4. 相似失败也可以召回，但只作为“避坑提示”，不能覆盖成功经验。

### 建议数据结构

建议新增 `IntentExperienceHint` 一类轻量结构，字段可包括：

- `sourceRunId`
- `projectUid`
- `moduleUid`
- `scenarioFamily`
- `targetPath`
- `matchScore`
- `matchedSignals`
- `requestSummary`
- `chosenRecipeSlugs`
- `chosenHelpers`
- `verifierStrategySummary`
- `stableEntityHints`
- `pitfalls`
- `outcome`

要求：

- 禁止包含整段历史代码
- 最多带少量关键片段摘要
- 若后续需要脚手架复用，应引用现有 `recipe / helper / knowledge` 资产，而不是内嵌自由代码

### 检索信号建议

建议至少组合这些信号：

- `projectUid`
- `moduleUid`
- `targetPath / targetUrl`
- `scenarioFamily`
- `requiredActions`
- `visualAnchors`
- `title / summary / successCriteria` 中的关键实体词
- `matchedRecipeSlugs`
- `snapshotSignature` 近邻

### 建议落点

首版建议新增轻量 helper，而不是改数据库 schema：

- 新增：
  - `lib/intent-e2e-experience-search.ts`
- 修改：
  - `lib/ai/intent-e2e-service.ts`
  - `lib/test-generator.ts`
  - `tests/unit/intent-e2e-experience-search.spec.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/test-generator.spec.ts`

### 首版验收标准

- 同项目、同页面、同 family、自然语言改写后的请求，能够命中结构化经验提示。
- planner / generator / repair prompt 中能够稳定拿到 `experienceHints`。
- 经验提示命中不会污染无关 family，不会无条件覆盖现有 recipe / knowledge。
- 与当前 exact-match successful run reuse 共存，且 exact-match 仍优先。

### 首版验证

- `npm run build`
- `npx vitest run tests/unit/intent-e2e-experience-search.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/test-generator.spec.ts`

### 需要补记的指标

- `experience_hit_rate`
- `experience_helped_first_pass_rate`
- `experience_helped_terminal_pass_rate`
- `top_failure_reasons`

## E2：Project-Scoped Playbook Candidate / Promotion

### 目标

把“成功经验摘要”中的稳定部分，提升成可审计、可回滚、项目作用域的程序性资产。

### 为什么不直接照搬 Hermes Skill

Hermes 的 `skill_manage` 更适合通用 agent 的自由技能沉淀；当前仓库更需要的是：

- 项目作用域
- 结构化 schema
- 明确审计
- 明确回滚
- 与现有 `recipe registry / project knowledge / starter helper` 治理面兼容

所以首版不应新增自由 Markdown skill 文件。

### 设计原则

1. 优先复用现有 `recipe registry` 和 `project knowledge draft`。
2. 首版允许“候选态”，不要求自动发布。
3. 一切 playbook 都必须可追溯到真实 `sourceRunIds`。
4. 没有稳定命中证据的经验，不应直接提级为 playbook。

### 建议 playbook 结构

可以先作为轻量候选结构存在，字段建议包括：

- `slug`
- `title`
- `scenarioFamily`
- `matchers`
- `preconditions`
- `executorPlan`
- `verifierPlan`
- `preferredHelpers`
- `knownPitfalls`
- `sourceRunIds`
- `successRate`
- `lastVerifiedAt`
- `promotionStatus`

落点建议：

- 能落到 `recipe` 的，优先进入 `recipe registry`
- 更偏 verifier / evidence / detail hints 的，优先进入 `project knowledge`
- 更偏基础动作复用的，继续走 `starter helper`

### 建议落点

- 优先复用：
  - `lib/intent-project-recipe-registry.ts`
  - `lib/intent-project-knowledge-draft.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-project-recipe-registry.spec.ts`
  - `tests/unit/intent-project-knowledge-draft.spec.ts`
- 仅在抽象重复时，再补一个轻量 helper：
  - `lib/intent-e2e-playbook.ts`

### 首版验收标准

- top family 的成功 run 能生成结构化 playbook candidate。
- playbook candidate 可进入现有草稿 / 合并治理链路，不新造第二套人工流程。
- 后续相似任务命中 playbook 时，能以结构化方式影响 recipe / verifier / helper 选择。
- playbook 回滚和审计仍走现有资产治理方式。

### 首版验证

- `npm run build`
- `npx vitest run tests/unit/intent-project-recipe-registry.spec.ts tests/unit/intent-project-knowledge-draft.spec.ts tests/unit/intent-e2e-service.spec.ts`

### 需要补记的指标

- `playbook_candidate_count`
- `playbook_promoted_count`
- `playbook_hit_rate`
- `recipe_hit_rate`
- `untracked_rate`

## E3：Post-Run Async Review

### 目标

长期目标是把 run 完成后的“经验提炼 / 失败复盘 / 下一步动作建议”做成异步链路；首刀先挂在 run tail 产出结构化 review，不新增后台 worker。

### 设计原则

1. 长期目标是 async review；首刀先同步挂在 run tail，控制为纯结构化摘要生成，不重新执行浏览器动作。
2. review 只读取 run 产物，不重新执行浏览器动作。
3. review 输出必须结构化，可被 UI、知识草稿和治理层消费。
4. 继续复用现有 `failure pressure / finalFailureTriage / knowledgeCandidates / repair memory`。

### 最小输出建议

首版 review 只产出 3 类信息：

- `experienceCandidate`
  - 哪些经验值得下次 recall
- `playbookCandidate`
  - 哪些稳定步骤值得提级
- `nextStepAdvice`
  - 对用户这次失败，最推荐的下一步是什么

### 建议落点

- 新增：
  - `lib/intent-e2e-run-review.ts`
- 修改：
  - `lib/ai/intent-e2e-service.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/intent-e2e-run-registry.spec.ts`
  - `tests/unit/intent-e2e-service.spec.ts`

### 首版验收标准

- 首刀不新增后台 worker，且 review 只消费已有 run 产物。
- 成功 run 能沉淀结构化经验候选。
- 失败 run 能产出明确的下一步动作建议，而不是只剩抽象总结。
- 用户在 workbench 上能看到“最相似成功 / 失败经验摘要”或“建议动作”中的至少一种。

### 首版验证

- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-run-review.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-run-registry.spec.ts`

### 需要补记的指标

- `review_write_rate`
- `review_surface_rate`
- `cta_accept_rate`
- `repeated_failure_reopen_rate`

## E4：OCR / Structured Visual Anchors Enhancement（可选）

### 目标

让图片不只是“被模型看过”，而是先转成更稳定的文字锚点和结构化页面线索。

### 为什么优先级低于 E1-E3

- 当前最大浪费源不是“看不懂图”，而是“没有相似成功经验召回”
- OCR 只对一部分图片密集任务有价值
- 若 OCR 直接上主链路，容易引入额外延迟

### 设计原则

1. 只在有附件时触发。
2. 首版只做轻量 OCR / 文字摘要，不做复杂视觉 agent。
3. OCR 结果只用于 family 路由、`visualAnchors` 和 `clarify signal`，不直接决定执行细节。
4. 无附件任务不能承担任何额外成本。

### 建议落点

- 新增：
  - `lib/ai/intent-attachment-ocr.ts`
- 修改：
  - `lib/ai/scenario-card.ts`
  - `tests/unit/scenario-card.spec.ts`

### 首版验收标准

- 附图任务可输出更稳定的文字锚点摘要。
- OCR 只增强 `visualAnchors / family routing / clarify signal`，不与执行主链路职责冲突。
- 无附件任务的生成延迟不受影响。

### 首版验证

- `npm run build`
- `npx vitest run tests/unit/scenario-card.spec.ts`

### 需要补记的指标

- `ocr_used_rate`
- `image_route_hit_rate`
- `needs_clarify_rate`

## Benchmark 与固定度量

后续每一刀都必须走 benchmark，对齐 `lib/intent-e2e-benchmark.ts`，不能只凭真实 run 的零散感受判断。

### 推荐基线冻结方式

建议先冻结一套真实 `AI生成` holdout，至少满足：

1. `30-50` 条真实任务
2. 优先选最近一段时间的运行
3. 尽量排除已经被人工长期调过的“历史脚本型”任务
4. 覆盖 top families
5. 至少包含一部分“自然语言改写但页面目标相同”的任务
6. 若要评估 `E4`，必须单独包含“图片是主要输入信号”的样本

### 固定指标

必须持续记录：

- `first_pass_rate`
- `terminal_pass_rate`
- `blocked_rate`
- `top_failure_reasons`

按切片追加记录：

- `E1`
  - `experience_hit_rate`
  - `experience_helped_first_pass_rate`
  - `experience_helped_terminal_pass_rate`
- `E2`
  - `playbook_hit_rate`
  - `recipe_hit_rate`
  - `untracked_rate`
- `E3`
  - `review_write_rate`
  - `cta_accept_rate`
  - `repeated_failure_reopen_rate`
- `E4`
  - `ocr_used_rate`
  - `image_route_hit_rate`
  - `needs_clarify_rate`

## 推荐开发顺序

1. `E1`
   - 先补 recall MVP，再看 benchmark 是否显著改善“自然语言改写后失去复用”的问题。
2. `E2`
   - 仅在 `E1` 已证明 recall 有帮助后，再把稳定经验提级成受控 playbook。
3. `E3`
   - 在 `E1/E2` 基础上接入异步复盘和更清晰的下一步建议。
4. `E4`
   - 只有当图片输入确实是当前高频失败源时再做。

## 每刀开工前的固定要求

每个切片真正开始开发前，必须：

1. 按 `docs/task-brief-template.md` 写该切片的 Task Brief。
2. 明确“会改 / 不会改”的文件边界。
3. 明确 benchmark 对比口径。
4. 完成后同步更新：
   - 本文档阶段状态
   - 对应的 roadmap 最新进度

## 不做项

- 不把 Hermes 的 persona memory、user profile、social / gateway / cron 能力带入当前仓库
- 不把完整历史 transcript 或完整成功脚本全文塞回 prompt
- 不把跨 run session / cookies / storageState 当作成功率提升手段
- 不引入第二套自由格式 skill 文件治理系统
- 不在没有 benchmark 的情况下宣称“AI生成已能稳定 90%+”

## 最终判断

如果只问一句：“Hermes 里哪些东西最值得借到当前 `intent-e2e` 项目里？”

答案是：

1. `experience search`
2. `project-scoped playbook`
3. `post-run async review`
4. `OCR / visual anchors`

如果再问一句：“这些方向能不能把 `AI生成` 提升到稳定 `95%-100%`？”

答案仍然是否定的。

但如果当前项目愿意按本文顺序，把相似经验召回、程序性资产沉淀、异步复盘和 benchmark 闭环真正做完，那么它们是当前最符合官方实践、也最可能带来真实成功率提升的一组增量改造。

## 2026-04-09 首刀回写

- 本轮目标：
  - 严格按本文先完成 `E1 recall MVP`。
  - `E2` 只落 `playbook candidate`，不扩自动 promotion / registry 双写。
  - `E3` 先落最小 `run review`，不新开后台 worker。
- 已完成：
  - 新增 `lib/intent-e2e-experience-search.ts`，基于项目 terminal run snapshot 产出结构化 `IntentExperienceHint[]`，只回传摘要、helper、recipe、verifier 策略、stable entity 和 pitfalls。
  - 在 `lib/ai/intent-e2e-service.ts` 把 experience recall 接进 planning 前置阶段，并把 `experienceHints` 注入 `resolveIntentPromptPlanningContext(...)`。
  - 在 `lib/test-generator.ts` 把相似经验摘要接进 generation / repair prompt 与 thinking message。
  - 新增 `lib/intent-e2e-run-review.ts`，把成功 run 收口为 `playbook candidate`，把失败 run 收口为 `nextStepAdvice`。
  - 在 `lib/ai/intent-e2e-run-registry.ts`、`components/IntentE2EWorkbench.tsx` 补齐 `experience / review` 的 clone、归一化和最小展示卡片。
  - 补齐：
    - `tests/unit/intent-e2e-experience-search.spec.ts`
    - `tests/unit/intent-e2e-run-review.spec.ts`
    - `tests/unit/test-generator.spec.ts`
    - `tests/unit/intent-e2e-service.spec.ts`
    - `tests/unit/intent-e2e-run-registry.spec.ts`
- 验证：
  - `npx vitest run tests/unit/intent-e2e-experience-search.spec.ts tests/unit/intent-e2e-run-review.spec.ts tests/unit/test-generator.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-run-registry.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
- 当前阶段状态：
  - `E1`：已完成（MVP）
  - `E2`：已完成首刀（candidate-only，不自动写入 registry）
  - `E3`：已完成（run 终态后异步补写 review）
  - `E4`：未开始（可选）
- 风险 / 未完成：
  - `E2` 目前只生成 candidate，尚未进入 recipe / knowledge 的 promotion 治理闭环。
  - `E3` 当前仍依赖 terminal 后短轮询补拿 review，没有新增专用 stream 事件。
  - 当前没有新增 benchmark 数据，本轮只完成结构和最小回归验证。
- 下一步：
  - 优先把 `E2 candidate -> registry / knowledge draft` 的 promotion 与回滚治理打通。
  - 再补 benchmark / holdout 回放，验证 recall + async review 的真实收益。

## 2026-04-09 第二刀回写（E2 project-scoped recipe promotion 已落地）

- 本轮目标：
  - 严格按本文只完成 `E2` 的最小闭环：
    - 把 `intent-project-recipe-registry` 补成真正的 `project-aware` 资产读写
    - 把 `playbookCandidates` 接到现有项目 `recipe merge` 治理链路
  - 不扩 `E4 OCR`，不新增 DB schema，不新增 route，不为 playbook 再造第二套治理流。
- 已完成：
  - 新增 `lib/intent-e2e-playbook.ts`，把 `playbook candidate` 受控转换为 `IntentProjectRecipeMergeInput[]`。
  - 在 `lib/intent-project-recipe-registry.ts` 接入 `resolveProjectScopedIntentAssetStorage(...)`，让项目 recipe 的 registry / backup / audit 都落到项目作用域；项目上下文下不再继续写全局 legacy 文件。
  - 在 `lib/intent-recipe-registry.ts`、`lib/test-generator.ts`、`lib/intent-project-recipe-governance.ts` 透传 `projectUid`，让 planning / governance 只消费当前项目 recipe。
  - 在 `app/api/projects/[projectUid]/intent-recipes/**` 改为显式走项目作用域 registry / backup / audit path，复用现有 merge / restore / audit 流程，不新增 route。
  - 在 `components/IntentE2EWorkbench.tsx` 为“运行复盘 -> Playbook Candidates”补充“沉淀到项目 Recipe”入口，直接复用现有 `/api/projects/[projectUid]/intent-recipes` merge 能力。
  - 在 `lib/intent-e2e-run-review.ts` 修正 `#/hash-route` 归一化，避免 `playbook / run review` 把 `#/business/createbusiness` 误退化成 `/`，影响 recipe 命中。
  - 补齐：
    - `tests/unit/intent-e2e-playbook.spec.ts`
    - `tests/unit/intent-project-recipe-registry.spec.ts`
    - `tests/unit/api-project-intent-recipes-route.spec.ts`
    - `tests/unit/api-project-intent-recipes-backups-route.spec.ts`
    - `tests/unit/api-project-intent-recipes-backup-restore-route.spec.ts`
    - `tests/unit/api-project-intent-recipes-audits-route.spec.ts`
    - `tests/unit/intent-recipe-registry.spec.ts`
    - `tests/unit/intent-project-recipe-governance.spec.ts`
    - `tests/unit/test-generator.spec.ts`
- 验证：
  - `npx vitest run tests/unit/intent-e2e-playbook.spec.ts tests/unit/intent-project-recipe-registry.spec.ts tests/unit/api-project-intent-recipes-route.spec.ts tests/unit/api-project-intent-recipes-backups-route.spec.ts tests/unit/api-project-intent-recipes-backup-restore-route.spec.ts tests/unit/api-project-intent-recipes-audits-route.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-project-recipe-governance.spec.ts`
  - `npx vitest run tests/unit/test-generator.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - 结果：
    - `9` 个测试文件通过，`119/119 passed`
    - `build` 通过
    - `build:web` 通过
    - 文档链接校验通过
- 当前阶段状态：
  - `E1`：已完成（MVP）
  - `E2`：已完成（project-scoped recipe promotion / merge）
  - `E3`：已完成（run 终态后异步补写 review）
  - `E4`：未开始（可选）
- 风险 / 未完成：
  - 本轮只把 `playbook candidate -> project recipe merge` 打通，没有把同一批 candidate 再双写到 `knowledge draft`；知识仍继续复用现有 `successful run knowledgeCandidates` 入口。
  - `playbook promotion` 当前仍是 workbench 上的人工触发，不做自动发布。
  - 当前还没有新增 benchmark / holdout 回放数据，无法量化 `E2` promotion 对真实首过率的提升幅度。
- 下一步：
  - 优先补 benchmark / holdout 回放，验证 `E1 recall + E2 recipe promotion + E3 async review` 的真实收益。
  - 若后续证据显示 verifier / detail hints 仍有明显空缺，再按 typed 结构把少量 playbook 经验补进 `knowledge draft`，而不是直接做双写。

## 2026-04-09 第三刀回写（benchmark 固定指标口径已补齐）

- 本轮目标：
  - 严格按本文只补 `benchmark / compare report` 的固定指标口径：
    - `blocked_rate`
    - `E1`：`experience_hit_rate / experience_helped_first_pass_rate / experience_helped_terminal_pass_rate`
    - `E2`：`playbook_hit_rate / recipe_hit_rate / untracked_rate`
    - `E3`：`review_write_rate`
  - 不改主运行链路，不新增 route / script / DB schema。
- 已完成：
  - 在 `lib/ai/intent-e2e-insights.ts` 的 terminal run normalize 过程中补出 benchmark 所需的结构化信号：
    - `experienceHintCount / experienceMatchedRunCount / experienceHit`
    - `reviewWritten / reviewPlaybookCandidateCount`
  - 新增导出 `buildIntentE2EFailureClassStatsFromRuns(...)`，供 benchmark 复用现有 failure class 聚合口径，而不是复制第三套实现。
  - 在 `lib/intent-e2e-playbook.ts` 新增 `isIntentPlaybookRecipeSlug(...)`，统一 `E2 playbook hit` 的受控 slug 识别。
  - 在 `lib/intent-e2e-benchmark.ts` 补齐 suite / replay / compare report 指标：
    - `blockedRate`
    - `experienceHitRate`
    - `experienceHelpedFirstPassRate`
    - `experienceHelpedTerminalPassRate`
    - `recipeHitRate`
    - `playbookHitRate`
    - `untrackedRate`
    - `reviewWriteRate`
    - `frozenTopFailureReasons / currentTopFailureReasons`
  - compare report 现在会把这些辅助指标一起写进 `summary / delta / comparisonNote`；同时保持旧 benchmark 文件可读。
  - 补齐：
    - `tests/unit/intent-e2e-benchmark.spec.ts`
    - `tests/unit/intent-e2e-insights.spec.ts`
- 验证：
  - `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-insights.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
  - 结果：
    - `2` 个测试文件通过，`48/48 passed`
    - `build` 通过
    - `build:web` 通过
    - 文档链接校验通过
    - roadmap 进度校验通过
- 当前阶段状态：
  - `E1`：已完成（MVP）
  - `E2`：已完成（project-scoped recipe promotion / merge）
  - `E3`：已完成（run 终态后异步补写 review）
  - `E4`：未开始（可选）
  - benchmark 口径：已补齐 `blocked_rate` 和当前可直接从 terminal run 推导出的 `E1/E2/E3` 固定指标
- 风险 / 未完成：
  - 本轮只补了 benchmark 口径，还没有真正冻结一套新的 `AI生成 holdout` 并跑 compare report，所以仍不能声称已有量化收益。
  - `E3` 的 `cta_accept_rate / repeated_failure_reopen_rate` 还没有稳定交互回执输入，本轮未纳入 benchmark。
  - `playbook_hit_rate` 当前按受控 `intent.*` slug 约定统计，没有额外引入 recipe provenance schema。
- 下一步：
  - 先冻结一套真实 `AI生成 holdout`，跑一次 benchmark compare，拿到 `E1/E2/E3` 的第一版量化结果。
  - 再决定是否需要补单独的 benchmark 触发脚本或 workbench 入口；这不在本轮范围内。

## 2026-04-09 第四刀回写（benchmark holdout CLI 已补齐）

- 本轮目标：
  - 严格按本文下一步，只补一层 repo-owned benchmark CLI，给真实 `AI生成 holdout` 的 `candidates / freeze / replay / compare` 提供稳定入口。
  - 全量复用现有 `lib/intent-e2e-benchmark.ts` 能力，不新增 route，不改主运行链路，不补 workbench UI。
- 已完成：
  - 新增 [docs/intent-e2e-benchmark-cli-task-brief-2026-04-09.md](/Users/xiaolongbao/Workspace/ai-test/docs/intent-e2e-benchmark-cli-task-brief-2026-04-09.md)，把本刀目标、范围、验收与验证命令固定下来。
  - 新增 [scripts/intent-e2e-benchmark.ts](/Users/xiaolongbao/Workspace/ai-test/scripts/intent-e2e-benchmark.ts)，提供：
    - `candidates`
    - `freeze`
    - `replay`
    - `compare`
  - 新增 [scripts/ts-alias-loader.mjs](/Users/xiaolongbao/Workspace/ai-test/scripts/ts-alias-loader.mjs) 与 [scripts/register-ts-alias-loader.mjs](/Users/xiaolongbao/Workspace/ai-test/scripts/register-ts-alias-loader.mjs)，让 Node `--experimental-strip-types` 入口稳定解析：
    - `@/` alias
    - 仓库内无扩展名的相对 TS import
  - 在 [package.json](/Users/xiaolongbao/Workspace/ai-test/package.json) 补齐：
    - `intent:benchmark:candidates`
    - `intent:benchmark:freeze`
    - `intent:benchmark:replay`
    - `intent:benchmark:compare`
  - 在 [README.md](/Users/xiaolongbao/Workspace/ai-test/README.md) 与 [docs/runbook.md](/Users/xiaolongbao/Workspace/ai-test/docs/runbook.md) 补充 benchmark holdout 的最小使用说明。
- 验证：
  - `npm run intent:benchmark:candidates -- --help`
  - `npm run intent:benchmark:freeze -- --help`
  - `npm run intent:benchmark:replay -- --help`
  - `npm run intent:benchmark:compare -- --help`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
  - 结果：
    - `4` 个 CLI 子命令帮助输出通过
    - `build` 通过
    - `build:web` 通过
    - 文档链接校验通过
    - roadmap 进度校验通过
- 当前阶段状态：
  - `E1`：已完成（MVP）
  - `E2`：已完成（project-scoped recipe promotion / merge）
  - `E3`：已完成（run 终态后异步补写 review）
  - `E4`：未开始（可选）
  - benchmark 入口：已补齐最小 CLI，可重复执行 `holdout freeze / replay / compare`
- 风险 / 未完成：
  - 本轮只补“命令入口”，还没有在真实 scope 上冻结一套新的 `AI生成 holdout` 并产出 compare report，因此仍没有新的量化收益结论。
  - 当前不提供 route / workbench benchmark 入口；仍以 repo 内命令为准。
  - `playbook_hit_rate` 仍按现有受控 `intent.*` slug 约定统计，没有额外扩 provenance schema。
- 下一步：
  - 用真实项目 scope 跑一版 `candidates -> freeze -> compare`，拿到 `E1/E2/E3` 的首份真实量化结果。
  - 再决定是否需要补 workbench 入口；这不在当前最小切口范围内。
