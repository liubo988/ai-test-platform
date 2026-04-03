# Intent E2E 成功率提升最小方案（2026-04-01）

## 文档目的

这份文档用于整理当前 `AI生成` 按钮后续的最小成功率提升方案，供评估后再决定是否开发。

目标不是推翻现有 `intent-e2e` 主链路，也不是直接引入全新的 agent 架构，而是在现有：

- `ScenarioCard`
- `ExecutionPlan / VerificationPlan`
- `compiledTemplate`
- `structured repair patch`
- `project knowledge / repair memory / insights`

基础上，优先解决下面这个最现实的问题：

> 用户输入一句自然语言和图片，点击一次 `AI生成`，即使经过多轮自动修复仍然失败，且用户不知道下一步该做什么。

## 文档定位与使用方式

这份文档可以直接作为后续开发文档使用，但定位是：

- `intent-e2e` post-R14 成功率提升专项执行文档
- 不替代现有 roadmap 主文档

执行约束：

1. 每个切片开工前，先按 `docs/task-brief-template.md` 写一份简短 Task Brief。
2. 只按本文定义的 `S1-S6` 顺序推进，不跨切片发散补大能力。
3. 涉及 `intent-e2e` 主链路、`lib/ai/**`、`app/api/intent-e2e/**`、`components/IntentE2EWorkbench.tsx` 的改动，完成后仍需同步回写当前 roadmap 文档。
4. 每个切片完成后，至少更新：
   - 本文档中的阶段状态
   - 对应 roadmap 的最新一条进度记录
5. 每个切片验证后，至少补一组固定度量，避免只写主观判断。

## 当前阶段状态

- `S1`：已完成
- `S2`：已完成
- `S3`：已完成
- `S4`：已完成（`S4a`、`S4b`、`S4c` 代码切片已完成）
- `S5`：已完成
- `S6`：已完成

## 固定度量口径

每个切片完成后，至少记录下面 5 个指标中的可得部分：

- `auto_run_rate`
- `blocked_rate`
- `first_pass_rate`
- `terminal_pass_rate`
- `top_failure_reasons`

记录原则：

- 没有完整埋点时，可先基于当轮真实 run 样本和 run registry 做人工统计。
- 不要求一开始就补完整报表，但不能只写“感觉更稳了”。
- 如果某轮主要改的是入口分流，则优先记录 `auto_run_rate / blocked_rate / top_failure_reasons`。
- 如果某轮主要改的是 family、repair 或执行层，则优先记录 `first_pass_rate / terminal_pass_rate / top_failure_reasons`。
- 若某轮主要改的是 `S4` family 收口，还需补记 `recipe_hit_rate / untracked_rate`。

## 当前问题定义

当前产品问题不只是“通过率不够高”，而是同时存在四个问题：

1. 低置信任务也会直接进入完整自动运行链路，消耗多轮 generate / repair 配额。
2. blocker 类失败和模型质量失败没有在按钮入口处被真正分流。
3. 写数据场景缺少真实可执行的 fixture/setup/cleanup 执行层。
4. 失败后虽然有 `finalFailureTriage`、`qualitySplit`、`assetReadiness`，但没有转成明确的下一步动作。

## 方案边界

### 本方案要做的

- 降低“明知低置信仍直接开跑”的比例。
- 降低 blocker 类失败对 repair 配额的浪费。
- 先打穿高频 family，而不是承诺开放式全能。
- 让用户在失败后总能看到下一步动作。

### 本方案暂时不做的

- 不重写成 `step-by-step browser agent loop`。
- 不引入 multi-agent 协作主链路。
- 不靠增加 repair 次数解决问题。
- 不回退成“纯 prompt 生成完整脚本”。

## 总体策略

按优先级分三段推进：

1. `P0` 入口止损：先拦低置信任务，避免盲跑。
2. `P1` 高频 family 打穿：优先提升首轮成功率，而不是依赖 repair。
3. `P2` 执行层补齐：当前先补 fixture；会话复用和更强 repair 证据按指标决定是否追加。

## 切片总览

建议固定拆成 6 刀：

1. `S1`：`assetReadiness` 抽共享 + `launch decision`
2. `S2`：`launch-decision route` + workbench blocked flow
3. `S3`：动态 `repair budget` + 失败 CTA
4. `S4`：top families deterministic route 继续收口
5. `S5`：repeated failure suppression
6. `S6`：fixture executor 最小版

## P0：入口止损

### 目标

把“点一下按钮就直接进入默认自动运行链路”的行为改成“先判断是否适合自动运行，再决定是否进入 run 链路”。

这里的“默认自动运行链路”按当前实现，通常指：

- `1` 次 generate
- 最多 `2` 次 repair
- 平台级 `retryLimit` 默认仍是 `0`，额外重试不应作为默认口径

### 交付物

#### 1. Launch Decision 判定层

新增一个轻量决策层，对一次 `AI生成` 请求先输出：

- `auto_run`
- `needs_bootstrap`
- `needs_fixture`
- `needs_clarify`
- `draft_only`

建议新增文件：

- `lib/intent-e2e-launch-decision.ts`
- `app/api/intent-e2e/launch-decision/route.ts`

判定输入至少包括：

- `input`
- `targetUrl`
- `projectUid / moduleUid`
- `attachments`
- `runtimeGovernance`
- run 前 `project asset availability`
- 最近相似 run 的失败压力

#### 2. Asset Readiness 共享化

把当前运行链路中的 `assetReadiness` 构建逻辑抽成共享模块，但明确拆成两层：

- run 前 `project asset availability`
  - 只判断 onboarding / project knowledge / repair memory 等静态资产是否存在
- run 后 `full asset readiness`
  - 在静态资产之上，再叠加 `knowledgeMatchCount / no_hit` 等 analyze/planning 后才知道的信号

消费方式：

- launch decision 只消费 run 前资产可用性
- run 中 result 输出继续消费完整 `assetReadiness`
- workbench 失败后动作引导继续消费完整 `assetReadiness`

建议新增文件：

- `lib/intent-e2e-asset-readiness.ts`

#### 3. 动态 Repair Budget

不再让所有失败都默认吃满现有 `selfHealRetries`，并优先复用已有单 run 早停机制。

建议按失败类设置 repair 预算：

- `auth_failed / permission_blocked / data_missing / env_transient`：`0`
- `asset_missing`：`0`
- 分析后确认的 `no_hit`：`0-1`
- `workflow_gap / unknown`：`1-2`
- `selector_drift / assertion_too_strict`：保留定向 repair

建议新增文件：

- `lib/intent-e2e-repair-budget.ts`

#### 4. 失败后 CTA 面板

把当前 workbench 已有的：

- `finalFailureTriage`
- `qualitySplit`
- `assetReadiness`

转成明确动作，而不是只显示总结文案。

建议至少提供这四个动作：

- `生成项目知识草稿`
- `补充运行前置条件`
- `返回继续改描述`
- `转手动任务`

### P0 涉及文件

- `components/ProjectWorkspace.tsx`
- `components/IntentE2EWorkbench.tsx`
- `app/api/intent-e2e/runs/route.ts`
- `lib/ai/intent-e2e-service.ts`
- `lib/ai/intent-e2e-run-registry.ts`
- `lib/intent-e2e-asset-readiness.ts`
- `lib/intent-e2e-launch-decision.ts`
- `lib/intent-e2e-repair-budget.ts`

### P0 完成标准

- blocker 类失败不再默认消耗完整 repair 配额。
- `asset_missing` 不再直接进入自动运行链路；分析后确认的 `no_hit` 不再默认跑满 repair。
- 用户失败后一定能看到明确下一步动作。
- workbench 不再把“低置信任务自动失败”伪装成“继续修复也许能好”。

