# 2026-03-12 开发交接记录

## 概览

今天的工作主要集中在 4 个方向：

1. 需求编排工作台继续收口，增强知识 / 能力维护体验。
2. 编排结果支持“按需选择能力后再生成任务草稿”。
3. 历史测试计划可恢复为当前脚本版本。
4. 修复“通讯录”任务被误生成为“创建商机并生成订单”脚本的问题。
5. 修复“通讯录”任务在 `v4 / v5` 上的执行失败，并落地稳定模板。

本文档用于后续续接开发，不是对外说明。

## 今天已完成

### 1. 需求编排工作台

- 知识文档预览增加搜索框，支持按标题、正文、关键词筛选切块结果。
- 稳定能力目录默认只展示 `active` 能力，归档能力不再进入目录列表。
- 稳定能力目录布局从每行 2 个提升为每行 4 个：
  - `sm:grid-cols-2 lg:grid-cols-4`
- 顶部 3 个页签已经收敛为：
  - `需求编排`
  - `知识文档`
  - `稳定能力`

相关文件：

- `components/ProjectIntentWorkbench.tsx`

### 2. 编排结果支持选择能力

用户在“需求编排”输入一句需求后，recipe 返回的命中能力不再是只能读的结果，而是可以勾选/取消。

当前行为：

- 默认选中本次 recipe 命中的全部能力。
- 用户取消某个能力时，会递归移除依赖它的已选能力，避免生成不可执行的计划。
- 用户重新勾选某个能力时，会自动补回它依赖的前置能力。
- 页面中的执行步骤、覆盖率、断言、任务草稿预览会随着选择结果实时重算。
- 如果用户把能力全部取消，则阻止写入任务草稿，并提示：
  - `请至少选择一个能力后再生成测试计划。`

实现方式：

- 在前端维护 `selectedRecipeCapabilitySlugs`
- 引入纯函数 `applyCapabilitySelectionToRecipe`
- 基于 `effectiveRecipe` 而不是原始 `recipeResponse.recipe` 生成草稿

相关文件：

- `components/ProjectIntentWorkbench.tsx`
- `lib/project-knowledge.ts`
- `tests/unit/project-knowledge.spec.ts`

### 3. 历史脚本恢复为当前版本

已经支持把某个历史计划恢复为当前最新脚本版本，而不是只能查看历史。

当前实现：

- API:
  - `POST /api/test-plans/[planUid]/restore`
- Service:
  - `restoreHistoricalPlanAsLatest(planUid)`
- 行为：
  - 如果选择的历史版本已经是当前最新版本，则直接复用。
  - 否则会基于历史计划内容创建一个新的最新版本，保留脚本和用例。
  - 写入项目活动日志，`actionType = plan_restored_from_history`

相关文件：

- `app/api/test-plans/[planUid]/restore/route.ts`
- `lib/services/test-plan-service.ts`
- `tests/integration/plan-restore-api.spec.ts`
- `tests/unit/api-test-plan-restore-route.spec.ts`
- `tests/unit/test-plan-service.spec.ts`

### 4. 修复“通讯录”任务误命中 createOrder 模板

#### 现象

任务名称：

- `通讯录`

任务描述：

- `商机列表，随机勾选一个商机，点击【批量加入通讯录】按钮，被勾选的商机的联系人信息将进入我的通讯录列表`

错误执行：

- `exec_1773310681323_acfbd935`

错误表现：

- 任务本身的 `feature_description` 和 `generation_prompt` 都是“批量加入通讯录”
- 但生成出来的 `plan_code` 第一行却是：
  - `test('创建商机并生成订单：以 createOrder 成功为主断言', ...)`

说明问题发生在“生成计划”阶段，而不是执行阶段拿错了任务。

#### 根因

根因在 `lib/test-generator.ts` 里的“专门模板复用”逻辑。

旧逻辑的问题：

- `looksLikeBusinessCreateOrderTask(...)` 会把页面正文、页面 URL、页面标题一起塞进匹配 haystack。
- 商机列表页本身可能同时出现：
  - `商机`
  - `/business/businesslist`
  - `生成订单`
