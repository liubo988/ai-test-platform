# Intent E2E 90+ 成功率 Codex 实施 Brief（2026-04-13）

## 文档定位

这份文档是下一轮 `intent-e2e` 成功率专项的**当前实施 brief**。

它的用途是：

- 作为下一次 Codex 开发的主任务说明
- 约束开发范围、阶段目标、验证方式和交付格式
- 把“高成功率专项”从泛泛 roadmap 收口成可执行的工程任务

除非后续工作被明确拆成相互独立的小切片，否则不要再额外新开一份并行 brief。

这份文档**不替代**以下主线文档：

- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`

它只把当前任务收口成一句话：

> 通过减少自由生成、强化 family 路由、提升 verifier 证据质量、建立 eval 驱动门禁，把 `AI生成` 主链路往高成功率方向实打实推进。

## 先读这些

开始任何代码改动前，必须先读：

1. `AGENTS.md`
2. `README.md`
3. `docs/architecture.md`
4. `docs/testing.md`
5. `docs/runbook.md`
6. `docs/task-brief-template.md`
7. `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
8. `docs/intent-e2e-production-roadmap-2026-03-29.md`
9. `docs/intent-e2e-success-hardening-plan-2026-04-01.md`
10. `docs/intent-e2e-experience-recall-playbook-plan-2026-04-09.md`

另外还要读这些近期 hardening brief，用来理解“哪些能力已经落地，哪些收益还只是场景专项收口”：

1. `docs/intent-e2e-ai-generate-closure-task-brief-2026-04-07.md`
2. `docs/intent-e2e-final-four-hardening-task-brief-2026-04-09.md`
3. `docs/intent-e2e-successful-run-code-reuse-task-brief-2026-04-07.md`
4. `docs/intent-e2e-progressed-run-code-reuse-task-brief-2026-04-13.md`
5. `docs/intent-e2e-batch-account-payment-submit-wait-softening-task-brief-2026-04-13.md`
6. `docs/intent-e2e-batch-account-bookedmgmt-search-and-rowtext-idempotence-task-brief-2026-04-13.md`
7. `docs/intent-e2e-batch-account-bookedmgmt-order-existence-multi-match-task-brief-2026-04-13.md`
8. `docs/intent-e2e-no-hit-repair-budget-task-brief-2026-04-13.md`
9. `docs/intent-e2e-test-executor-ts-fallback-ternary-guard-task-brief-2026-04-13.md`

动手前，还必须对照这些主链路文件确认当前真实状态：