## P1：高频 Family 打穿

### 目标

先把最常见、最值钱的高频 family 做成高成功率，而不是追求“任意一句自然语言都能自动跑通”。

### 首批 Family

1. 新建后回列表验收
2. 列表搜索并进入详情
3. 弹层 / 抽屉编辑保存
4. 行操作菜单
5. 列表归属切换后回查

### 交付物

#### 1. Family 级 deterministic route 继续收口

在已有 `ScenarioCard` 稳定化、recipe registry、compiler 骨架和 deterministic template/slot patch 的基础上，对高频 family 继续优先命中：

- recipe
- compiler instruction
- helper skeleton
- verifier skeleton

而不是让模型在这些地方自由发挥。

#### 2. 图片升级为路由信号

图片当前已经进入 `ScenarioCard`，但后续应进一步参与：

- 页面类型识别
- family 路由
- 低置信检测
- 是否需要澄清

目标不是让图片直接提高 repair 次数，而是让图片更早帮助分流错误 family。

#### 3. Repeated Failure Suppression

如果同一 `snapshotSignature / family / blocker` 已连续失败多次，则默认不再 `auto_run`，改成：

- `draft_only`
- `needs_bootstrap`
- `needs_fixture`

避免用户反复点同一个已知必败任务。

### P1 涉及文件

- `lib/ai/scenario-card.ts`
- `lib/intent-recipe-registry.ts`
- `lib/intent-action-library.ts`
- `lib/intent-execution-compiler.ts`
- `lib/test-generator.ts`
- `lib/ai/intent-e2e-insights.ts`
- `lib/intent-e2e-launch-decision.ts`

### P1 完成标准

- top 5 family 的 first-pass rate 明显提升。
- 同类已知失败任务不会继续默认盲跑。
- 图片不再只是附件，而是进入 family 路由和低置信判断。

## P2：执行层补齐

### 目标

补真正影响 terminal pass 的执行面短板。

### 交付物

#### 1. Fixture Executor 最小版

把 `runtimeGovernance.fixture` 从 contract/blocker 升级为最小可执行层：

- run 前 `setup`
- run 后 `cleanup`
- 注入 `idempotencyKey`

注意：

- 只允许 repo-owned / manifest-based fixture 引用
- 不允许任意自由脚本执行

#### 2. 会话复用最小版（候选加刀，不纳入当前 S1-S6 承诺）

基于现有 project credential / shared session 语义，补最小会话复用能力，减少每次 run 重走登录链带来的波动。

前提规则：

- 默认仍放在 `P2`，不单独提前开刀。
- 只有当最近失败主因里“重复登录 / 会话失效 / auth 波动”占比已明显进入前列时，才允许提升为独立小切片。

#### 3. 更强的 Repair 运行时证据（候选加刀，不纳入当前 S1-S6 承诺）

repair 输入补齐更可诊断的运行时证据，例如：

- step screenshot
- 最近列表 JSON / 详情字段结构化证据
- 最近 DOM summary

仍沿现有 structured repair patch 主链路，不切换到更重的 agent loop。

### P2 涉及文件

- `lib/ai/intent-e2e-service.ts`
- `lib/intent-e2e-runtime-governance.ts`
- `lib/server/intent-e2e-project-auth.ts`
- `lib/intent-e2e-fixture-executor.ts`
- `lib/test-worker.mjs`

### P2 完成标准

- 写数据场景不再因为缺前置数据而盲跑。
- repair 不再主要依赖错误文本猜测。
- 测试数据污染和重复登录带来的波动下降。

说明：

- 当前 `S1-S6` 只正式承诺把 `fixture executor` 落地到代码。
- 会话复用和更强 repair 运行时证据保留为 `S6` 后候选切片。
- 只有当阶段度量显示 `auth` 波动或证据不足仍是主要失败源时，才进入正式排期。

## 推荐开发顺序

建议按这 6 刀执行：

1. `assetReadiness` 抽共享 + `launch decision`
2. `launch-decision route` + workbench blocked flow
3. 动态 repair budget + 失败 CTA
4. top families deterministic route 继续收口
5. repeated failure suppression
6. fixture executor 最小版

## 切片执行清单

### S1：`assetReadiness` 抽共享 + `launch decision`

#### 本轮目标

- 把 `assetReadiness` 从运行中构建逻辑抽成共享模块。
- 明确拆出 run 前资产可用性与 run 后完整 `assetReadiness` 两层语义。
- 新增 `launch decision` 核心纯逻辑，不接 UI，不接 route。

#### 验收标准

- [x] `assetReadiness` 拆成 run 前资产可用性与 run 后完整 readiness 两层，语义边界清晰。
- [x] `launch decision` 至少能区分 `auto_run / needs_bootstrap / needs_fixture / needs_clarify / draft_only`。
- [x] 不改当前默认运行入口行为，只补底层能力。

#### 范围

- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `lib/intent-e2e-asset-readiness.ts`
  - `lib/intent-e2e-launch-decision.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/intent-e2e-insights.spec.ts`
  - `tests/unit/intent-e2e-launch-decision.spec.ts`
- 不会改：
  - route contract
  - workbench UI
  - fixture 执行层

#### 验证

- `npm run build`
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts`
- `node scripts/check-doc-links.mjs`

### S2：`launch-decision route` + workbench blocked flow

#### 本轮目标

- 给前端加一层 run 前判定。
- 让 `AI生成` 入口先消费 launch decision，再决定是否真正创建 run。

#### 验收标准

- [x] 新增 `launch-decision` route。
- [x] `AI生成` 入口在 `needs_bootstrap / needs_fixture / needs_clarify / draft_only` 时不直接开跑。
- [x] workbench 能展示 blocked flow 的基本解释与动作入口。

#### 范围

- 会改：
  - `app/api/intent-e2e/launch-decision/route.ts`
  - `app/api/intent-e2e/runs/route.ts`
  - `components/ProjectWorkspace.tsx`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
  - `tests/unit/api-intent-e2e-runs-route.spec.ts`
- 不会改：
  - repair 预算
  - family route
  - fixture executor

#### 验证

- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/api-intent-e2e-runs-route.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
- `node scripts/check-doc-links.mjs`

### S3：动态 `repair budget` + 失败 CTA

#### 本轮目标

- 按失败类动态限制 repair 次数。
- 把失败结果从“总结文案”升级成明确 CTA。
- 优先复用现有单 run `repair stagnation` 早停，不另起一套 repair 抑制系统。

#### 验收标准

- [x] blocker 类失败不再消耗完整 repair 配额。
- [x] `asset_missing` 不再直接进入自动运行链路；分析后确认的 `no_hit` 不再默认跑满 repair。
- [x] failure CTA 至少提供“补前置 / 生成知识草稿 / 改描述 / 转手动任务”。

#### 范围

- 会改：
  - `lib/intent-e2e-repair-budget.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/intent-e2e-run-registry.spec.ts`
- 不会改：
  - launch-decision route 语义
  - family route
  - fixture 执行层

#### 验证

- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-run-registry.spec.ts`
- `node scripts/check-doc-links.mjs`

### S4：top families deterministic route 继续收口

#### 本轮目标

- 在已有 deterministic 能力基础上，先把最高频的 2-3 个 family 继续收口，稳定后再扩到 top 5。
- 降低这些 family 对自由生成的依赖。

首轮 family 选择以最近一段真实 run 的 `priorityScenarioFamily` 统计和 `failure pressure` 为准，优先选 `runCount` 与 `failedRuns` 都靠前的 2-3 个 family，不凭主观指定。

#### 执行拆分

`S4` 细化设计参考 `docs/intent-e2e-s4-supplement-2026-04-01.md`，但主计划只吸收收口后的 3 个子步骤，不单独扩成新的主切片编号：