- 于是像“批量加入通讯录”这种不相关任务，只要落在商机列表页，也会被误判成“创建商机并生成订单”。

#### 修复

已把专门模板命中规则收紧为“按任务意图判定”，不再被页面正文噪音误伤：

- 新增 `buildIntentHaystack(...)`
- `looksLikeBusinessCreateOrderTask(...)` 只看：
  - 任务描述
  - scenario summary
  - expected outcome
  - cleanup notes
  - shared variables
- `looksLikeBusinessCreateTask(...)` 也不再把 `/business/businesslist` 或普通“商机”页面当成“创建商机”任务依据

补充的回归测试：

- unrelated business-list task 不应复用 `create-business-order` 模板
- unrelated business-list task 的 prompt 不应注入 `createOrder` 规则

相关文件：

- `lib/test-generator.ts`
- `tests/unit/test-generator.spec.ts`

### 5. 修复“通讯录”任务 v4 / v5 执行失败

#### 失败经过

- `v4`
  - `exec_1773314228882_16f1096c`
  - 报错：`getByRole('button', { name: '批量加入通讯录' })` 10 秒内不可见
- `v5`
  - `exec_1773314279321_ca21d059`
  - 来自 AI 纠错
  - 报错：对整页 `body` 做 `toContainText('首页商机列表')`，被首页初始化内容干扰，继续失败

#### 实际根因

不是“批量加入通讯录”按钮不存在，而是脚本时序和断言策略不稳：

1. 登录后立即切 `#/business/businesslist`，会和首页初始化的 hash 路由竞争。
2. 直接断言“批量加入通讯录按钮立刻可见”偶发失败。
3. AI 纠错把问题改坏了，开始对整页 `body` 做宽泛文本断言。
4. 这条业务还有一个真实业务特性：
   - 选中的联系人可能本来就已经在“我的通讯录”里
   - 因此不能把“成功新增 toast”当成唯一成功条件

#### 本次修复

在 `lib/test-generator.ts` 新增了“商机列表批量加入通讯录”的确定性模板：

- 登录后先等待首页稳定，再跳转商机列表
- 等待 `#businessList_keywords` 和 `批量加入通讯录` 按钮真实可见
- 从当前页前 10 条唯一手机号商机里随机取一条
- 勾选行后点击 `批量加入通讯录`
- 允许两类业务反馈：
  - 成功加入通讯录
  - 已存在通讯录 / 未成功加入通讯录
- 最终统一跳到 `#/mails/mailslist`
- 用 `#mail-list_keywords` 按手机号检索
- 以“通讯录结果中能查到该手机号”为最终断言

同时补了对应单测，保证后续生成和 AI 纠错都会优先落到这份稳定模板，而不是再走通用生成。

相关文件：

- `lib/test-generator.ts`
- `tests/unit/test-generator.spec.ts`

## 实际回归结果

### 通讯录任务重新生成

对配置：

- `cfg_1773310486550_7b606357`

重新触发真实生成后，得到：

- `plan_1773311479951_77f64957`
- `v4`

新版本首行已经变为：

- `test('商机列表-随机勾选一个商机并批量加入通讯录', ...)`

并且脚本中已包含以下关键动作：

- 检查 `批量加入通讯录` 按钮可见
- 随机勾选一条商机
- 点击 `批量加入通讯录`
- 尝试进入“我的通讯录列表”做结果校验

注意：

- 旧执行 `exec_1773310681323_acfbd935` 仍然绑定旧计划 `v2`
- 执行记录不会自动切换到新计划
- 后续如果要验证修复结果，需要重新从任务页触发执行，让它跑最新的 `v4`

### 通讯录任务最终修复验证

在继续修复后，重新为同一任务生成了新版本：

- `plan_1773315882486_12545c87`
- `v16`

并执行：

- `exec_1773315898101_50b3bb32`

结果：

- `passed`
- `执行成功（步骤通过 1，跳过 0）`

说明：

- 当前最新“通讯录”任务已经可以稳定跑通
- 不需要再基于 `v5` 继续做 AI 纠错
- 后续如果用户再重新生成计划，应该继续命中这份确定性模板

