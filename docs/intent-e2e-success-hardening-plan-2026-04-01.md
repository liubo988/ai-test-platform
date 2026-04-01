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

- `S1`：待开始
- `S2`：待开始
- `S3`：待开始
- `S4`：待开始
- `S5`：待开始
- `S6`：待开始

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

- [ ] `assetReadiness` 拆成 run 前资产可用性与 run 后完整 readiness 两层，语义边界清晰。
- [ ] `launch decision` 至少能区分 `auto_run / needs_bootstrap / needs_fixture / needs_clarify / draft_only`。
- [ ] 不改当前默认运行入口行为，只补底层能力。

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

- [ ] 新增 `launch-decision` route。
- [ ] `AI生成` 入口在 `needs_bootstrap / needs_fixture / needs_clarify / draft_only` 时不直接开跑。
- [ ] workbench 能展示 blocked flow 的基本解释与动作入口。

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

- [ ] blocker 类失败不再消耗完整 repair 配额。
- [ ] `asset_missing` 不再直接进入自动运行链路；分析后确认的 `no_hit` 不再默认跑满 repair。
- [ ] failure CTA 至少提供“补前置 / 生成知识草稿 / 改描述 / 转手动任务”。

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

#### 验收标准

- [ ] 首轮先落地 2-3 个最高频 family，验证稳定后再扩到 top 5。
- [ ] 已落地 family 的 route / helper / verifier 默认骨架稳定输出。
- [ ] 图片信号进入 family 路由，不再只是附件描述。
- [ ] 优先复用现有 `ScenarioCard / recipe registry / compiler / deterministic template` 收口能力，不另起一套路由框架。
- [ ] 不扩到更多 family，不顺手做通用 agent loop。

#### 范围

- 会改：
  - `lib/ai/scenario-card.ts`
  - `lib/intent-recipe-registry.ts`
  - `lib/intent-action-library.ts`
  - `lib/intent-execution-compiler.ts`
  - `lib/test-generator.ts`
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
- `npx vitest run tests/unit/scenario-card.spec.ts tests/unit/intent-action-library.spec.ts tests/unit/intent-execution-compiler.spec.ts tests/unit/test-generator.spec.ts tests/unit/test-generator-structured.spec.ts`
- `node scripts/check-doc-links.mjs`

### S5：repeated failure suppression

#### 本轮目标

- 对近期已知必败任务建立负向抑制，不再默认 `auto_run`。
- 把“同样的错继续重跑”改成“引导用户转下一个动作”。
- 基于现有 `snapshotSignature` 聚类和 `failure pressure` 结果做映射，不另造新的 suppression 系统。

#### 验收标准

- [ ] 相同 family / blocker / signature 的近期重复失败会影响 launch decision。
- [ ] workbench / run 入口能解释为什么本次不直接自动跑。
- [ ] 复用现有 `snapshotSignature / failure pressure baseline` 结果，不额外新增并行判定体系。
- [ ] 不改 benchmark / rollout / governance 主语义。

#### 范围

- 会改：
  - `lib/intent-e2e-launch-decision.ts`
  - `lib/ai/intent-e2e-insights.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `tests/unit/intent-e2e-launch-decision.spec.ts`
  - `tests/unit/intent-e2e-insights.spec.ts`
  - `tests/unit/intent-e2e-run-registry.spec.ts`
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

- [ ] mutating flow 在声明 fixture 时可真实执行 `setup / cleanup`。
- [ ] fixture 会注入并传递 `idempotencyKey / owner`。
- [ ] 不支持任意自由脚本，不引入外部依赖编排平台。

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