1. `S4a`：补 family 分类器、给 recipe 增加 `family` 字段、仅对已通过基础 matcher 的同 family recipe 做轻量加权、按 family 记录命中率和通过率。
2. `S4b`：给首轮 2-3 个最高频 family 补轻量 `family-aware sanitizer` 和 compiler hints，继续收口现有 deterministic 骨架。
3. `S4c`：让 `visualAnchors` 进入 family 路由，但首轮只做辅助确认、误分类纠偏和 clarify 提示信号输出；是否真正转成 `needs_clarify` 由 `S1/S2` 的 launch decision 统一决策。

#### 取舍规则

- `familyCapabilityProfile` 首轮只作为 preferred capability / compiler hints 的软约束，不把 `requiredCapabilities` 直接做成强制硬覆盖。
- `visualAnchors` 首轮只用于 family 确认和误分类收敛，不直接覆盖文本分类结果。
- 同 family recipe 只在基础 matcher 已通过时做轻量加权，建议 `+2~+3`，不做 family 对其它 recipe 的硬覆盖。
- `business_to_order` 保持候选 family，不默认挤进首轮 2-3 个 family；只有真实 run 样本频率和失败占比进入前列时再纳入。

#### 验收标准

- [x] 首轮先落地 2-3 个最高频 family，验证稳定后再扩到 top 5。
- [x] family 已识别时，recipe 选择会优先命中同 family 的稳定模板。
- [x] 已落地 family 的 route / helper / verifier 默认骨架稳定输出。
- [x] 图片信号进入 family 路由，不再只是附件描述。
- [x] `visualAnchors` 输出的 clarify 提示信号不会直接越权改写 `launch decision`。
- [x] 优先复用现有 `ScenarioCard / recipe registry / compiler / deterministic template` 收口能力，不另起一套路由框架。
- [x] 首轮不把 capability profile 做成强制硬约束，不因过度收口导致可跑任务反而被锁死。
- [x] S4 验证结果按 family 粒度回写，不只看全局 first pass。
- [x] 不扩到更多 family，不顺手做通用 agent loop。

#### 范围

- 会改：
  - `lib/intent-e2e-priority-scenario-family.ts`
  - `lib/ai/intent-e2e-insights.ts`
  - `lib/ai/scenario-card.ts`
  - `lib/intent-recipe-registry.ts`
  - `lib/intent-action-library.ts`
  - `lib/intent-execution-compiler.ts`
  - `lib/test-generator.ts`
  - `tests/unit/intent-e2e-insights.spec.ts`
  - `tests/unit/intent-recipe-registry.spec.ts`
  - `tests/unit/scenario-card.spec.ts`
  - `tests/unit/intent-action-library.spec.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
  - `tests/unit/test-generator.spec.ts`
  - `tests/unit/test-generator-structured.spec.ts`
- 不会改：
  - 其它 family
  - route contract
  - fixture executor

#### 验证

- `npm run build`
- `npx vitest run tests/unit/scenario-card.spec.ts tests/unit/intent-action-library.spec.ts tests/unit/intent-execution-compiler.spec.ts tests/unit/test-generator.spec.ts tests/unit/test-generator-structured.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-e2e-insights.spec.ts`
- `node scripts/check-doc-links.mjs`
- 结合现有 insights 统计回写 `per_family_first_pass_rate / terminal_pass_rate / recipe_hit_rate / untracked_rate`

### S5：repeated failure suppression

#### 本轮目标

- 对近期已知必败任务建立负向抑制，不再默认 `auto_run`。
- 把“同样的错继续重跑”改成“引导用户转下一个动作”。
- 基于现有 `snapshotSignature` 聚类和 `failure pressure` 结果做映射，不另造新的 suppression 系统。

#### 验收标准

- [x] 相同 family / blocker / signature 的近期重复失败会影响 launch decision。
- [x] workbench / run 入口能解释为什么本次不直接自动跑。
- [x] 复用现有 `snapshotSignature / failure pressure baseline` 结果，不额外新增并行判定体系。
- [x] 不改 benchmark / rollout / governance 主语义。

#### 范围

- 会改：
  - `lib/intent-e2e-launch-decision.ts`
  - `lib/ai/intent-e2e-insights.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `app/api/intent-e2e/launch-decision/route.ts`
  - `tests/unit/intent-e2e-launch-decision.spec.ts`
  - `tests/unit/intent-e2e-insights.spec.ts`
  - `tests/unit/intent-e2e-run-registry.spec.ts`
  - `tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
- 不会改：
  - family compiler 骨架
  - fixture executor
  - 多 runner 主链路

#### 验证

- `npm run build`
- `npx vitest run tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-e2e-run-registry.spec.ts`
- `node scripts/check-doc-links.mjs`

### S6：fixture executor 最小版

#### 本轮目标

- 把 `runtimeGovernance.fixture` 从 blocker 升级成最小执行层。
- 先支持 repo-owned / manifest-based `setup / cleanup`。

#### 验收标准

- [x] mutating flow 在声明 fixture 时可真实执行 `setup / cleanup`。
- [x] fixture 会注入并传递 `idempotencyKey / owner`。
- [x] 不支持任意自由脚本，不引入外部依赖编排平台。

#### 范围

- 会改：
  - `lib/intent-e2e-runtime-governance.ts`
  - `lib/server/intent-e2e-project-auth.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/intent-e2e-fixture-executor.ts`
  - `tests/unit/intent-project-runtime-governance.spec.ts`
  - `tests/unit/intent-e2e-project-auth.spec.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/intent-e2e-request.spec.ts`
- 不会改：
  - 多 agent
  - 通用会话池
  - CI/CD 发布 gate

#### 验证

- `npm run build`
- `npx vitest run tests/unit/intent-project-runtime-governance.spec.ts tests/unit/intent-e2e-project-auth.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-request.spec.ts`
- `node scripts/check-doc-links.mjs`

## 2026-04-01 更新（S1：asset readiness 两层拆分 + launch decision 底座）

- 本轮目标：
  - 只完成 `S1`
  - 把 run 前资产可用性与 run 后完整 `assetReadiness` 拆开
  - 新增 `launch decision` 纯逻辑，但不接 route / workbench
- 已完成：
  - 已新增 `lib/intent-e2e-asset-readiness.ts`
  - 已把 `lib/ai/intent-e2e-service.ts` 中的 `assetReadiness` 构建逻辑抽到共享模块，并拆成：
    - run 前 `project asset availability`
    - run 后完整 `assetReadiness`
  - `lib/ai/intent-e2e-service.ts` 现已在 runtime governance / precheck 前复用 run 前资产判断，并在 planning 后复用完整 readiness
  - 已新增 `lib/intent-e2e-launch-decision.ts`
  - 已新增 `tests/unit/intent-e2e-launch-decision.spec.ts`，覆盖 `auto_run / needs_bootstrap / needs_fixture / needs_clarify / draft_only`
  - `lib/ai/intent-e2e-insights.ts` 已改为从共享模块引用 `assetReadiness` 类型，不再耦合到 service 内部定义
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
- 度量：
  - `auto_run_rate`：`N/A`（`S1` 未接真实入口分流）
  - `blocked_rate`：`N/A`（`S1` 未接真实入口分流）
  - `first_pass_rate`：`N/A`（`S1` 未调整 generate / execute 主链）
  - `terminal_pass_rate`：`N/A`（`S1` 未调整 generate / execute 主链）
  - `top_failure_reasons`：`N/A`（`S1` 只补底层能力）
- 当前阶段状态：
  - `S1`：已完成
  - `S2`：待开始
  - `S3`：待开始
  - `S4`：待开始
  - `S5`：待开始
  - `S6`：待开始
- 风险 / 未完成：
  - 本轮没有把 `launch decision` 接进 route / workbench，因此还未进入真实入口流量
  - 本轮没有新增 `failure pressure -> launch decision` 的真实消费链，只先补纯逻辑底座
  - 本轮没有改 repair budget、family route、CTA 或 fixture executor
- 下一步：
  - `S2`
  - 只接 `launch-decision route` 与 workbench blocked flow，不提前展开 `S3+`

## 2026-04-01 更新（S2：launch-decision route + workbench blocked flow）

- 本轮目标：
  - 只完成 `S2`
  - 给 `AI生成` 入口加一层 run 前 launch decision
  - 在 workbench 展示最小 blocked flow 与动作入口
- 已完成：
  - 已新增 `docs/intent-e2e-s2-task-brief-2026-04-01.md`
  - 已新增 `lib/server/intent-e2e-request-preparation.ts`，把 request normalize、workspace llm merge、project auth 和 onboarding defaults 收口到共享 helper
  - 已新增 `app/api/intent-e2e/launch-decision/route.ts`
  - `app/api/intent-e2e/runs/route.ts` 已复用共享请求预处理 helper，不再重复拼装 request
  - `components/ProjectWorkspace.tsx` 现在会先请求 `launch-decision route`；若命中 `needs_bootstrap / needs_fixture / needs_clarify / draft_only`，则不创建 run，而是带 `projectUid / moduleUid / draftUid / launchDecision` 跳到 workbench
  - `components/IntentE2EWorkbench.tsx` 现在会在提交前先请求 `launch-decision route`；blocked 时不创建 run，并展示最小 blocked card、动作入口和 query 恢复
  - 已新增 `tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
  - 已更新 `tests/unit/api-intent-e2e-runs-route.spec.ts`，覆盖 route 复用共享请求预处理