## 验证记录

今天实际跑过的验证：

- `npm run build`
- `npm run test:unit`
- `npm run test:integration -- tests/integration/project-intent-api.spec.ts`

说明：

- 上面的 integration 命令由于当前脚本包装方式，实际跑了整套 integration
- 结果为 `7` 个文件、`20` 条用例通过

此外，还对“通讯录”任务走了一次真实生成链路：

- `POST /api/test-configs/cfg_1773310486550_7b606357/generate-plan`

结果：

- 成功生成 `v4`
- 已确认不再直接复用 `createOrder` 脚本

后续追加验证：

- 真实浏览器手工复现并确认：
  - 登录后等待首页稳定再切业务页，可以稳定进入商机列表
  - `批量加入通讯录` 按钮真实存在
  - 业务反馈可能是“已存在通讯录”
  - 目标手机号可在 `#/mails/mailslist` 中检索到
- 最新自动计划 `v16` 已执行通过

### 通讯录任务推荐文案

为避免后续重新生成时只写“点击批量加入通讯录”而缺少最终结果校验，建议把任务文案改成下面这版。

推荐任务名：

- `商机列表批量加入通讯录并校验结果`

推荐任务描述：

- `进入商机列表页，随机勾选一条包含联系人手机号的商机，点击【批量加入通讯录】按钮。操作完成后进入【我的通讯录】列表，使用该商机联系人手机号进行搜索，并校验可以查询到对应联系人记录。若页面提示“已存在您的通讯录”或类似提示，也视为符合预期，但最终仍需以通讯录列表中能检索到该手机号作为成功判定。`

如果仍保留原任务名 `通讯录`，至少也应把描述补成“加入通讯录后进入我的通讯录按手机号检索并校验能查到联系人”，不要只写前半段点击动作。

## 当前已知限制

### 1. 能力选择仍只作用于当前 recipe 的命中集

现在前端可选择的是 `matchedCapabilities`，不是更大的候选池。

这意味着：

- 用户可以从“当前命中的能力集合”里做减法
- 但还不能把“语义接近但这次没被选上的能力”加进来

如果后续要做真正的“多候选能力切换”，需要扩：

- `app/api/projects/[projectUid]/draft-recipe/route.ts`

让后端把更完整的 candidate set 返回给前端。

### 2. `supportingKnowledge` 暂时不会随能力勾选同步收缩

当前用户勾选能力后，会同步重算：

- `matchedCapabilities`
- `requirementCoverage`
- `executionRecipe`

但 `supportingKnowledge` 仍沿用原 recipe 结果，尚未按用户最终选择做裁剪。

### 3. 通讯录任务现在只是“命题方向修正”

这个限制已经收敛。

当前“通讯录”任务已不只是命题方向修正，而是已经有一份经过真实执行验证的稳定模板。

但仍可继续优化：

- 是否把“已存在通讯录”拆成单独的显式业务分支断言
- 是否补能力层 / recipe 层的专门能力，而不是只在测试生成层做稳定模板

## 下次继续时建议优先做的事

1. 观察“通讯录”任务后续新生成版本是否持续命中当前确定性模板，避免回退到通用生成。
2. 把“批量加入通讯录”沉淀成能力层可复用能力，而不只是测试生成层模板。
3. 如果希望用户在编排结果里切换“多个同语义能力”，扩 `draft-recipe` API 返回更多候选能力，而不是只返回命中能力。
4. 如果发现“手册证据”过宽，再把 `supportingKnowledge` 也按最终所选能力做二次收敛。

## 关键文件索引

- `components/ProjectIntentWorkbench.tsx`
- `lib/project-knowledge.ts`
- `lib/test-generator.ts`
- `lib/services/test-plan-service.ts`
- `app/api/test-plans/[planUid]/restore/route.ts`
- `tests/unit/project-knowledge.spec.ts`
- `tests/unit/test-generator.spec.ts`
- `tests/integration/project-intent-api.spec.ts`
- `tests/integration/plan-restore-api.spec.ts`