- `lib/ai/intent-e2e-service.ts`
- `lib/intent-execution-compiler.ts`
- `lib/test-executor.ts`
- `lib/intent-e2e-launch-decision.ts`
- `lib/intent-e2e-asset-readiness.ts`
- `lib/intent-e2e-experience-search.ts`
- `lib/intent-e2e-run-review.ts`
- `lib/ai/intent-e2e-insights.ts`
- `lib/test-generator.ts`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-09T07-03-41-123Z-bench_4d5ceaef9de4-ai-holdout-final-four-2026-04-09-current.json`

## 当前必须承认的事实

这些不是猜测。改代码前，必须基于源码和 benchmark 再确认一遍。

1. 当前方向是对的，但系统还远不是高成功率：
   - `firstPassPassRate = 24`
   - `repairedPassRate = 6`
   - `terminalPassRate = 30`
   - 复杂企业流 `terminalPassRate = 23`

2. 主链路里仍然保留了大量自由代码生成：
   - 已有 `compileIntentExecutionTemplate(...)`
   - 但 generate 没命中复用时仍会回退到 `generateTest(...)`
   - repair 仍会回退到 `repairTest(...)`

3. 当前头部失败类仍然是：
   - `assertion_too_strict`
   - `unknown`
   - `repair_stagnated`
   - `data_missing`
   - `selector_drift`

4. 现在已经落地了一批面向成功率的能力：
   - `launch decision`
   - `assetReadiness` 与 `no_hit`
   - successful run code reuse
   - progressed run code reuse
   - experience recall
   - project-scoped playbook recipe promotion
   - deferred run review
   - OCR visual anchors

5. “能力已落地”不等于“benchmark 已兑现收益”：
   - 当前 `playbookHitRate` 仍然是 `0`
   - final-four follow-up 之后的 compare 结果仍基本没变

6. 执行器里仍保留了 TypeScript-to-JavaScript fallback：
   - 这不是无害兼容细节
   - 它已经制造过真实的生成代码损坏

7. 最近一大部分收益仍来自场景专项 deterministic hardening：
   - 尤其是 `batch-account`
   - 这说明很多知识还困在 sanitizer / patch 里，没有上升成可复用的 family 资产

## 目标定义

不要朝错的目标优化。

本专项的目标**不是**：

- “任意自然语言浏览器任务都达到 `95%-100%`”
- “开放式一键 `AI生成` 对所有任务都稳定可靠”

本专项的目标是：

1. 短期目标：
   - 减少低置信任务浪费性 `auto_run`
   - 缩小关键路径上的自由生成面
   - 让更多失败变成显式的资产缺口 / readiness 缺口 / verifier 缺口

2. 中期目标：
   - 把 top `3-5` 个高价值 family 做成工业化能力
   - 每个 family 至少具备 router、recipe skeleton、stable identifier path、verifier contract、readiness/fixture contract

3. 长期目标：
   - 对已 onboarding、资产齐全、命中高频 family 的任务，把 terminal pass 往 `90%+` 推进
   - 不对开放式任务宣称 `90%+`

## 设计原则

1. 不允许回退成“纯 prompt 生成整段脚本”。
2. 不允许把增加 repair 次数当成核心策略。
3. 不允许继续保留大块 `unknown`。
4. 不允许让知识长期困在一次性 sanitizer 里；能提升成 recipe / helper / verifier / family 资产的，要尽快提升。
5. 优先结构化中间产物，而不是自由文本。
6. 优先服务端门禁，而不是只做 UI 提示。
7. 没有 benchmark 证据，不允许声称成功率提升。
8. top family 的 first-pass 提升，比全局平均数的表面好看更重要。

## 可以向 Page Agent 借，但不要照搬它的产品假设

值得借的实现思路：

1. 输出归一化和 schema coercion：
   - 参考 `~/Workspace/page-agent/packages/core/src/utils/autoFixer.ts`

2. 框架适配层：
   - 参考 `~/Workspace/page-agent/packages/page-controller/src/patches/react.ts`
   - 参考 `~/Workspace/page-agent/packages/page-controller/src/patches/antd.ts`

3. 浏览器状态摘要：
   - 参考 `~/Workspace/page-agent/packages/page-controller/src/PageController.ts`

4. durable history 与 transient activity 的 UI 分层：
   - 参考 `~/Workspace/page-agent/packages/ui/src/panel/Panel.ts`

不要照搬的假设：

1. 用 DOM-only 浏览器理解作为复杂企业 E2E 的主要成功路径
2. 用通用 tool-loop 作为高成功率主链路
3. 把“更好的 sanitized HTML”当成 verifier / readiness / governance 的替代品

## 下一次 Codex 默认执行范围

下一次 Codex run **只允许完成 `Phase 0`**。

不要一轮里摊开所有后续 phase。
必须在 `Phase 0` 的代码、测试、验证、roadmap / 文档回写都完成后再收尾。

## Phase 0：先止血，先把自由度关小

### 目标

先削掉最值钱的浪费点，再谈后续 family 工业化。

### 期望结果

1. 低置信任务不再默认进入完整 `auto_run`
2. 命中高置信 family 的任务更少走自由 generate / repair
3. `unknown` 明显缩小，并且更可行动
4. 执行器兼容 fallback 不再在主链路里制造假失败

### 必做改动

#### P0-1. 收紧 launch gating

强化 `lib/intent-e2e-launch-decision.ts`，让 readiness 不足的请求更少进入 `auto_run`。

期望方向：

- 没有稳定 family / recipe / verifier path -> 更倾向 `draft_only`
- 写数据任务缺少 fixture/readiness contract -> 更倾向 `needs_fixture`
- repeated failure pressure -> 更严格抑制
- 低信息量的截图型请求 -> 更严格 `needs_clarify`

所有决策必须显式、可观测，不要静默降级。

#### P0-2. 减少 matched family 的自由生成

在 `lib/ai/intent-e2e-service.ts` 中，让高置信命中的 family 更依赖：

- compiled deterministic skeleton
- structured slot patch
- 有边界的 fallback

期望方向：

- 当 top family 命中足够强时，优先走结构化生成 / 结构化 patch 路线
- 如果系统仍必须回退到 `generateTest(...)` 或 `repairTest(...)`，要显式打出 reason signal
- 不允许高置信 family 请求默认表现得和开放式自由生成任务一样

这一轮不要求一次性删除所有 fallback。
但必须让“优先路径更窄、更明确”。

#### P0-3. 把 `unknown` 拆成可行动失败类

调整 triage 与 insights，不能再把 `unknown` 当垃圾桶。

至少尝试往这些方向拆：

- `ui_anchor_missing`
- `response_missing`
- `record_lookup_miss`
- `auth_state_invalid`
- `fixture_contract_missing`
- `repair_non_progress`
- `runtime_syntax_damage`

如果需要贴合现有命名风格，可以调整名字，但语义不能变。

目标是让后续 hardening 决策靠证据，不靠感觉。

#### P0-4. 收紧执行器路径

`lib/test-executor.ts` 不能再为了兼容而损坏合法 JavaScript。

期望方向：

- 对 `tsToJs(...)` 增加更严格的 guard
- 安全性不明确时，优先 fail-fast 并输出显式信号，而不是“best effort”改写
- 降低合法 repair 输出变成无效 worker 代码的概率

这一轮不要过度设计成完整 parser。
但必须消灭当前已知那类“静默损坏代码”的问题。

#### P0-5. 让自由 fallback 变成显式技术债，而不是隐形魔法

凡是系统仍依赖以下路径时：

- 整段 generate fallback
- 整段 repair fallback
- 只靠 sanitizer 抢救场景

都要补显式 telemetry 或 attempt metadata，让这些情况在 run artifact 和 insights 里可见。

系统必须能清楚区分：

- 这次成功是命中了窄而稳的 deterministic 资产
- 还是侥幸走通了自由生成路径

### Phase 0 范围

主文件：

- `lib/ai/intent-e2e-service.ts`
- `lib/intent-e2e-launch-decision.ts`
- `lib/test-executor.ts`
- `lib/ai/intent-e2e-insights.ts`
- `lib/intent-e2e-run-review.ts`

大概率要补的测试：

- `tests/unit/intent-e2e-service.spec.ts`
- `tests/unit/intent-e2e-launch-decision.spec.ts`
- `tests/unit/test-executor.spec.ts`
- `tests/unit/intent-e2e-insights.spec.ts`
- `tests/unit/intent-execution-compiler.spec.ts`
- `tests/unit/test-generator.spec.ts`

### Phase 0 验收标准

1. 低置信请求更少 `auto_run`
2. 高置信 family 更少直接掉进开放式自由生成
3. `unknown` 被明显缩小，或被拆成更具体的 bucket
4. 执行器 fallback 误伤的已知回归有测试覆盖
5. 所有行为变化都被同步反映到测试和文档

### Phase 0 验证命令

至少跑：

```bash
npm run build
npx vitest run tests/unit/intent-e2e-service.spec.ts
npx vitest run tests/unit/intent-e2e-launch-decision.spec.ts
npx vitest run tests/unit/test-executor.spec.ts
npx vitest run tests/unit/intent-e2e-insights.spec.ts
npx vitest run tests/unit/intent-execution-compiler.spec.ts
npx vitest run tests/unit/test-generator.spec.ts
node scripts/check-doc-links.mjs
node scripts/check-roadmap-progress.mjs
bash scripts/check-boundaries.sh
```

如果改动影响 workbench 交互或 route 装配，再补：

```bash
npm run build:web
npm run test:e2e
```

如果改动影响 benchmark 或 family SLO 统计口径，再补：

```bash
npm run intent:benchmark:compare -- --project-uid proj_default
```

## Phase 1：Top Families 工业化

这一阶段是 `Phase 0` 完成后的后续 backlog。

### 目标

把 top `3` 个最有价值的 family 变成可复用的工业资产，而不是继续堆一堆 live patch。

### Family 选择规则

不允许凭感觉选 family。
必须综合使用：

- frozen benchmark
- recent traces
- failure clusters
- business value

建议优先候选：

1. `business_create_list_verify`
2. `list_search_detail_verify`
3. `ui_antd_modal_drawer_save`

如果 recent evidence 明确证明 `batch-account` 更有价值，可以替换其中一个，但必须给证据。

### 每个 Family 必须具备

1. router signal
2. deterministic recipe skeleton
3. stable identifier extraction path
4. verifier contract
5. readiness/fixture contract
6. regression benchmark coverage

### 预期涉及文件

- `lib/intent-execution-compiler.ts`
- `lib/ai/intent-e2e-service.ts`
- `lib/test-generator.ts`
- `lib/intent-e2e-experience-search.ts`
- `reports/intent-e2e/projects/<projectUid>/intent-e2e.project-recipes.json`
- 对应 unit tests

## Phase 2：Runtime Adapter 与结构化归一化

这一阶段是 `Phase 1` 之后的后续 backlog。

### 目标

减少对 prompt 的框架细节依赖，减少模型输出格式脆弱性。

### 期望方向

1. 增加 React / AntD 的 runtime adapter 层
2. 增加统一的结构化输出 normalizer 层，覆盖：
   - scenario card
   - OCR summary
   - experience hints
   - structured repair patch
   - verifier patch
   - playbook candidate
3. 标准化 page/runtime evidence summary，供 repair 和 review 消费

### 说明

这一阶段可以借鉴 `page-agent` 的实现思路，但最终架构必须服从 `ai-test` 自己的分层边界和 benchmark 目标。

## Phase 3：Eval Gate 与 Family SLO

这一阶段是 `Phase 2` 之后的后续 backlog。

### 目标

让 benchmark 和 family-level SLO 成为 promotion 与 rollout 的默认门禁。

### 期望方向

1. 维护 family-level 冻结 benchmark 视图，而不只是全局均值
2. 至少跟踪：
   - `firstPassPassRate`
   - `terminalPassRate`
   - `blockedRate`
   - `unknownRate`
   - `playbookHitRate`
   - top failure reasons
3. 让 recipe / helper / knowledge / playbook promotion 依赖 benchmark 证据
4. 没有 fresh runs 和 compare 收益前，不允许宣称“代码已带来成功率提升”

## Phase 4：Fixture 与数据契约工业化

这一阶段是 `Phase 3` 之后的后续 backlog。
它**不属于下一次 Codex 默认执行范围**。

### 目标

把写数据和有状态验收流程，从“best effort + 环境/数据漂移”推进成“受控执行 + 显式 fixture / data contract”。

### 为什么重要

当前头部失败类里仍有 `data_missing`，而且部分 family 仍依赖不稳定环境状态。
如果 fixture 和数据契约不够强，单靠 verifier 质量无法把 terminal pass 再拉高一档。

### 期望方向

1. 把 fixture/readiness contract 提升成 family 一级资产
2. 为写数据流程定义 setup/cleanup ownership
3. 为有状态 family 定义最小契约：
   - setup strategy
   - cleanup strategy
   - stable record seed pattern
   - ownership/account assumptions
   - idempotency expectations
4. 在 triage、review、benchmark reporting 中清楚区分：
   - model failed
   - test data contract missing

### 预期涉及区域

- `runtimeGovernance`
- fixture execution helpers
- family-level readiness contracts
- run review / failure CTA / launch decision 消费链路
- 必要的 setup/cleanup integration tests

### 成功标准

1. 有状态 family 不再静默依赖人工数据准备
2. `data_missing` 更显式、也更可预防
3. fixture contract 不完整的写数据任务，更少浪费 generate / repair 预算

## Phase 5：资产提升自动化与 CI Rollout Gate

这一阶段是 `Phase 4` 之后的后续 backlog。
它**不属于下一次 Codex 默认执行范围**。

### 目标

把成功率提升从“人工驱动的局部经验”推进成“有治理、有 benchmark 证据支撑的 promotion / rollout gate”。

### 为什么重要

系统已经有：

- recipe promotion
- deferred review
- benchmark freeze / compare
- probation / rollback signals

但这些能力还需要更紧的集成，才能真正承担长期成功率治理的 rollout gate。

### 期望方向

1. Promotion pipeline：
   - successful run candidates
   - playbook candidates
   - helper recommendations
   - verifier improvements
   必须都经过显式证据与 promotion 规则

2. CI / rollout gate：
   - 没有 frozen benchmark 证据，不允许大规模 family promotion
   - rollback / degradation signals 活跃时，不允许高风险规则 promotion
   - 区分“本地有效”与“项目级可放量”

3. Family-level SLO dashboard 输入：
   - first pass
   - terminal pass
   - blocked rate
   - unknown rate
   - playbook hit rate
   - regression watchlist

4. Rollback discipline：
   - promotion history 必须可审计
   - rollback candidates 必须持续可见、可操作

### 预期涉及区域

- `lib/ai/intent-e2e-insights.ts`
- promotion / merge 流程
- benchmark compare 消费链路
- rollout / governance routes 或 services
- 面向 CI 的文档与脚本

### 成功标准

1. 资产 promotion 不再靠直觉或个别成功案例驱动
2. benchmark 证据成为真实的 merge / rollout 输入，而不是“可选报告”
3. 成功率工作能更可重复地推广到不同项目和 family

## 不要做这些事

1. 不要回退成纯 prompt 生成整段 E2E 脚本
2. 不要把增加 repair 次数当主要策略
3. 不要把自由格式 multi-agent browser loop 引进主链路
4. 不要把 `page-agent` 的产品假设直接套到 `ai-test`
5. 不要对开放式任务宣称 `90%+`
6. 不要只做分析就停。必须交付代码、测试、验证和文档更新

## 必须做的文档与 Roadmap 回写

如果 `Phase 0` 改动了主链路，必须更新：

1. `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
2. 本文档（如果实际范围、结果或后续优先级发生明显变化）

Roadmap 回写必须包含：

- 本轮目标
- 已完成
- 验证
- 当前结果
- 风险
- 下一步

不要写“更稳了”这类没有证据的空话。

## 最终汇报格式要求

执行这份 brief 的 Codex，在结束时必须按下面格式汇报：

1. 当前事实
   - 哪些已经真实落地
   - 哪些还只是 roadmap 目标

2. 本轮修改
   - 只写具体代码和文档改动

3. 验证证据
   - 跑了哪些命令
   - 通过/失败结果
   - 如果适用，补 benchmark 证据

4. 风险与下一步
   - 还有哪些问题没解决
   - 下一阶段应该先做什么

## 这份 Brief 的成功标准

如果下一次 Codex run 做到了下面 4 件事，就算这份 brief 真正发挥了作用：

1. 把 `Phase 0` 端到端做完
2. 留下更强的测试和可观测性
3. 缩小隐形自由 fallback 的面积
4. 最终产出的是明确证据，而不是乐观叙述