- 验证：
  - `npx vitest run tests/unit/api-intent-e2e-runs-route.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
- 度量：
  - `auto_run_rate`：`N/A`（本轮只接入口分流能力，尚未回收真实 run 样本）
  - `blocked_rate`：`N/A`（本轮未补埋点，只完成 route / UI 接线）
  - `first_pass_rate`：`N/A`（本轮未改 generate / execute 主链）
  - `terminal_pass_rate`：`N/A`（本轮未改 generate / execute 主链）
  - `top_failure_reasons`：`N/A`（本轮未做真实样本统计）
- 当前阶段状态：
  - `S1`：已完成
  - `S2`：已完成
  - `S3`：待开始
  - `S4`：待开始
  - `S5`：待开始
  - `S6`：待开始
- 风险 / 未完成：
  - 本轮 blocked flow 只做最小解释与动作入口，还没有完整 failure CTA 面板
  - `draft_only` 目前只保留 route / UI contract，尚未接真实 failure pressure 数据源
  - repair budget、family route、failure suppression、fixture executor 仍在后续切片
- 下一步：
  - `S3`
  - 只做动态 `repair budget` 与失败 CTA，不提前展开 `S4+`

## 2026-04-02 更新（S3：动态 repair budget + 失败 CTA）

- 本轮目标：
  - 只完成 `S3`
  - 按失败类和 `assetReadiness` 动态收紧 repair 次数
  - 在 workbench 失败区补最小 failure CTA 面板
- 已完成：
  - 已新增 `docs/intent-e2e-s3-task-brief-2026-04-02.md`
  - 已新增 `lib/intent-e2e-repair-budget.ts`，把 `selfHealRetries / assetReadiness / failure triage` 的 repair cap 收口到独立 helper
  - `lib/ai/intent-e2e-service.ts` 现在会在 runtime governance blocked、precheck blocked 和 terminal failure 输出 `repairBudget / failureCta`
  - `lib/ai/intent-e2e-service.ts` 现在会在保留现有 `repair stagnation` 早停的前提下，对 `asset_missing / no_hit / workflow_gap / blocker` 等失败动态止损，不再默认跑满 repair
  - `lib/ai/intent-e2e-run-registry.ts` 已补 clone / restore，run snapshot 恢复后不会丢 `repairBudget / failureCta`
  - `components/IntentE2EWorkbench.tsx` 现在会在失败摘要下展示 repair budget 摘要和 4 个固定动作：`补前置条件 / 生成知识草稿 / 继续改描述 / 转手动任务`
  - `components/IntentE2EWorkbench.tsx` 已补 `target_row_not_found / ui_anchor_missing / repair_stagnated` 的失败标签，避免继续落到“未分类”
  - 已更新 `tests/unit/intent-e2e-service.spec.ts`
  - 已更新 `tests/unit/intent-e2e-run-registry.spec.ts`
- 验证：
  - `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-run-registry.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
- 度量：
  - `auto_run_rate`：`N/A`（本轮未改入口分流）
  - `blocked_rate`：`N/A`（本轮未新增真实入口样本统计）
  - `first_pass_rate`：`N/A`（本轮未做真实 run 样本回收，只补动态 budget 规则）
  - `terminal_pass_rate`：`N/A`（本轮未做真实 run 样本回收，只补动态 budget 规则）
  - `top_failure_reasons`：`N/A`（本轮未做 insights 样本统计）
- 当前阶段状态：
  - `S1`：已完成
  - `S2`：已完成
  - `S3`：已完成
  - `S4`：待开始
  - `S5`：待开始
  - `S6`：待开始
- 风险 / 未完成：
  - 本轮没有改 `launch-decision route` 语义，service 直调下仍允许先跑首轮 generate + execute
  - failure CTA 只复用现有 workbench / governance / workspace 入口，没有扩成新的人工协作流程
  - family route、failure suppression、fixture executor 仍在后续切片
- 下一步：
  - `S4`
  - 只做 top families deterministic route 继续收口，不提前展开 `S5+`

## 2026-04-02 更新（S4a：priority family 分类补口 + recipe family 轻量加权）

- 本轮目标：
  - 只完成 `S4a`
  - 补 priority family 分类缺口
  - 给 recipe 增 `family` 字段，并只对已通过基础 matcher 的同 family recipe 做轻量加权
- 已完成：
  - 已新增 `docs/intent-e2e-s4-task-brief-2026-04-02.md`
  - 已新增 `lib/intent-e2e-priority-scenario-family.ts`，统一承接 `priority family` 类型与分类逻辑，避免 `insights` 与 planning 各自复制规则
  - `lib/ai/intent-e2e-insights.ts` 已改为复用共享 family helper，并补齐：
    - `row_action_menu`
    - `list_ownership_switch`
    - 对应 label / rank
  - `lib/intent-recipe-registry.ts` 现在已支持：
    - recipe 显式 `family`
    - `priorityScenarioFamily` 输入
    - 仅对已通过基础 matcher 的同 family recipe 做 `+3` 轻量加权
  - `lib/test-generator.ts` 现在会在 planning 阶段推断当前 family，并把结果传给 recipe selection
  - 已更新 `tests/unit/intent-recipe-registry.spec.ts`
  - 已更新 `tests/unit/intent-e2e-insights.spec.ts`
- 验证：
  - `npx vitest run tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-e2e-insights.spec.ts`
  - `npm run build`
- 度量：
  - `first_pass_rate`：`N/A`（`S4a` 只补分类与 recipe 选择底座，未做真实 run 样本回放）
  - `terminal_pass_rate`：`N/A`（`S4a` 只补分类与 recipe 选择底座，未做真实 run 样本回放）
  - `top_failure_reasons`：`N/A`（本轮未做真实 run 样本统计）
  - `recipe_hit_rate`：`N/A`（本轮未回收真实 family 命中样本，只完成选择逻辑和单测）
  - `untracked_rate`：`N/A`（本轮未回放真实 run 样本）
- 当前阶段状态：
  - `S1`：已完成
  - `S2`：已完成
  - `S3`：已完成
  - `S4`：进行中（`S4a` 已完成，`S4b` 待开始）
  - `S5`：待开始
  - `S6`：待开始
- 风险 / 未完成：
  - 本轮没有做 `S4b` 的 family-aware sanitizer / compiler hints
  - 本轮没有做 `S4c` 的 `visualAnchors` family 路由接线，也没有越权改 `launch decision`
  - `row_action_menu` 目前先只补分类，专用 recipe 仍留到后续切片
- 下一步：
  - `S4b`
  - 只给首轮 2-3 个最高频 family 补轻量 sanitizer 与 compiler hints，不提前展开 `S4c / S5+`

## 2026-04-02 更新（S4b：family-aware sanitizer + compiler hints 最小收口）

- 本轮目标：
  - 只完成 `S4b`
  - 给首轮 2-3 个最高频 family 补最小 `family-aware sanitizer`
  - 在 `action-library / compiler / planning` 补 family 级软约束透传
- 已完成：
  - 已新增 `docs/intent-e2e-s4b-task-brief-2026-04-02.md`
  - `lib/ai/scenario-card.ts` 已补：
    - `modal_or_drawer_save` 的最小 sanitizer
    - `list_search_detail` 的最小 sanitizer
    - 保留既有 `business_create_list_verify` 稳定化，不重写
  - `lib/intent-action-library.ts` 已补 `priorityScenarioFamily` 输入，并为首轮 family 注入 soft capability profile：
    - `business_create_list_verify`
    - `modal_or_drawer_save`
    - `list_search_detail`
  - `lib/intent-execution-compiler.ts` 已补 family-aware step / verification hints，并通过 `priorityScenarioFamily` 透传到 compiled template
  - `lib/test-generator.ts` 现在会在 planning 阶段继续透传 `priorityScenarioFamily` 到：
    - action library
    - compiled template
  - `lib/ai/intent-e2e-service.ts` 的 service 直编译路径已补 `priorityScenarioFamily` 透传
  - 已更新 `tests/unit/scenario-card.spec.ts`
  - 已更新 `tests/unit/intent-action-library.spec.ts`
  - 已更新 `tests/unit/intent-execution-compiler.spec.ts`
  - 已更新 `tests/unit/test-generator.spec.ts`
  - 已更新 `tests/unit/test-generator-structured.spec.ts`
- 验证：
  - `npx vitest run tests/unit/scenario-card.spec.ts tests/unit/intent-action-library.spec.ts tests/unit/intent-execution-compiler.spec.ts tests/unit/test-generator.spec.ts tests/unit/test-generator-structured.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-e2e-insights.spec.ts`
  - `npm run build`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
- 度量：
  - `first_pass_rate`：`N/A`（`S4b` 只补 deterministic 骨架收口，未做真实 run 样本回放）
  - `terminal_pass_rate`：`N/A`（`S4b` 只补 deterministic 骨架收口，未做真实 run 样本回放）
  - `top_failure_reasons`：`N/A`（本轮未回放真实 run 样本）
  - `recipe_hit_rate`：`N/A`（本轮只补 family soft profile / compiler hints，未回收真实命中样本）
  - `untracked_rate`：`N/A`（本轮未回放真实 run 样本）
- 当前阶段状态：
  - `S1`：已完成
  - `S2`：已完成
  - `S3`：已完成
  - `S4`：进行中（`S4a`、`S4b` 已完成，`S4c` 待开始）
  - `S5`：待开始
  - `S6`：待开始
- 风险 / 未完成：
  - 本轮没有进入 `S4c`，`visualAnchors` 仍未进入 family 路由
  - family profile 仍只作为软约束，不会硬覆盖 DSL / recipe / helper 选择
  - 本轮没有做真实 run 样本回放，family 粒度度量仍待补齐
- 下一步：
  - `S4c`
  - 只让 `visualAnchors` 进入 family 路由做辅助确认 / 误分类纠偏 / clarify signal，不提前展开 `S5+`

## 2026-04-02 更新（S4c：visualAnchors family route + clarify signal）

- 本轮目标：
  - 只完成 `S4c`
  - 让 `visualAnchors` 显式进入 priority family route
  - 只做辅助确认、`untracked` 收口和 clarify signal 输出，不越权改 launch decision
- 已完成：
  - 已新增 `docs/intent-e2e-s4c-task-brief-2026-04-02.md`
  - `lib/intent-e2e-priority-scenario-family.ts` 已新增显式 `family route resolver`，区分：
    - `textFamily`
    - `visualFamily`
    - `finalFamily`
    - `source`
    - `clarifySignals`
  - `lib/intent-e2e-priority-scenario-family.ts` 现在只允许两类 `visualAnchors` 收口：
    - 文本 `untracked` 时，保守提升到强视觉 family
    - 文本 family 与视觉 family 冲突时，输出 `clarify_signal`，但保持文本 family 不变
  - `lib/ai/scenario-card.ts` 现在会消费 `family route` 结果，并把：
    - `family_route`
    - `clarify_signal`
    以结构化 note 形式写回 `ScenarioCard.notes`
  - `lib/ai/scenario-card.ts` 现在会把 `visualAnchors` 显式透传到 `GenerateTestContext`
  - `lib/test-generator.ts` 现在会在 planning 阶段显式消费 `visualAnchors`，并保留 `priorityScenarioFamilyRoute`
  - 已更新 `tests/unit/scenario-card.spec.ts`
  - 已更新 `tests/unit/test-generator.spec.ts`
- 验证：
  - `npx vitest run tests/unit/scenario-card.spec.ts tests/unit/test-generator.spec.ts tests/unit/test-generator-structured.spec.ts tests/unit/intent-e2e-insights.spec.ts`
  - `npm run build`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
- 度量：
  - `first_pass_rate`：`N/A`（`S4c` 只补 family route 与 signal，未做真实 run 样本回放）
  - `terminal_pass_rate`：`N/A`（`S4c` 只补 family route 与 signal，未做真实 run 样本回放）
  - `top_failure_reasons`：`N/A`（本轮未回放真实 run 样本）
  - `recipe_hit_rate`：`N/A`（本轮未回收真实 family 命中样本）
  - `untracked_rate`：`N/A`（本轮未回放真实 run 样本）
- 当前阶段状态：
  - `S1`：已完成
  - `S2`：已完成
  - `S3`：已完成
  - `S4`：已完成（`S4a`、`S4b`、`S4c` 代码切片已完成）
  - `S5`：待开始
  - `S6`：待开始
- 风险 / 未完成：
  - 本轮没有把 `ScenarioCard` 级 clarify signal 直接接进 `/api/intent-e2e/launch-decision`
  - `visualAnchors` 仍只做 family 辅助路由，没有新增 vision 推理层
  - `S4` 的真实 run 样本回放与 family 粒度度量仍待后补
- 下一步：
  - `S5`
  - 只做 repeated failure suppression，不提前展开 `S6+`

## 2026-04-02 更新（S5：repeated failure suppression 接到 launch decision）

- 本轮目标：
  - 对近期已知必败任务建立负向抑制，不再默认 `auto_run`
  - 只复用已有 `snapshotSignature / qualitySplit / failure pressure` 口径
  - 只把 suppression signal 接到 `launch-decision route`，不提前展开 `S6`
- 已完成：
  - 已新增 `docs/intent-e2e-s5-task-brief-2026-04-02.md`
  - `lib/ai/intent-e2e-insights.ts` 已新增 `resolveIntentE2ERepeatedFailureSuppressionFromData()`，基于近期 terminal run 的 `snapshotSignature` cluster、`priorityScenarioFamily`、`targetPath` 和 `qualitySplit` 输出 suppression signal
  - `lib/ai/intent-e2e-run-registry.ts` 已新增 `listRecentIntentE2ETerminalRunSnapshots()`，统一给 route 读取近期 terminal run 快照
  - `app/api/intent-e2e/launch-decision/route.ts` 现在会在项目上下文里读取近期 terminal run，并把 repeated failure suppression 映射进现有 launch decision 输入
  - `lib/intent-e2e-launch-decision.ts` 现在会显式消费 repeated failure suppression，并返回：
    - `recent_repeated_auth_block`
    - `recent_repeated_permission_block`
    - `recent_repeated_environment_block`
    - `recent_repeated_data_block`
    - `recent_repeated_model_failure`
  - `needs_bootstrap / needs_fixture / draft_only` 现在都可由 repeated failure suppression 直接触发，不再只剩全局 `high_failure_pressure` fallback
  - 已更新 `tests/unit/intent-e2e-launch-decision.spec.ts`
  - 已更新 `tests/unit/intent-e2e-insights.spec.ts`
  - 已更新 `tests/unit/intent-e2e-run-registry.spec.ts`
  - 已更新 `tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
- 验证：
  - `npx vitest run tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-e2e-run-registry.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
  - `npm run build`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
- 度量：
  - `auto_run_rate`：`N/A`（本轮只补 run 前 suppression 接线，未回放真实 run 样本）
  - `blocked_rate`：`N/A`（本轮未做真实 workbench 流量回放）
  - `first_pass_rate`：`N/A`（本轮不改 generate / repair 主链路）
  - `terminal_pass_rate`：`N/A`（本轮不改执行层）
  - `top_failure_reasons`：`N/A`（本轮未做真实 run 样本统计）
- 当前阶段状态：
  - `S1`：已完成
  - `S2`：已完成
  - `S3`：已完成
  - `S4`：已完成（`S4a`、`S4b`、`S4c` 代码切片已完成）
  - `S5`：已完成
  - `S6`：待开始
- 风险 / 未完成：
  - run 前无法拿到生成后的完整 stepTypes，因此 suppression 仍是基于 `priorityScenarioFamily + targetPath + 历史 snapshotSignature cluster` 的保守近似匹配
  - 本轮没有把项目级全局 `failurePressureSummary` 再并入 launch decision，只补了 repeated failure 这条最小抑制链
  - 本轮没有新增 workbench 专用展示文案，解释仍走现有 decision reasons / signals
- 下一步：
  - `S6`
  - 只做 fixture executor 最小版，不提前展开会话复用或更重 repair 证据链

## 2026-04-02 更新（S6：fixture executor 最小版）

- 本轮目标：
  - 只完成 `S6`
  - 把 `runtimeGovernance.fixture` 从纯 contract / blocker 接成最小执行层
  - 只支持 repo-owned `fixture://...` 的 `setup / cleanup`，不提前展开会话复用
- 已完成：
  - 已新增 `docs/intent-e2e-s6-task-brief-2026-04-02.md`
  - `lib/intent-e2e-runtime-governance.ts` 已新增统一 `fixture://` ref 校验 helper，并把 invalid ref 收口成：
    - `fixture_setup_ref_invalid`
    - `fixture_cleanup_ref_invalid`
  - `lib/intent-project-runtime-governance.ts` 已复用同一规则校验项目级 runtime governance manifest
  - `lib/server/intent-e2e-project-auth.ts` 现在复用统一 fixture contract 判断，并继续为 ownerless fixture 补 project owner
  - 已新增 `lib/intent-e2e-fixture-executor.ts`，只支持 repo-owned `fixture://... -> scripts/intent-e2e-fixtures/**`，并在执行时注入 `owner / idempotencyKey / project / run` 上下文
  - `lib/ai/intent-e2e-service.ts` 现在会在 `precheck` 后、`analyzing` 前执行 fixture setup，并在 terminal result 前执行 fixture cleanup
  - `lib/ai/intent-e2e-service.ts` 已把 fixture setup / cleanup 失败统一收口成 `data_missing -> data_blocked` 终态，不再让 cleanup failure 落到空 triage / 错误 CTA
  - 已更新 `tests/unit/intent-project-runtime-governance.spec.ts`
  - 已更新 `tests/unit/intent-e2e-project-auth.spec.ts`
  - 已更新 `tests/unit/intent-e2e-service.spec.ts`
- 验证：
  - `npx vitest run tests/unit/intent-project-runtime-governance.spec.ts tests/unit/intent-e2e-project-auth.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-request.spec.ts`
  - `npm run build`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
- 度量：
  - `auto_run_rate`：`N/A`（本轮只补 fixture 执行层，不改入口分流）
  - `blocked_rate`：`N/A`（本轮未补真实 run 埋点，只完成执行层和终态口径）
  - `first_pass_rate`：`N/A`（本轮未回收真实 run 样本，只补 fixture setup / cleanup 接线）
  - `terminal_pass_rate`：`N/A`（本轮未回收真实 run 样本，只补 fixture 失败终态收口）
  - `top_failure_reasons`：`N/A`（本轮未做真实 run 样本统计）
- 当前阶段状态：
  - `S1`：已完成
  - `S2`：已完成
  - `S3`：已完成
  - `S4`：已完成（`S4a`、`S4b`、`S4c` 代码切片已完成）
  - `S5`：已完成
  - `S6`：已完成
- 风险 / 未完成：
  - repo 内目前还没有正式示例 fixture script；本轮只补 contract、executor 和 service 接线，真实脚本仍由项目按 `fixture://...` 目录约定提供
  - fixture cleanup failure 目前先归入 `data_blocked`，优先保证终态口径与 CTA 正确；更细的 fixture-specific failure family 不在本轮
  - 会话复用和更强 repair 运行时证据仍保持候选项，不纳入当前 `S1-S6` 承诺范围
- 下一步：
  - `S1-S6` 已全部完成
  - 若继续，只能另起 brief 评估 `S6+` 候选，不在本文当前承诺范围内

## 2026-04-02 更新（S6+：repair 运行时证据 DOM delta 最小切片）

- 本轮目标：
  - 不改 `S1-S6` 既有承诺
  - 只从 `S6+` 候选里补最小的 repair runtime evidence：`DOM delta`
  - 不碰 worker / artifact 协议，只增强现有 repair observation 主链
- 已完成：
  - 已新增 `docs/intent-e2e-s6plus-repair-evidence-task-brief-2026-04-02.md`
  - `lib/ai/intent-e2e-service.ts` 的 repair observation report 现在会在“初始 analyze snapshot vs 最新 repair observation snapshot”之间生成 `surface_delta` probe
  - `surface_delta` 现在会把新增 / 消失的标题、按钮、字段、frame surface 作为结构化 evidence 注入 repair observation report
  - `lib/ai/intent-e2e-service.ts` 已把 `surface_delta` 转成：
    - `obs-surface-delta`
    - `obs-surface-stable`
    供现有 repair memory 检索继续复用
  - `lib/test-generator.ts` 的 repair prompt 现在会显式渲染 `surface_delta`，并要求模型优先沿真实新增 / 消失 surface 修补页面切换、入口控件和断言锚点
  - 已更新 `tests/unit/intent-e2e-service.spec.ts`
  - 已更新 `tests/unit/test-generator.spec.ts`
- 验证：
  - `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/test-generator.spec.ts`
  - `npm run build`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
- 度量：
  - `auto_run_rate`：`N/A`（本轮不改入口分流）
  - `blocked_rate`：`N/A`（本轮不改 blocked flow）
  - `first_pass_rate`：`N/A`（本轮未回放真实 run 样本）
  - `terminal_pass_rate`：`N/A`（本轮未回放真实 run 样本）
  - `top_failure_reasons`：`N/A`（本轮未做真实 run 样本统计）
- 当前阶段状态：
  - `S1`：已完成
  - `S2`：已完成
  - `S3`：已完成
  - `S4`：已完成（`S4a`、`S4b`、`S4c` 代码切片已完成）
  - `S5`：已完成
  - `S6`：已完成
- 风险 / 未完成：
  - 本轮只补 `DOM delta`，还没有补“最近列表 JSON / 详情字段结构化证据”
  - delta 目前比较的是“初始 analyze snapshot vs 最新 repair observation snapshot”，不是失败瞬间 DOM dump
  - worker / artifact 协议仍未扩展，继续保持当前最小切片范围
- 下一步：
  - 若继续 `S6+`
  - 优先评估是否还需要“列表 JSON / 详情字段结构化证据”，不直接跳到更重 agent loop

## 2026-04-02 更新（S6+：repair 运行时证据补齐列表 JSON / 详情字段结构化证据）

- 本轮目标：
  - 不改 `S1-S6` 和 `S6+ DOM delta` 的既有结论
  - 只复用现有 `log.meta` 通道，把上一轮已拿到的列表 JSON / record lookup / 详情字段结构化证据接进 repair observation
  - 不碰 worker / artifact 协议，不扩成新的执行链
- 已完成：
  - 已新增 `docs/intent-e2e-s6plus-structured-data-evidence-task-brief-2026-04-02.md`
  - `lib/ai/intent-e2e-service.ts` 已把执行日志中的 `meta` 保留到 `IntentE2EAttempt.logs`
  - repair observation report 现在新增：
    - `list_json_evidence`
    - `detail_field_evidence`
  - `list_json_evidence` 会复用上一轮已有的：
    - `api response json parsed`
    - `json record extracted`
    - `json value extracted`
    - `json record not found`
    - `json value not found`
    这些 helper log 归纳列表接口、record match、字段值证据
  - `detail_field_evidence` 会复用上一轮已有的：
    - `detail field resolved`
    - `detail field not found`
    这些 helper log 归纳详情字段证据
  - `lib/ai/intent-e2e-service.ts` 已把这两类 probe 转成：
    - `obs-list-json`
    - `obs-detail-field`
    供 repair memory 检索继续复用
  - `lib/test-generator.ts` 的 repair prompt 现在会显式渲染这两类 probe，并要求模型优先复用已观察到的 JSON 路径、label、matchedLabel 和 value preview 修补
  - 已更新 `tests/unit/intent-e2e-service.spec.ts`
  - 已更新 `tests/unit/test-generator.spec.ts`
- 验证：
  - `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/test-generator.spec.ts`
  - `npm run build`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
- 度量：
  - `auto_run_rate`：`N/A`（本轮不改入口分流）
  - `blocked_rate`：`N/A`（本轮不改 blocked flow）
  - `first_pass_rate`：`N/A`（本轮未回放真实 run 样本）
  - `terminal_pass_rate`：`N/A`（本轮未回放真实 run 样本）
  - `top_failure_reasons`：`N/A`（本轮未做真实 run 样本统计）
- 当前阶段状态：
  - `S1`：已完成
  - `S2`：已完成
  - `S3`：已完成
  - `S4`：已完成（`S4a`、`S4b`、`S4c` 代码切片已完成）
  - `S5`：已完成
  - `S6`：已完成
- 风险 / 未完成：
  - 本轮证据仍来自上一轮 helper log 的 `meta`，不是新增 artifact 文件
  - 仍然没有失败瞬间 DOM dump；repair 证据链还是围绕“初始 analyze / 最新 observation / 执行日志”三者
  - worker / artifact 协议保持不变，继续维持最小切片
- 下一步：
  - 若继续 `S6+`
  - 再评估是否还有必要补更重的 repair runtime evidence 候选；当前最小可用结构化证据已经补齐

## 2026-04-02 更新（S6+：shared session 最小会话复用）

- 本轮目标：
  - 不改 `S1-S6`、`S6+ DOM delta`、`S6+ structured data evidence` 的既有结论
  - 只补最小 shared-session 复用能力：按 `credential.accountRef` 复用 `storageState`
  - 不引入新的账号池系统，不做跨进程 / 跨重启持久化
- 已完成：
  - 已新增 `docs/intent-e2e-s6plus-shared-session-task-brief-2026-04-02.md`
  - 已新增 `lib/intent-e2e-shared-session-cache.ts`，提供进程内 shared-session cache helper
  - `lib/ai/intent-e2e-service.ts` 的 precheck 链路现在会：
    - 在 `sessionMode=shared` 且存在 `accountRef` 时优先命中 shared session
    - 复用上一轮 precheck 成功拿到的 `storageState`
    - 命中 stale session 且出现 `auth_failed` 时自动清空缓存并回退一次显式登录前置检查
  - `lib/page-analyzer.ts` 的 `precheckPageAccess` 现可消费外部传入的 `storageState`
  - `lib/intent-runner-adapter.ts`、`lib/test-executor.ts`、`lib/test-worker.mjs` 现已把 precheck 得到的 `storageState` 透传到真实执行 worker，形成跨 run 最小会话复用闭环
  - 已更新 `tests/unit/intent-e2e-service.spec.ts`
  - 已更新 `tests/unit/test-executor.spec.ts`
- 验证：
  - `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/test-executor.spec.ts`
  - `npm run build`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
- 度量：
  - `auto_run_rate`：`N/A`（本轮不改入口分流）
  - `blocked_rate`：`N/A`（本轮不改 blocked flow）
  - `first_pass_rate`：`N/A`（本轮未回放真实 run 样本）
  - `terminal_pass_rate`：`N/A`（本轮未回放真实 run 样本）
  - `top_failure_reasons`：`N/A`（本轮未做真实 run 样本统计）
- 当前阶段状态：
  - `S1`：已完成
  - `S2`：已完成
  - `S3`：已完成
  - `S4`：已完成（`S4a`、`S4b`、`S4c` 代码切片已完成）
  - `S5`：已完成
  - `S6`：已完成
- 风险 / 未完成：
  - shared session cache 目前只在当前 Node 进程内生效；服务重启后不会保留
  - 本轮不做 worker 执行后的 session 回写；共享会话仍以 precheck 成功结果为准
  - 本轮只处理 `auth_failed` 型 stale fallback，不引入更复杂的 freshness / lease 语义
- 下一步：
  - `S6+` 的最小候选项已经补齐
  - 若继续 success hardening，应先回真实 run 指标，再决定是否还需要更重的候选能力

## 2026-04-02 更新（post-rerun：business list page-ready ownership ready）

- 本轮目标：
  - 只修同场景 rerun 暴露出的最新入口缺口：
    - 商机列表 page-ready 阶段不再回流 `getByText('我创建的').first()` 这类裸文本可见性断言
  - 不改 runtime helper，不并行扩到 `status_evidence_missing`
- 已完成：
  - 已新增 `docs/intent-e2e-business-list-ownership-ready-task-brief-2026-04-02.md`
  - `lib/intent-execution-compiler.ts`
    - 新增 business-list page-ready step 识别与指令收口
    - 对这类 step 的 `goal / requiredAssertions` 改写为：
      - 列表主区域 ready
      - `新建商机` 按钮 / 可见搜索框 / 列表容器作为稳定 surface
      - 明确禁止在页面 ready 阶段直接写 `getByText('我创建的').first()`
  - `lib/test-generator.ts`
    - 通用 generate prompt 新增同一条默认约束：
      - 进入商机列表页并确认页面就绪时，不要把裸 `我创建的` 文本当稳定锚点
    - repair diagnosis 新增定向提示：
      - 当 `Step 1` / page-ready 阶段因为 `getByText('我创建的').first()` 失败时，明确改回“URL + 新建按钮 + 搜索框/列表容器 ready”
  - 已更新：
    - `tests/unit/intent-execution-compiler.spec.ts`
    - `tests/unit/test-generator.spec.ts`
- 验证：
  - `npx vitest run tests/unit/intent-execution-compiler.spec.ts tests/unit/test-generator.spec.ts`
  - `npm run build`
  - `node scripts/check-doc-links.mjs`
- 度量：
  - `auto_run_rate`：`N/A`（本轮不改入口分流）
  - `blocked_rate`：`N/A`（本轮不改 blocked flow）
  - `first_pass_rate`：`N/A`（本轮未在新代码上 rerun）
  - `terminal_pass_rate`：`N/A`（本轮未在新代码上 rerun）
  - `top_failure_reasons`：参考 `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`
- 当前阶段状态：
  - `S1`：已完成
  - `S2`：已完成
  - `S3`：已完成
  - `S4`：已完成（`S4a`、`S4b`、`S4c` 代码切片已完成）
  - `S5`：已完成
  - `S6`：已完成
- 风险 / 未完成：
  - 本轮只收口“页面 ready 阶段的 ownership text assertion”，没有改 `status_evidence_missing`
  - 本轮不改 `lib/test-worker.mjs`，因此不验证 runtime helper 行为变化
  - 真实 UAT 效果仍需同场景 rerun 才能确认
- 下一步：
  - 用同一真实场景 rerun `3` 次
  - 若 `Step 1` 的裸 `我创建的` 失败退出主链，则下一刀只处理 `status_evidence_missing`
  - 若 rerun 仍卡在同一入口，则继续只围绕 business-list ownership ready 收口，不扩题

## 2026-04-03 更新（post-closeout：S4 family 指标回写 + post-R14 success hardening close-out）

- 本轮目标：
  - 不再新增 success hardening 主切片
  - 只补齐 `S4` 在主计划里要求的 family 粒度回写
  - 把 `S1-S6` 和已完成的 `S6+` 最小候选切片正式收尾
- 已完成：
  - 已重新核对主计划、`S6` brief 和最新真实 rerun 结论，确认：
    - fixture sample 不属于 `S1-S6` 主承诺范围
    - 当前需要补平的是 `S4` family 粒度度量与阶段 close-out，不是继续扩功能
  - 已基于当前项目 `proj_default` 的 `/api/intent-e2e/insights` 结果补回 `S4` 最小指标：
    - 当前样本窗口内，唯一被真实识别并进入 tracked stats 的 family 为：
      - `business_create_list_verify`
    - `priorityScenarioFamilies` 显示：
      - `totalRuns = 50`
      - `firstPassPassedRuns = 0`
      - `firstPassPassRate = 0%`
      - `passedRuns = 1`
      - `terminalPassRate = 2%`
    - `untracked_rate` 可按同一窗口回写为：
      - `0 / 50 = 0%`
      - 当前窗口没有 `untracked` terminal run 混入
    - `recipe_hit_rate` 现阶段先按 `recentTraces` 窗口做 proxy 回写：
      - 最近 `8` 条 trace 中，有 `6` 条出现 `patchedRecipeSlugs`
      - proxy `recipe_hit_rate = 6 / 8 = 75%`
  - 已确认最新真实 rerun：
    - `intent-run-1380901e-09ef-48d6-befa-63d10ca7c69b`
    - 已终态通过，说明本轮之前的 `Step 7 row-action detail surface propagation` 收口已经真实生效
  - 已把本计划中的 `S1-S6` 验收 checklist 全部对齐为已完成状态
- 验证：
  - 通过 dev server 读取：
    - `/api/intent-e2e/insights?projectUid=proj_default`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
- 度量：
  - `auto_run_rate`：`N/A`（本轮只做 close-out，不改入口分流）
  - `blocked_rate`：`N/A`（本轮只做 close-out，不改 blocked flow）
  - `first_pass_rate`：
    - `business_create_list_verify = 0 / 50 = 0%`
  - `terminal_pass_rate`：
    - `business_create_list_verify = 1 / 50 = 2%`
  - `top_failure_reasons`：
    - 当前项目窗口仍主要被 `no_hit = 25 / 50 = 50%`
    - 与 `asset_missing = 22 / 50 = 44%`
    - 主导，不是 `S4` family route 本身继续失效
  - `recipe_hit_rate`：
    - 最近 `8` 条 `recentTraces` proxy = `6 / 8 = 75%`
  - `untracked_rate`：
    - 当前项目 terminal window = `0 / 50 = 0%`
- 当前阶段状态：
  - `S1`：已完成
  - `S2`：已完成
  - `S3`：已完成
  - `S4`：已完成（代码切片与 family 粒度最小回写均已完成）
  - `S5`：已完成
  - `S6`：已完成
- 风险 / 未完成：
  - 当前 `proj_default` 样本窗口高度集中在 `business_create_list_verify`，因此本轮只能对这个 family 做真实回写；其它已落地 family 仍缺足够真实样本
  - `recipe_hit_rate` 当前只能基于 `recentTraces` 做 proxy 统计，不是全量历史聚合字段
  - 最新通过样本里仍有：
    - `Cannot read properties of null (reading 'forEach')`
    这类非阻塞噪音，但不属于本计划主承诺范围
- 下一步：
  - `S1-S6` 与当前已落地的 `S6+` 最小候选切片已正式完成
  - 若继续 success hardening，只能另起 brief，单收：
    - `repair convergence efficiency`
    - 或非阻塞运行时噪音

## 目标口径

### 不建议承诺的目标

- 不承诺“任意一句自然语言 + 图片，一键 95%-100% 自动通过”
- 不承诺开放式任务的 100% terminal pass

### 建议承诺的目标

对已 onboarding、已具备项目资产、且命中高频 family 的任务，逐步追到：

- `first_pass_rate`: `50%-70%`
- `terminal_pass_rate`: `85%-92%`
- “失败后无下一步动作”接近 `0`

## 最终判断

当前阶段最短路径不是继续加 repair 次数，也不是立刻重写成全新的 agent architecture。

最短路径是：

1. 先把低置信任务拦在入口
2. 再把失败结果转成明确动作
3. 再把高频 family 做 deterministic 化
4. 最后补 fixture 和执行层硬短板

如果评估通过，建议先从 `P0` 开始落地。

## 固定回写模板

每完成一个切片，按下面模板回写到：

- 本文档
- 当前 roadmap 最新一条更新

```md
## 2026-XX-XX 更新（Sx：一句话标题）

- 本轮目标：
  - 本轮只解决什么
- 已完成：
  - 改了哪些文件
  - 行为上收口了什么
- 验证：
  - `npm run build`
  - `npx vitest run ...`
  - 其它实际执行过的命令
- 度量：
  - `auto_run_rate`：
  - `blocked_rate`：
  - `first_pass_rate`：
  - `terminal_pass_rate`：
  - `top_failure_reasons`：
- 当前阶段状态：
  - `S1`：已完成 / 进行中 / 待开始
  - `S2`：已完成 / 进行中 / 待开始
  - `S3`：已完成 / 进行中 / 待开始
  - `S4`：已完成 / 进行中 / 待开始
  - `S5`：已完成 / 进行中 / 待开始
  - `S6`：已完成 / 进行中 / 待开始
- 风险 / 未完成：
  - 本轮故意没做什么
  - 还剩什么出口
- 下一步：
  - 下一个切片编号
  - 下一刀只处理什么
```
