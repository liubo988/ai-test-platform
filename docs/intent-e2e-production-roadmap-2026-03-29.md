# Intent 测试平台生产级路线图（2026-03-29）

## 文档目的

这份文档从 2026-03-29 起作为下一阶段主文档。

它接在 [intent-e2e-high-success-roadmap-2026-03-20.md](/Users/xiaolongbao/Workspace/ai-test/docs/intent-e2e-high-success-roadmap-2026-03-20.md) 之后使用，前一份文档的 `R0-R7` 已经完成；本文件不再讨论“当前系统能否把一个中后台页面 E2E 跑通”，而是讨论如何把现有能力推进到：

- 可集成其它系统
- 可支持多种测试类型
- 可进入 CI/CD 与发布流程
- 可作为生产级测试平台长期运营

后续每完成一个开发步骤，统一更新本文件的：

- 阶段状态
- 本轮完成内容
- 验证结果
- 当前风险
- 下一步

## 今日结论

- 当前系统已经具备“结构化 AI E2E 引擎”的核心骨架。
- 当前 `browser E2E` 主线方向没有错误；现阶段不应回退成“纯 prompt 生成脚本”或放弃真实端到端验收。
- 当前系统已经不只是 prompt 生成脚本，而是具备：
  - 结构化规划
  - 受控执行
  - 业务验收
  - 学习闭环
  - 治理与灰度建议
- 但当前系统仍然主要面向 `browser E2E`。
- 对当前开发优先级而言，最紧迫的问题不是“测试类型还不够多”，而是“多项目冷启动、资产隔离和 blocker 口径还没有补齐”。
- 如果下一阶段目标是“接其它系统的功能测试、单元测试、接口测试，并进入生产流程”，则必须把当前能力从“单类型高成功率引擎”升级成“多测试类型、强门禁、可运营的平台”。

## 当前架构判断（2026-03-29 补充）

- 现有 `intent-e2e` 方向应继续坚持：
  - 真实 browser E2E
  - 结构化 planning / execution / verification / repair
  - trace、insights、knowledge、governance 闭环
- 当前最关键的生产前置缺口，不是 `R8/R9` 里的“多测试类型抽象”本身，而是：
  - project knowledge 与 repair memory 仍偏全局资产
  - 新项目冷启动时缺少最小 onboarding contract
  - `knowledge hit = 0`、`asset missing`、`env/data blocked` 还没有单独治理口径
- 如果跳过这些前置缺口直接做 `R8/R9`，会把当前 browser E2E 的冷启动低成功率和串项目污染问题复制到更多 runner、更多系统和更多接入方。
- 因此本文件从本次更新起，补一个 `R7.5` 作为 `R8` 之前的生产前 prerequisite：先把“同一套引擎在多个项目里可安全复用”做对，再继续往多测试类型平台演进。

## 当前基础与限制

### 已具备的基础

- 已有结构化执行主链路：
  - [lib/ai/intent-e2e-service.ts](/Users/xiaolongbao/Workspace/ai-test/lib/ai/intent-e2e-service.ts)
  - [lib/intent-execution-compiler.ts](/Users/xiaolongbao/Workspace/ai-test/lib/intent-execution-compiler.ts)
  - [lib/intent-action-dsl.ts](/Users/xiaolongbao/Workspace/ai-test/lib/intent-action-dsl.ts)
  - [lib/test-worker.mjs](/Users/xiaolongbao/Workspace/ai-test/lib/test-worker.mjs)
- 已有 run / trace / insights 基础设施：
  - [lib/ai/intent-e2e-run-registry.ts](/Users/xiaolongbao/Workspace/ai-test/lib/ai/intent-e2e-run-registry.ts)
  - [lib/ai/intent-e2e-insights.ts](/Users/xiaolongbao/Workspace/ai-test/lib/ai/intent-e2e-insights.ts)
  - [app/api/intent-e2e/insights/route.ts](/Users/xiaolongbao/Workspace/ai-test/app/api/intent-e2e/insights/route.ts)
- 已有 recipe / knowledge / governance 闭环：
  - [lib/intent-project-recipe-governance.ts](/Users/xiaolongbao/Workspace/ai-test/lib/intent-project-recipe-governance.ts)
  - [lib/intent-project-knowledge-draft.ts](/Users/xiaolongbao/Workspace/ai-test/lib/intent-project-knowledge-draft.ts)
  - [app/api/intent-e2e/project-knowledge/merge/route.ts](/Users/xiaolongbao/Workspace/ai-test/app/api/intent-e2e/project-knowledge/merge/route.ts)
- 已有工作台入口：
  - [components/IntentE2EWorkbench.tsx](/Users/xiaolongbao/Workspace/ai-test/components/IntentE2EWorkbench.tsx)

### 当前限制

- 执行模型仍偏 `Playwright/browser E2E`。
- project knowledge 与 repair memory 目前默认仍是全局文件，不是严格 `project-scoped` 资产；换项目时存在知识误命中、经验串扰和冷启动 `knowledge hit = 0` 的风险。
- 新项目缺少最小 onboarding contract；当前 `AI生成` 在“没有项目资产可用”时，仍可能继续消耗 generate / repair 配额，而不是显式提示“当前项目尚未具备冷启动资产”。
- `env_transient / auth_failed / data_missing` 这类 blocker 仍会污染成功率口径，影响不同项目之间的真实质量比较。
- `rolloutStrategy` 目前是统一洞察输出，不是真正接入发布链路的服务端强门禁。
- `evaluationBaseline` 已可用，但还不是“版本化、冻结、可复放”的生产级 benchmark 套件。
- 环境、账号、数据、凭证、并发、工件、CI/CD 还没有形成平台级治理。
- 对“其它系统功能测试 / 单元测试”的支持，还没有统一测试类型模型和 runner adapter。

## 下一阶段目标

下一阶段目标不是继续补单个 helper，而是把当前系统升级成：

1. `多项目冷启动与资产隔离`
2. `多测试类型统一平台`
3. `服务端强门禁与真实灰度放量`
4. `可冻结评测集与版本化回归`
5. `环境 / 账号 / 数据 / 凭证治理`
6. `队列 / 并发 / 工件 / flaky 管理`
7. `CI/CD 接入与多系统低成本接入`

## 生产级定义

达到本文件目标后，平台至少要满足：

- 可以支持不止一种测试类型：
  - `browser_e2e`
  - `api_flow`
  - `repo_test`
  - `contract_check`
- 同一套 run registry / audit / insights 能统一承接这些类型。
- 放量、推广、合并不再只靠人工看工作台，而有服务端强约束。
- 核心评测集可版本化、冻结、回放、对比。
- 环境、账号、测试数据是受控资产，不是临时手工维护。
- 新系统接入时，不需要对核心引擎做一轮业务定制开发。

## 设计原则

- 不再走“继续堆 prompt”路线。
- 不允许把其它测试类型硬塞进现有 Playwright 语义。
- 不允许继续做业务特定主键逻辑当平台能力。
- 所有新增能力优先走：
  - 结构化 schema
  - adapter contract
  - audit / provenance
  - insights 可观测
- 能做成服务端强门禁的，不只做成工作台提示。
- 能做成通用系统接入规范的，不做成某个业务系统专用分支。

## 阶段状态

- R7.5：多项目冷启动与资产隔离，已完成（第三刀已完成：blocked run split + model-quality rate）
- R8：统一测试类型抽象与资产模型，已完成（第六十刀已完成：R8 close-out）
- R9：Runner Adapter 化与非 UI 执行主链路，已完成（第九刀已完成：R9 close-out）
- R10：版本化评测集与冻结基准，已完成（第一刀已完成：R10 close-out）
- R11：服务端强门禁与真实灰度放量，已完成（第二刀已完成：R11 close-out）
- R12：环境 / 账号 / 数据治理，已完成（第四刀已完成：R12 close-out）
- R13：调度、可靠性与工件平台，已完成（第一刀已完成：R13 close-out）
- R14：CI/CD 接入与多系统接入模板，已完成（第一刀已完成：R14 close-out）

## R7.5：多项目冷启动与资产隔离

### 目标

在进入 `R8` 之前，先把当前 `browser E2E` 引擎补齐为“可在多个项目里安全复用”的状态，直接解决换项目后 `AI生成` 冷启动失败率高、资产串扰和成功率口径失真的问题。

### 交付物

- `project-scoped knowledge`：
  - `projectUid -> knowledge profile path` 的显式映射
  - 兼容当前全局 `intent-e2e.project-knowledge.json` 作为 legacy fallback，而不是继续把它当默认长期方案
- `project-scoped repair memory`：
  - `projectUid -> repair memory path` 的显式映射
  - repair hint 召回不再默认跨项目共享
- `project onboarding bootstrap contract`：
  - 先提供最小 manifest，而不是一步做完整平台 manifest
  - 至少包含：
    - `baseUrl / login entry / targetUrl family`
    - `stable identifier hints`
    - `key response patterns`
    - `default list ownership / detail entry hints`
    - `first 3~5 gold flows`
- `cold-start guardrail`：
  - 当项目资产缺失、`knowledge hit = 0` 或 onboarding 未完成时，workbench / run snapshot / insights 能显式返回 `asset_missing / no_hit` 级别信号
  - 不再盲目消耗多轮 repair 配额
- `blocked run split`：
  - 将 `env_transient / auth_failed / data_missing / permission_blocked` 与模型质量口径分桶
  - 这里只做口径和洞察输入，不展开完整账号池、fixture、secret 治理；完整治理仍归 `R12`

### 重点入口

- [lib/intent-project-knowledge.ts](/Users/xiaolongbao/Workspace/ai-test/lib/intent-project-knowledge.ts)
- [lib/ai/intent-repair-memory.ts](/Users/xiaolongbao/Workspace/ai-test/lib/ai/intent-repair-memory.ts)
- [lib/ai/intent-e2e-service.ts](/Users/xiaolongbao/Workspace/ai-test/lib/ai/intent-e2e-service.ts)
- [lib/ai/intent-e2e-insights.ts](/Users/xiaolongbao/Workspace/ai-test/lib/ai/intent-e2e-insights.ts)
- [components/IntentE2EWorkbench.tsx](/Users/xiaolongbao/Workspace/ai-test/components/IntentE2EWorkbench.tsx)

### 完成标准

- 同一套引擎在不同 `projectUid` 下，不再默认读写同一份 knowledge / repair memory 资产。
- 新项目在没有资产时，会明确暴露“冷启动未完成”，而不是伪装成“模型纯失败”后继续重试。
- 洞察和后续 gate 口径能明确区分：
  - `model_quality`
  - `environment / auth / data blocked`
- 同一项目随着运行积累，可以提升自身 `AI生成` 首轮和 repair 成功率；这些收益不会直接污染其它项目。

## R8：统一测试类型抽象与资产模型

### 目标

把当前偏 `browser E2E` 的任务模型提升为统一测试资产模型，避免后续接入 API / repo test / contract test 时继续绕着 Playwright 打补丁。

### 交付物

- 统一测试类型枚举，至少明确：
  - `browser_e2e`
  - `api_flow`
  - `repo_test`
  - `contract_check`
- 统一测试资产 schema：
  - `testCase`
  - `testSpec`
  - `runnerType`
  - `verificationContract`
  - `artifactContract`
- run snapshot / run registry / insights 的通用字段与类型字段分层。
- 对现有 `intent-e2e` 主链路做兼容包装，而不是直接推翻。

### 重点入口

- [lib/ai/intent-e2e-service.ts](/Users/xiaolongbao/Workspace/ai-test/lib/ai/intent-e2e-service.ts)
- [lib/ai/intent-e2e-run-registry.ts](/Users/xiaolongbao/Workspace/ai-test/lib/ai/intent-e2e-run-registry.ts)
- [app/api/intent-e2e/route.ts](/Users/xiaolongbao/Workspace/ai-test/app/api/intent-e2e/route.ts)

### 完成标准

- 不同测试类型可以共用同一套 run / audit / insights 主模型。
- 新测试类型不需要伪装成 Playwright 页面任务。
- 当前 browser E2E 旧能力不回退。

## R9：Runner Adapter 化与非 UI 执行主链路

### 目标

把“执行器”从单一路径扩成 adapter 体系，让平台能真正跑非 UI 测试，而不是只有 UI 页面自动化。

### 交付物

- 统一 runner adapter contract。
- 第一批 runner：
  - `playwright_runner`
  - `http_runner`
  - `repo_test_runner`
- `repo_test_runner` 必须是受控执行：
  - 不允许任意 shell 自由执行
  - 必须走 allowlist / manifest / repo-owned preset
- 统一 artifact 输出：
  - 日志
  - 断言结果
  - trace
  - 工件索引

### 重点入口

- [lib/test-worker.mjs](/Users/xiaolongbao/Workspace/ai-test/lib/test-worker.mjs)
- [lib/intent-execution-compiler.ts](/Users/xiaolongbao/Workspace/ai-test/lib/intent-execution-compiler.ts)
- [lib/intent-action-dsl.ts](/Users/xiaolongbao/Workspace/ai-test/lib/intent-action-dsl.ts)

### 完成标准

- 至少有 1 条非 UI 测试链路可以完整创建、执行、验收、留痕。
- `repo_test` 不依赖 Playwright 页面对象。
- 失败产物可以进入现有 insights / audit 链路。

## R10：版本化评测集与冻结基准

### 目标

把当前“从近期 run 聚合出来的可用 baseline”升级成“生产可签收的 benchmark 套件”。

### 交付物

- 版本化 eval suite / benchmark schema。
- 固定样本集的冻结、复放、比较机制。
- 按系统 / 模块 / 测试类型管理 benchmark。
- 发布前后基准对比报告。

### 重点入口

- [lib/ai/intent-e2e-insights.ts](/Users/xiaolongbao/Workspace/ai-test/lib/ai/intent-e2e-insights.ts)
- [app/api/intent-e2e/insights/route.ts](/Users/xiaolongbao/Workspace/ai-test/app/api/intent-e2e/insights/route.ts)
- [components/IntentE2EWorkbench.tsx](/Users/xiaolongbao/Workspace/ai-test/components/IntentE2EWorkbench.tsx)

### 完成标准

- 任一 release candidate 都能绑定一份冻结 benchmark。
- benchmark 的结果可复放、可追溯、可比较。
- 不再依赖“最近自然流量 run”充当唯一签收依据。

## R11：服务端强门禁与真实灰度放量

### 目标

把现在已经落地的 `rolloutStrategy` 从洞察建议升级成真正影响推广、合并、放量的服务端门禁。

### 交付物

- rollout policy schema。
- `hold / small_batch / full_release` 服务端判定与执行约束。
- 小流量灰度配额 / 命中窗口 / 升降级规则。
- override / canary / rollback 的统一审计回执。

### 重点入口

- [lib/ai/intent-e2e-insights.ts](/Users/xiaolongbao/Workspace/ai-test/lib/ai/intent-e2e-insights.ts)
- [app/api/intent-e2e/project-knowledge/merge/route.ts](/Users/xiaolongbao/Workspace/ai-test/app/api/intent-e2e/project-knowledge/merge/route.ts)
- [lib/intent-project-recipe-governance.ts](/Users/xiaolongbao/Workspace/ai-test/lib/intent-project-recipe-governance.ts)

### 完成标准

- “是否放量”不再只停留在 workbench 提示。
- 高风险状态下，服务端会阻止默认推广或要求显式 override。
- 灰度扩大与回滚都有统一审计记录。

## R12：环境 / 账号 / 数据治理

### 目标

解决生产级测试平台最容易失控的三件事：环境差异、账号污染、数据污染。

### 交付物

- 环境 profile：
  - `dev / test / uat / staging`
- 凭证引用机制：
  - secret reference
  - 不把明文凭证直接混入测试资产
- 账号池 / 会话治理。
- 测试数据 fixture / setup / cleanup / ownership contract。
- 数据污染与幂等约束。

### 重点入口

- [lib/ai/intent-e2e-request.ts](/Users/xiaolongbao/Workspace/ai-test/lib/ai/intent-e2e-request.ts)
- [lib/ai/intent-e2e-service.ts](/Users/xiaolongbao/Workspace/ai-test/lib/ai/intent-e2e-service.ts)
- [lib/services/intent-e2e-workspace-service.ts](/Users/xiaolongbao/Workspace/ai-test/lib/services/intent-e2e-workspace-service.ts)

### 完成标准

- 不同环境能用统一 schema 描述而不是手工换配置。
- 账号与数据资产可追踪、可回收、可隔离。
- 测试失败不会持续污染后续 run。

## R13：调度、可靠性与工件平台

### 目标

把当前“能跑单个任务”的执行系统，升级成“可长期稳定运营”的任务平台。

### 交付物

- 队列与并发配额。
- 任务优先级与取消机制。
- retry / replay / timeout 策略。
- flaky 标记与隔离。
- 工件归档与索引：
  - trace
  - log
  - screenshot
  - response summary
  - runner artifact

### 重点入口

- [lib/ai/intent-e2e-run-registry.ts](/Users/xiaolongbao/Workspace/ai-test/lib/ai/intent-e2e-run-registry.ts)
- [app/api/intent-e2e/runs/route.ts](/Users/xiaolongbao/Workspace/ai-test/app/api/intent-e2e/runs/route.ts)
- [app/api/intent-e2e/runs/[runId]/route.ts](/Users/xiaolongbao/Workspace/ai-test/app/api/intent-e2e/runs/[runId]/route.ts)
- [app/api/intent-e2e/runs/[runId]/stream/route.ts](/Users/xiaolongbao/Workspace/ai-test/app/api/intent-e2e/runs/[runId]/stream/route.ts)

### 完成标准

- 并发运行不会互相污染。
- flaky run 有稳定标记和追踪逻辑。
- 工件可检索、可追溯、可用于复盘。

## R14：CI/CD 接入与多系统接入模板

### 目标

把平台从“当前系统专用工作台”升级成“新系统可低成本接入的生产工具”。

### 交付物

- 新系统接入 manifest：
  - system profile
  - test type
  - env profile
  - credential reference
  - fixture strategy
  - benchmark binding
- CI/CD 接口：
  - PR gate
  - scheduled regression
  - release candidate validation
- 统一报告输出：
  - pass/fail
  - gate decision
  - benchmark compare
  - rollback recommendation

### 重点入口

- [app/api/intent-e2e/route.ts](/Users/xiaolongbao/Workspace/ai-test/app/api/intent-e2e/route.ts)
- [app/api/intent-e2e/runs/route.ts](/Users/xiaolongbao/Workspace/ai-test/app/api/intent-e2e/runs/route.ts)
- [components/IntentE2EWorkbench.tsx](/Users/xiaolongbao/Workspace/ai-test/components/IntentE2EWorkbench.tsx)

### 完成标准

- 新系统接入不需要改核心引擎语义。
- 平台可以输出可供 CI/CD 直接消费的 gate 结果。
- 至少完成 1 个非当前系统的新系统接入样板。

## 下一步固定顺序

当前开发已进入 `R8`；`R7.5` 的多项目生产前 prerequisite 已收口，后续继续沿统一测试类型抽象与资产模型推进。

### R7.5 已完成清单

`R7.5` 已按以下顺序落地完成：

1. `projectUid -> knowledge / repair memory` 路径解析与 backward-compatible fallback
2. 最小 onboarding bootstrap contract：
   - 登录入口
   - 目标 URL family
   - 稳定主键 / 关键接口 / 详情入口
   - 首批黄金流程
3. `knowledge hit = 0 / asset missing` 的 guardrail 与 workbench 提示
4. `env/auth/data blocked` 与模型质量成功率分桶

没有这一步，后面的 `R8/R9/R14` 会把当前 browser E2E 的冷启动问题和串项目污染问题复制到更多系统里。

### R8 当前第一优先级

当 `R7.5` 补齐后，再进入统一测试类型抽象与资产模型：

- 先解决“平台到底支持哪些测试类型”
- 再解决“不同测试类型怎么复用同一套 run / audit / insights”
- 最后才进入具体 runner adapter

这样做可以保证 `R8` 解决的是“平台扩展性”，而不是在错误的多项目资产模型上继续加抽象层。

## 进度更新模板

后续每次更新请追加一个新小节，格式固定为：

### YYYY-MM-DD 第 N 次更新（标题）

- 本轮目标：
- 已完成：
- 验证：
- 当前阶段状态：
- 风险 / 未完成：
- 下一步：

## 2026-03-29 首次落版

- 已确认上一份高成功率路线图 `R0-R7` 全部完成
- 已确认下一阶段目标切换为“生产级测试平台”
- 已确认下一步从 `R8：统一测试类型抽象与资产模型` 开始

## 2026-03-29 第二次更新（补前置阶段：R7.5 多项目冷启动与资产隔离）

- 本轮目标：
  - 把当前最紧迫的多项目冷启动、资产串扰与成功率口径问题，正式纳入生产级路线图，避免直接跳到 `R8` 后放大现有 browser E2E 的真实阻塞
- 已完成：
  - 明确记录“当前 `browser E2E` 主线方向正确，问题主要在多项目可用性与冷启动治理尚未补齐”
  - 在 `R8` 前新增 `R7.5：多项目冷启动与资产隔离`
  - 调整“下一步固定顺序”为先 `R7.5`，后 `R8`
- 验证：
  - `node scripts/check-doc-links.mjs`
- 当前阶段状态：
  - `R7.5`：待开始
  - `R8-R14`：待开始
- 风险 / 未完成：
  - `projectUid -> asset path` 的正式 schema 仍待设计
  - `asset_missing / no_hit / blocked` 的 run status、insights 口径和 UI 呈现还未落代码
  - `R7.5` 只解决多项目 browser E2E 的生产前 prerequisite，不替代后续 `R8-R14`
- 下一步：
  - 先实现 `project-scoped knowledge / repair memory` 路径解析与兼容旧全局文件的 fallback

## 2026-03-29 第三次更新（R7.5 第一刀：project-scoped knowledge / repair memory path isolation）

- 本轮目标：
  - 给 `projectUid` 补齐 knowledge / repair memory 的 project-aware path resolver，并把 draft / merge / backup / restore / 主运行链路都接到同一份项目级资产上
- 已完成：
  - 在 `lib/intent-project-knowledge.ts` 抽出共享的 project asset path resolver；`projectUid` 命中项目文件时优先读项目资产，项目文件不存在时读取阶段回退 legacy 全局文件，但写入阶段固定落项目文件
  - 在 `lib/ai/intent-repair-memory.ts` 接入同一套 resolver；repair hint 读取保留 legacy fallback，failure / resolution 写回进入项目级 `intent-e2e-repair-memory.json`
  - 在 `lib/test-generator.ts`、`lib/ai/intent-e2e-service.ts`、`lib/intent-project-knowledge-draft.ts`、`app/api/intent-e2e/project-knowledge/backups/route.ts`、`app/api/intent-e2e/project-knowledge/backups/restore/route.ts` 补齐 `projectUid` 透传，统一 knowledge draft / merge / backup / restore / repair-memory 的项目级路径
  - README 已补充 `projectUid` 下的资产路径策略与 `INTENT_E2E_PROJECT_ASSET_ROOT` 入口说明
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/intent-project-knowledge.spec.ts tests/unit/intent-repair-memory.spec.ts tests/unit/intent-project-knowledge-draft.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/api-intent-project-knowledge-backups-route.spec.ts tests/unit/api-intent-project-knowledge-backup-restore-route.spec.ts`
  - `node scripts/check-doc-links.mjs`
- 当前阶段状态：
  - `R7.5`：进行中（第一刀已完成：project-scoped knowledge / repair memory path isolation）
  - `R8-R14`：待开始
- 风险 / 未完成：
  - 新项目首次运行时仍只是在资产路径层面做到 isolation，`asset_missing / no_hit` 的显式 guardrail 还没落到 run status、insights 和 workbench
  - project onboarding bootstrap contract 仍未定义；当前只是保证已有 legacy 资产可以平滑迁到项目文件，不代表冷启动项目已经具备最小可用资产
  - `blocked run split` 还没进入质量口径，本轮没有改 `env_transient / auth_failed / data_missing` 的分桶
- 下一步：
  - 补 `asset_missing / no_hit` 信号和 onboarding 最小 contract，让新项目首次运行从“静默 fallback”升级为“显式冷启动治理”

## 2026-03-30 第四次更新（R7.5 第二刀：cold-start asset readiness signals）

- 本轮目标：
  - 补最小 onboarding manifest helper，并把 `asset_missing / no_hit` 冷启动信号透传到 run result、snapshot、insights 和 workbench
- 已完成：
  - 新增 `lib/intent-project-onboarding.ts`，统一项目级 onboarding manifest 路径与最小 readiness 判断；当前最小 contract 检查 `baseUrl`、`loginEntry`、`targetUrlFamilies`、`stableIdentifierHints`、`keyResponsePatterns`、`defaultListOwnershipHints`、`detailEntryHints`、`goldFlows`
  - 在 `lib/ai/intent-e2e-service.ts` 增加 `assetReadiness` 结构；`projectUid` 下会显式区分 `ready / asset_missing / no_hit`，precheck 失败场景也会保留项目级资产状态
  - 在 `lib/ai/intent-e2e-run-registry.ts`、`lib/ai/intent-e2e-insights.ts`、`components/IntentE2EWorkbench.tsx` 接入同一信号；运行快照、insights summary、recent traces 和当前执行结果都能展示冷启动 readiness
  - README 已补充 `assetReadiness`、project onboarding manifest 路径和 `GET /api/intent-e2e/insights` 的冷启动汇总字段
- 验证：
  - `npm run build`
  - `npm run build:web`
  - `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-run-registry.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/api-intent-e2e-insights-route.spec.ts`
- 当前阶段状态：
  - `R7.5`：进行中（第二刀已完成：cold-start asset readiness signals + minimal onboarding manifest helper）
  - `R8-R14`：待开始
- 风险 / 未完成：
  - 当前 `asset_missing / no_hit` 还是显式信号，不是 hard block；主链路仍会继续执行 generate / repair
  - onboarding 目前只做本地文件读取与 readiness 判断，还没有单独的编辑流、schema 管理和工作台写入入口
  - `env_transient / auth_failed / data_missing / permission_blocked` 的 blocker split 仍未从模型质量口径里彻底拆出
- 下一步：
  - 继续补 `blocked run split`，把 `env/auth/data/permission` 阻塞与模型质量失败拆成独立治理口径，再决定是否把冷启动 readiness 升级成服务端强门禁

## 2026-03-30 第五次更新（R7.5 第三刀：blocked run split）

- 本轮目标：
  - 把 `env/auth/data/permission` blocker 从模型质量口径里拆出来，并让 run result、recent traces、insights / workbench 统一使用同一份 `qualitySplit`
- 已完成：
  - 新增 `lib/intent-e2e-quality-split.ts`，统一 `passed / model_quality / auth_blocked / permission_blocked / env_blocked / data_blocked / canceled` 分桶与 legacy fallback
  - 在 `lib/ai/intent-e2e-service.ts`、`lib/ai/intent-e2e-run-registry.ts` 接入 `qualitySplit`；precheck blocked、普通终态失败、成功 run 和快照恢复都会保留同一口径
  - 在 `lib/ai/intent-e2e-insights.ts` 增加 `blockedRuns / blockedRate / modelQualityEligibleRuns / modelQualityPassRate / modelQualityFailureRuns / permissionBlockedRuns / dataBlockedRuns`，`recentTraces` 也会透出每次运行的 `qualitySplit`
  - `components/IntentE2EWorkbench.tsx` 已在当前结果区、Insights Cockpit 和 recent traces 展示 blocker / model-quality pill 与剔除 blocker 后的通过率
  - README 已补充 `qualitySplit`、`modelQualityPassRate / blockedRate` 与 insights 新字段说明
- 验证：
  - `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-run-registry.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/api-intent-e2e-insights-route.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
  - `npm run test:e2e`
- 当前阶段状态：
  - `R7.5`：已完成（第三刀已完成：blocked run split + model-quality rate）
  - `R8-R14`：待开始
- 风险 / 未完成：
  - `asset_missing / no_hit` 仍是显式 signal，不是 hard block；是否升级为服务端门禁留到 `R11`
  - blocker split 目前只覆盖终态聚合，尚未扩展出“排除 blocker 的 first-pass / repair-pass 曲线”
  - onboarding 仍只有本地 manifest / readiness 判断，没有独立编辑流与 schema 管理
- 下一步：
  - 进入 `R8`，开始统一测试类型抽象与资产模型；把当前 browser E2E 已稳定的 `run / audit / insights / asset` 结构推广为平台层契约

## 2026-03-30 第六次更新（R8 第一刀：统一测试类型元数据 + 平台资产 schema compat wrapper）

- 本轮目标：
  - 先不扩新 runner，先把平台支持的 `testType / runnerType` 和统一测试资产 schema 收口，并给现有 `browser E2E` 主链路补兼容包装
- 已完成：
  - 新增 `lib/test-platform-asset-model.ts`，统一定义 `browser_e2e / api_flow / repo_test / contract_check`、`playwright_runner / http_runner / repo_test_runner / contract_runner`，以及 `testCase / testSpec / verificationContract / artifactContract` schema、clone helper 和 normalize fallback
  - 在 `lib/ai/intent-e2e-service.ts` 接入平台资产 bundle；正常终态、precheck blocked 和 precheck error 的 `final_result` 都会显式返回 `testType`、`runnerType`、`testCase`、`testSpec`、`verificationContract`、`artifactContract`
  - 在 `lib/ai/intent-e2e-run-registry.ts` 接入平台级字段；run snapshot 顶层会保留 `testType / runnerType`，恢复旧 snapshot 时默认回退到 `browser_e2e / playwright_runner`，避免历史数据因为缺字段而读挂
  - 在 `lib/ai/intent-e2e-insights.ts` 的 `recentTraces` 增加 `testType / runnerType`，不再把所有运行都隐式视为 Playwright 页面任务
  - `components/IntentE2EWorkbench.tsx` 已补平台资产 mirror type；当前结果区和 recent traces 会显示 `testType / runnerType`
  - README 已补充平台资产字段、run snapshot / insights 返回内容与 workbench 展示说明
- 验证：
  - `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-run-registry.spec.ts tests/unit/intent-e2e-insights.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第一刀已完成：统一测试类型元数据 + 平台资产 schema compat wrapper）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前仍只有 `browser_e2e` 真正接了执行链；`api_flow / repo_test / contract_check` 还只是平台 schema 与枚举层收口
  - platform asset 目前仍随 run result / snapshot JSON 一起持久化，没有独立 audit / query 模型
  - `recentTraces` 这轮只先透出 `testType / runnerType`，更多 browser-specific 字段和 type-specific 字段的分层仍待下一刀继续拆
- 下一步：
  - 继续推进 `R8` 第二刀，把统一资产模型从 compat wrapper 扩展到更稳定的 run / audit / insights 分层 contract，并为 `R9` 的 runner adapter 预留非 UI 执行入口

## 2026-03-30 第七次更新（R8 第二刀：legacy backfill + workspace import metadata preservation）

- 本轮目标：
  - 让旧的 browser-E2E snapshot 在恢复时补齐平台资产，而不是只 fallback `testType / runnerType`
  - 把平台资产沿 `workspace import -> execution artifact -> execution detail` 这条链路继续保留下来
- 已完成：
  - 在 `lib/test-platform-asset-model.ts` 增加统一 `resolvePlatformTestAssetBundle()` / `summarizePlatformTestAssetBundle()`，当前能对 browser-E2E 旧结果做 compat backfill，也能给后续 import / query 复用
  - 在 `lib/ai/intent-e2e-run-registry.ts` 的 snapshot restore 里接入 backfill；旧 run 缺失 `testCase / testSpec / verificationContract / artifactContract` 时，会基于已保存的 `ScenarioCard / description / targetUrl / executionPlan / verificationPlan / compiledTemplate` 自动回填一份 browser-E2E 平台资产
  - 在 `lib/services/intent-e2e-workspace-service.ts` 接入平台资产解析；保存到项目工作台时，`generated_spec` artifact meta 会保留完整 `platformAssetBundle`，plan / execution activity log 会保留 `platformMeta` 摘要
  - 在 `lib/intent-e2e-import.ts` 和 `lib/services/test-plan-service.ts` 增加平台导入元数据提取；`GET /api/test-executions/:executionUid` 的 `intentImport` 现在能直接读出 `testType / runnerType / testCaseId / testSpecId / verificationContractId`
  - README 已补充 legacy snapshot restore 和 workspace import 的平台元数据保真说明
- 验证：
  - `npx vitest run tests/unit/intent-e2e-run-registry.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/intent-e2e-import.spec.ts tests/unit/test-plan-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第二刀已完成：legacy backfill + workspace import metadata preservation）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前 legacy backfill 只对 `browser_e2e / playwright_runner` 有自动重建能力；未来 `api_flow / repo_test / contract_check` 还需要各自的资产构造器
  - workspace import 目前把平台资产写进 artifact / activity JSON meta，但还没有单独的 query / filter 索引
  - workbench / execution detail 还没有把这批 platform import 元数据做成完整 UI 视图
- 下一步：
  - 继续推进 `R8` 第三刀，把平台资产从“兼容恢复 + import 保真”进一步扩成更清晰的 run / audit / query contract，为 `R9` runner adapter 和非 UI trace 统一接入做准备

## 2026-03-30 第八次更新（R8 第三刀：execution detail query / UI platform contract）

- 本轮目标：
  - 把 `intentImport` 里的平台元数据从“后端可查”推进到“execution detail query / UI 可见”
- 已完成：
  - `components/ExecutionWorkbench.tsx` 已同步 execution detail 的 `intentImport` 本地类型；执行详情卡片现在会直接展示 `testType / runnerType`
  - 同组件补充平台 contract 展示区：可查看 `testCaseId / testSpecId / verificationContractId / artifactKinds`，避免导入后只剩 `runId`
  - `components/ExecutionConsole.tsx` 已同步同一份 `intentImport` 类型和展示逻辑，`/runs/:executionUid` 旧执行页也能看到相同的平台语义
  - README 已补充 `/executions/:executionUid` 与 `/runs/:executionUid` 的 execution detail 页面会直接展示 platform import 元数据
- 验证：
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第三刀已完成：execution detail query / UI platform contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前 execution detail 只是展示 platform import 元数据，还没有进一步做列表筛选、统计聚合或 platform-aware query
  - `ProjectWorkspace` 一侧仍主要以 `intentImportedFromRunId` 做列表级识别，还没把 `testType / runnerType` 扩到任务/执行列表
  - 非 UI runner 仍未真正接入执行链；平台语义目前仍以 browser-E2E compat 数据为主
- 下一步：
  - 继续推进 `R8` 第四刀，把 platform-aware query 从 execution detail 扩到 workspace/task/execution 列表与更明确的 query contract，为后续非 UI runner 接入留出稳定观测面

## 2026-03-30 第九次更新（R8 第四刀：workspace/task/execution list platform-aware query）

- 本轮目标：
  - 把 platform-aware query 从 execution detail 继续扩到 `ProjectWorkspace` 的任务列表和单任务执行历史
  - 让列表级视图不再只认 `importedFromRunId`，而是能直接按 `testType / runnerType` 观察和检索 intent import
- 已完成：
  - 在 `lib/intent-e2e-import.ts` 增加 `extractIntentImportPlatformSummaryFromPrompt()`，让 latest plan generation prompt 也能解析出 `testType / runnerType / contract ids / artifactKinds`
  - 在 `lib/db/repository.ts` 的 `normalizeConfigRow()` 里接入 prompt 侧平台摘要解析；任务列表现在会返回 `latestPlanImportedTestType / latestPlanImportedRunnerType`
  - `listExecutionsByConfigUid()` 已从 `generated_spec` artifact meta 的 `platformAssetBundle` 读取 `intentImportedTestType / intentImportedRunnerType`，不新增 schema，继续只走现有 artifact JSON query
  - `components/ProjectWorkspace.tsx` 已补本地 platform type normalize、task / execution list 的 platform pills，以及把这些平台字段纳入前端搜索关键字
  - README 已补充项目工作台任务列表 / 执行历史的 platform-aware 展示与 `GET /api/test-configs/:configUid/executions` 返回说明
- 验证：
  - `npx vitest run tests/unit/intent-e2e-import.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
  - `npm run db:init`
  - `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts tests/integration/stale-execution-reconciliation.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第四刀已完成：workspace/task/execution list platform-aware query）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前列表级 query 先只展示 `testType / runnerType`；`testCaseId / testSpecId / verificationContractId / artifactKinds` 仍主要在 execution detail 页面查看
  - execution history 的平台字段依赖 `generated_spec` artifact meta；更早的 intent import 历史如果没有 `platformAssetBundle`，列表层仍只能看到 `runId`
  - 非 UI runner 还没真正进入执行链，当前平台 query 仍以 browser-E2E compat 数据为主
- 下一步：
  - 继续推进 `R8` 下一刀，把 platform-aware query 从列表展示扩成更稳定的统计 / filter contract，为后续非 UI runner 的统一聚合和 adapter 接入预留稳定观测面

## 2026-03-30 第十次更新（R8 第五刀：workspace query server-side platform filter contract）

- 本轮目标：
  - 把 workspace 的 platform-aware query 从“前端本地搜索”升级成“服务端 filter contract”
  - 让 `/api/test-configs` 和 `/api/test-configs/:configUid/executions` 都能按 `platformTestType / platformRunnerType` 做稳定筛选
- 已完成：
  - `lib/db/repository.ts` 的 `listTestConfigs()` 现在支持 `platformTestType / platformRunnerType`；任务列表会基于 latest plan generation prompt 中的 `平台测试类型 / 平台执行器` 做服务端过滤
  - `listExecutionsByConfigUid()` 现在支持同一组筛选参数；执行历史会基于 `generated_spec` artifact meta 里的 `platformAssetBundle.testType / runnerType` 做服务端过滤
  - `app/api/test-configs/route.ts` 和 `app/api/test-configs/[configUid]/executions/route.ts` 已接入 query 参数解析与透传，保持 route 只做参数处理和权限控制
  - `components/ProjectWorkspace.tsx` 已补任务列表 / 执行历史的下拉筛选控件，并把筛选真正接到服务端查询，不再只做前端文本搜索
  - README 已补充 workspace 平台下拉筛选和两条 query route 的 `platformTestType / platformRunnerType` 说明
- 验证：
  - `npx vitest run tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
  - `npm run db:init`
  - `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第五刀已完成：workspace query server-side platform filter contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前 server-side filter contract 仍主要围绕 `testType / runnerType`；更细的 `testCaseId / testSpecId / verificationContractId / artifactKinds` 还没有扩成列表级过滤
  - `listTestConfigs()` 的平台过滤目前依赖 latest plan prompt 中的平台标记；极老的非 import 计划或未标记计划不会命中过滤条件
  - 非 UI runner 尚未真正进入执行链，当前 filter contract 仍主要在 browser-E2E compat 数据上验证
- 下一步：
  - 继续推进 `R8` 下一刀，把平台 query 从 filter contract 扩成更稳定的 summary / aggregation contract，为后续 runner adapter 和跨平台统计视图预留统一观测面

## 2026-03-30 第十一次更新（R8 第六刀：workspace platform summary / aggregation contract）

- 本轮目标：
  - 在 `/api/test-configs` 和 `/api/test-configs/:configUid/executions` 的现有 platform filter contract 上，再补一层稳定的 `platformSummary` 聚合面
  - 让 `ProjectWorkspace` 不只支持筛选，还能直接看到当前查询范围里的 intent 导入数、平台标签数和平台类型 / 执行器分布
- 已完成：
  - `lib/db/repository.ts` 的 `listTestConfigs()` 现在会额外返回 `platformSummary`，按当前查询范围汇总 `scopeCount / importedCount / platformTaggedCount / byTestType / byRunnerType`
  - 同文件的 `listExecutionsByConfigUid()` 也已返回同一形状的 `platformSummary`；执行历史按当前返回窗口聚合，避免和 `limit` 视图脱节
  - `app/api/test-configs/[configUid]/executions/route.ts` 已改为直接透传 repository 返回的 summary contract，保持 route 只做参数解析和权限控制
  - `components/ProjectWorkspace.tsx` 已在任务区和执行历史弹窗头部补 summary pills；当用户继续用本地关键词缩小结果时，会回退到基于当前可见项的本地重算，避免统计和列表脱节
  - README 已补充 workspace 平台 summary 展示，以及两条 query route 返回 `platformSummary` 的说明
- 验证：
  - `npx vitest run tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
  - `npm run db:init`
  - `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第六刀已完成：workspace platform summary / aggregation contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 任务列表 summary 仍依赖 latest plan prompt 里的平台标记；极老未标记计划只能计入 `importedCount`，不会进入 `byTestType / byRunnerType`
  - 执行历史 summary 当前按返回窗口聚合；若后续要做跨长历史的趋势统计，还需要单独的全量聚合 contract
  - 更细粒度的 `testCaseId / testSpecId / verificationContractId / artifactKinds` 仍未扩成列表级 summary 或 filter
- 下一步：
  - 继续推进 `R8` 下一刀，把列表级 platform query 从 `testType / runnerType` 扩到更细粒度的 contract id / artifact-level 观测面，并为 runner adapter 接入预留统一 summary 入口

## 2026-03-30 第十二次更新（R8 第七刀：workspace platform contract-id / artifact observation contract）

- 本轮目标：
  - 把 workspace 列表级 platform query 从 `testType / runnerType` 继续扩到更细粒度的 `testCaseId / testSpecId / verificationContractId / artifactKinds`
  - 在现有 `platformSummary` 上补 `byArtifactKind`，形成更完整的 artifact-level 观测面
- 已完成：
  - `lib/db/repository.ts` 的 `normalizeConfigRow()` 现在会把 prompt 侧平台摘要里的 `testCaseId / testSpecId / verificationContractId / artifactKinds` 一并透出到任务列表
  - 同文件的 `listExecutionsByConfigUid()` 现会直接读取最新 `generated_spec.meta`，统一复用 `intent-e2e-import` 的解析 helper，返回执行历史项上的同一组 contract-id / artifact 字段
  - `platformSummary` 已新增 `byArtifactKind`；任务列表会基于 latest plan prompt 聚合，执行历史会基于当前返回窗口里的 artifact meta 聚合
  - `components/ProjectWorkspace.tsx` 已在任务列表和执行历史卡片上直接展示 `Case / Spec / Contract / Artifacts`，并把这些字段纳入关键词搜索
  - README 已补充两条 query route 的 item-level platform observation 字段和 `byArtifactKind` 说明
- 验证：
  - `npx vitest run tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
  - `npm run db:init`
  - `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第七刀已完成：workspace platform contract-id / artifact observation contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前列表级 contract 仍只把 `testCaseId / testSpecId / verificationContractId` 作为观测字段透出，还没有进一步扩成服务端 filter
  - 任务列表的 contract-id / artifact 仍依赖 latest plan prompt；极老未标记计划只能保留 `importedCount` 级别的识别
  - `byArtifactKind` 仍以当前查询范围聚合，不负责长时间窗口趋势分析
- 下一步：
  - 继续推进 `R8` 下一刀，把 contract-id / artifact-level 观测面进一步收口成更稳定的 filter / aggregation contract，为后续 runner adapter 和跨平台统计视图预留统一查询入口

## 2026-03-30 第十三次更新（R8 第八刀：workspace platform artifact filter contract）

- 本轮目标：
  - 在现有 `contract-id / artifactKinds` 列表观测面基础上，优先把 `artifactKinds` 收口成稳定的服务端 filter contract
  - 让 workspace 任务列表和执行历史都能按 artifact kind 下拉走真实 query，而不只是本地关键词搜索
- 已完成：
  - `lib/db/repository.ts` 的 `listTestConfigs()` 现在支持 `platformArtifactKind`；任务列表会基于 latest plan prompt 里的 `平台产物类型：...` 做服务端过滤
  - 同文件的 `listExecutionsByConfigUid()` 也支持 `platformArtifactKind`；执行历史会基于最新 `generated_spec.meta.platformAssetBundle.artifactContract.artifactKinds` 做服务端过滤
  - `app/api/test-configs/route.ts` 与 `app/api/test-configs/[configUid]/executions/route.ts` 已接入 `platformArtifactKind` 参数透传，保持 route 只做参数处理和权限控制
  - `components/ProjectWorkspace.tsx` 已在任务列表和执行历史补 `artifactKind` 下拉，并接到真实服务端请求；现有本地关键词搜索仍保留为二次缩小范围
  - README 已补充 workspace `artifactKind` 筛选和两条 query route 的 `platformArtifactKind` 说明
- 验证：
  - `npx vitest run tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
  - `npm run db:init`
  - `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第八刀已完成：workspace platform artifact filter contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前只把 `artifactKinds` 收口成服务端 filter；`testCaseId / testSpecId / verificationContractId` 仍停留在列表级观测字段
  - 任务列表的 artifact filter 仍依赖 latest plan prompt 里的 `平台产物类型：...` 标记；极老未标记计划无法命中这类筛选
  - 尚未做多 artifact kind 组合查询，当前 contract 先只支持单一 `platformArtifactKind`
- 下一步：
  - 继续推进 `R8` 下一刀，把 `testCaseId / testSpecId / verificationContractId` 进一步收口成可复用的 query / aggregation contract，同时评估是否需要更稳定的 platform index 层

## 2026-03-30 第十四次更新（R8 第九刀：workspace platform contract-id filter contract）

- 本轮目标：
  - 在现有 `artifactKind` filter contract 基础上，把 `testCaseId / testSpecId / verificationContractId` 也收口成稳定的服务端 query contract
  - 前端维持单个“字段选择 + ID 输入 + 应用”入口，避免 workspace 筛选区膨胀成三组平铺输入
- 已完成：
  - `lib/db/repository.ts` 的 `listTestConfigs()` 现在支持 `platformTestCaseId / platformTestSpecId / platformVerificationContractId`；任务列表会基于 latest plan prompt 里的 `平台用例资产 / 平台规格资产 / 平台验收契约` 标记做服务端过滤
  - 同文件的 `listExecutionsByConfigUid()` 也支持同一组参数；执行历史会基于最新 `generated_spec.meta.platformAssetBundle.testCase / testSpec / verificationContract` 做精确过滤
  - `app/api/test-configs/route.ts` 与 `app/api/test-configs/[configUid]/executions/route.ts` 已接入三组 contract-id 参数透传，保持 route 只做参数处理和权限控制
  - `components/ProjectWorkspace.tsx` 已在任务列表和执行历史补“字段选择 + ID 输入 + 应用”控件，并修正执行历史弹窗打开时的 filter reset，确保不会沿用上一次的 artifact / contract-id 查询
  - README 已补充 workspace contract-id 筛选入口，以及两条 query route 的 `platformTestCaseId / platformTestSpecId / platformVerificationContractId` 说明
- 验证：
  - `npx vitest run tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
  - `npm run db:init`
  - `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第九刀已完成：workspace platform contract-id filter contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 任务列表的 contract-id 过滤仍依赖 latest plan prompt 里的平台标记；极老未标记计划无法命中这类查询
  - 当前 contract 仍是单字段精确查询，不支持多字段 OR、模糊匹配或多输入组合筛选
  - 尚未引入单独的 platform index 层；当前仍以 prompt / artifact JSON query 作为稳定兼容面
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否需要把现有 prompt / artifact JSON query 再收口成更稳定的组合 filter contract 或 platform index，为后续 non-UI runner 接入保留统一查询面

## 2026-03-30 第十五次更新（R8 第十刀：workspace platform combined filter contract）

- 本轮目标：
  - 把当前分散的 `platformTestCaseId / platformTestSpecId / platformVerificationContractId` 收口成更稳定的组合 query contract
  - 让工作台“字段选择 + ID 输入”的前端交互，与 route 层 query 形状保持一致，同时继续兼容 legacy 参数
- 已完成：
  - 新增 `lib/test-platform-query-contract.ts`，统一承载 `platformContractIdType / platformContractId` 的 normalize 与 query 构造 helper
  - `app/api/test-configs/route.ts` 与 `app/api/test-configs/[configUid]/executions/route.ts` 现在支持新的组合参数；若未提供组合参数，仍继续透传 legacy 的 `platformTestCaseId / platformTestSpecId / platformVerificationContractId`
  - `lib/db/repository.ts` 已统一处理组合参数优先级：新组合 contract 存在时按单字段精确过滤；缺省时保持 legacy 多字段筛选兼容
  - `components/ProjectWorkspace.tsx` 的 contract-id 筛选已改走 `platformContractIdType + platformContractId`，和当前字段选择器 UI 直接对齐
  - README 已补充新的组合 query contract 及 legacy fallback 说明
- 验证：
  - `npx vitest run tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
  - `npm run db:init`
  - `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第十刀已完成：workspace platform combined filter contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前组合 contract 仍只支持单字段精确过滤，不支持 OR、多 contract-id 并列或模糊匹配
  - `listTestConfigs()` 仍依赖 latest plan prompt 里的平台标记；极老未标记计划无法命中这类筛选
  - 尚未引入单独的 platform index；当前仍以 prompt / artifact JSON query 兼容层承接查询
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否需要把现有 prompt / artifact JSON query 升级成更明确的 platform index / materialized query 面，减少后续 non-UI runner 接入时的查询歧义

## 2026-03-30 第十六次更新（R8 第十一刀：workspace platform materialized query contract）

- 本轮目标：
  - 在组合 filter contract 之上，再补一个稳定的 item-level materialized query 面
  - 让任务列表与执行历史不再只暴露拆散字段，而是明确给出统一的 `platformQuery` 结构和 query source
- 已完成：
  - `lib/test-platform-query-contract.ts` 已补 `platformQuery` materializer / normalizer，统一收口 `source / importedFromRunId / testType / runnerType / contract ids / artifactKinds / imported / platformTagged`
  - `lib/db/repository.ts` 的任务列表项现在会返回 `platformQuery.source = latest_plan_prompt`；执行历史项会返回 `platformQuery.source = execution_artifact_meta`
  - 同文件对 legacy imported 记录也会 materialize 成 imported-only 形态，避免前端继续靠“拆散字段 + 猜测来源”判断查询语义
  - `components/ProjectWorkspace.tsx` 已优先消费 `platformQuery` 归一化旧字段，并在 observation 区轻量展示 `Prompt Query / Artifact Query` source pill
  - README 已补 `platformQuery` item contract 说明，明确其用途是给后续 non-UI runner 和统一查询面做稳定承接
- 验证：
  - `npx vitest run tests/unit/intent-e2e-import.spec.ts`
  - `npm run build`
  - `npm run db:init`
  - `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第十一刀已完成：workspace platform materialized query contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前 `platformQuery` 仍是 item-level materialized contract，不是数据库级 index / materialized table
  - 任务列表的 `platformQuery.source = latest_plan_prompt` 仍依赖 latest plan prompt 平台标记；极老未标记计划只能 materialize 成 imported-only 形态
  - 尚未引入跨任务 / 跨执行的统一 platform index；查询性能和歧义治理目前仍停留在 repository 兼容层
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否需要把当前 item-level `platformQuery` 再上提成 repository 级 platform index / materialized query view，为 non-UI runner 接入和更长时间窗口查询预留统一底座

## 2026-03-30 第十七次更新（R8 第十二刀：workspace platform index / materialized query view）

- 本轮目标：
  - 把 item-level `platformQuery` 再上提一层，形成 repository-level 的 `platformIndex`
  - 让工作台在当前 query 范围内稳定拿到 query source 聚合和 contract-id 候选，而不再只靠本地扫描拆散字段
- 已完成：
  - `lib/test-platform-query-contract.ts` 已补 `platformIndex` builder / normalizer，统一输出 `scopeCount / importedCount / platformTaggedCount / bySource / byTestCaseId / byTestSpecId / byVerificationContractId`
  - `lib/db/repository.ts` 的 `listTestConfigs()` 和 `listExecutionsByConfigUid()` 现在都会在 response 顶层返回 `platformIndex`；summary 和 index 也统一改成从同一份 materialized query 集合派生
  - `components/ProjectWorkspace.tsx` 已接入 `platformIndex`：contract-id 输入框现在会拿当前范围的 suggestions，任务区和执行历史头部也会展示最小 index pills
  - `tests/unit/intent-e2e-import.spec.ts`、两组 integration 已覆盖 source 聚合、contract-id 候选和空结果 index 形状
  - README 已补 `platformIndex` response contract 说明
- 验证：
  - `npx vitest run tests/unit/intent-e2e-import.spec.ts`
  - `npm run build`
  - `npm run db:init`
  - `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第十二刀已完成：workspace platform index / materialized query view）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前 `platformIndex` 仍是 response-level materialized view，不是数据库级 index / materialized table
  - 当前 suggestion 只基于当前 query 范围和当前返回窗口，不做跨分页全量候选
  - 任务列表一侧仍依赖 latest plan prompt 作为 query source，尚未完全脱离 prompt/JSON 兼容层
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要把当前 response-level `platformIndex` 进一步落成 repository 内部统一 projection / query view，减少 prompt 与 artifact 两套来源的重复 SQL 和后续 non-UI runner 接入成本

## 2026-03-30 第十八次更新（R8 第十三刀：workspace platform repository projection / query view）

- 本轮目标：
  - 在不改外部 API contract 的前提下，把 repository 内部的 platform filter 解析与 materialized query 构造收口到统一 helper
  - 减少 `listTestConfigs()` 与 `listExecutionsByConfigUid()` 在 prompt / artifact 两套来源上的重复 SQL 与重复解析，为后续 non-UI runner 复用预留统一底座
- 已完成：
  - `lib/test-platform-query-contract.ts` 新增的 `resolvePlatformQueryFilters()`、`buildPromptPlatformMaterializedQuery()`、`buildArtifactPlatformMaterializedQuery()` 已接入 `lib/db/repository.ts`；任务列表与执行历史都改走同一套 platform filter resolver 和 materializer
  - `lib/db/repository.ts` 已把 latest plan prompt 与 latest generated spec meta 的 projection/query view 片段收口成内部 helper，保持 SQL 语义不变，只移除重复定义
  - `normalizeConfigRow()`、`listTestConfigs()` summary/index 聚合路径、`listExecutionsByConfigUid()` item mapping 已统一从同一份 materialized query helper 派生，不再各自手拼 import/platform 字段
  - `tests/unit/intent-e2e-import.spec.ts` 已补 helper unit coverage，覆盖组合/legacy filter 解析、prompt-side materializer、artifact-side materializer 的 fallback / override 行为
  - `lib/intent-e2e-import.ts` 已与 `lib/test-platform-asset-model.ts` 解耦基础 testType/runnerType normalize，避免 `ProjectWorkspace` 经 `platformQuery` contract 间接把 `node:crypto` 拉进前端 bundle，`build:web` 恢复通过
- 验证：
  - `npx vitest run tests/unit/intent-e2e-import.spec.ts`
  - `npm run build`
  - `npm run db:init`
  - `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第十三刀已完成：workspace platform repository projection / query view）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前仍不是数据库级 materialized table / index，只是 repository 内部 projection/query view 收口
  - 任务列表仍依赖 latest plan prompt，执行历史仍依赖 latest generated spec meta；本轮没有改变底层存储来源
  - 当前统一 view 主要服务于 workspace query 与后续复用，尚未真正接入 non-UI runner 的独立调用路径
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否把当前 repository 内部 projection / query view 再上提成跨 UI / non-UI runner 共用的稳定查询适配层，并为更长时间窗口查询预留统一入口

## 2026-03-30 第十九次更新（R8 第十四刀：workspace platform query service adapter）

- 本轮目标：
  - 在不改外部 API contract 的前提下，把 workspace platform query 入口从 repository 直连上提到 `lib/services/**`
  - 让 `/api/test-configs`、`/api/test-configs/:configUid/executions` 和后续 non-UI runner 都能复用同一组 service adapter，而不是继续各自直连 repository list API
- 已完成：
  - `lib/services/intent-e2e-workspace-service.ts` 已新增 `listWorkspaceTaskPlatformQueryView()` / `listWorkspaceExecutionPlatformQueryView()`，统一承载 workspace platform query 的 service 出口，并给内部调用提供稳定的 `scope / window / data` 结构
  - `app/api/test-configs/route.ts` 与 `app/api/test-configs/[configUid]/executions/route.ts` 已切到这组 adapter；route 现在只保留 query 参数解析、权限校验和响应封装，不再直接调用 repository 的 list API
  - `tests/unit/intent-e2e-workspace-service.spec.ts` 已补 adapter unit coverage，覆盖任务列表/执行历史的 scope、window 和 filter 透传；两组 route spec 也已改为约束 service 调用链
  - 现有 `/api/test-configs` 与执行历史 integration 在 adapter 切换后继续通过，说明对外 response shape 与 platform query 行为保持不变
- 验证：
  - `npx vitest run tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
  - `npm run build`
  - `npm run db:init`
  - `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第十四刀已完成：workspace platform query service adapter）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前 adapter 只是 service 层统一入口，还没有真正接入 non-UI runner 的独立调用链
  - repository 仍然是底层真实查询执行者；本轮没有引入数据库级 materialized table / index
  - 更长时间窗口查询这轮只先落了统一 `window` 描述，没有扩新分页/游标 contract
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否把当前 service adapter 再上提成面向 UI / non-UI runner 共用的稳定 query facade，并补第一处非 route 调用点验证这层抽象不是只给 route 包装

## 2026-03-30 第二十次更新（R8 第十五刀：workspace platform query facade + focused workspace path）

- 本轮目标：
  - 在不改外部 API contract 的前提下，把 workspace platform query adapter 再上提成独立 facade，给 route 和非 route 调用点复用
  - 让意图导入返回一个可直接落到聚焦任务视图的 `workspaceQueryPath`，并让工作台按 URL hydrate 对应 platform filter
- 已完成：
  - `lib/services/workspace-platform-query-facade.ts` 已新增统一 facade，收口 workspace task / execution query view、filter normalize、focused filter builder 和 task query path builder
  - `app/api/test-configs/route.ts` 与 `app/api/test-configs/[configUid]/executions/route.ts` 已改从 facade 引用；`intent-e2e-workspace-service` 不再承担 query adapter 出口
  - `lib/services/intent-e2e-workspace-service.ts` 在保留原有 `workspacePath` 的同时，新增 additive `workspaceQueryPath`；导入时会基于平台摘要构造直达聚焦任务列表的路径
  - `components/ProjectWorkspace.tsx` 已支持从 URL hydrate 任务区 `platformTestType / platformRunnerType / platformArtifactKind / platformContractId*` 初始状态，并兼容 legacy contract-id 参数
  - 相关 route / service unit spec 已改到 facade 新入口；`tests/unit/api-intent-e2e-run-workspace-route.spec.ts` 也已补 `workspaceQueryPath` 透传断言
- 验证：
  - `npx vitest run tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts tests/unit/api-intent-e2e-run-workspace-route.spec.ts`
  - `npm run build`
  - `npm run db:init`
  - `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第十五刀已完成：workspace platform query facade + focused workspace path）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前 `workspaceQueryPath` 只聚焦到任务列表，不负责自动打开执行历史 modal
  - facade 目前主要统一 route 与意图导入调用点，还没有独立 non-UI runner 真正接入
  - `ProjectWorkspace` 的 URL hydrate 只覆盖任务区 platform filter，没有扩展更多工作台局部状态
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要把这套 facade 进一步下沉成前后端共用的 query-state contract / helper，并决定是否让执行历史也具备稳定的 focused URL 打开能力

## 2026-03-30 第二十一次更新（R8 第十六刀：workspace platform query-state contract + focused history URL）

- 本轮目标：
  - 把 workspace platform query URL 的 parse/build 再下沉成前后端共用的 pure helper，避免 `ProjectWorkspace` 和 server facade 继续各维护一套 query-state 约定
  - 让任务区 platform filter 与执行历史 modal 都具备稳定 focused URL，并把意图导入成功后的聚焦路径真正接到 Workbench
- 已完成：
  - `lib/workspace-platform-query-state.ts` 已新增 shared query-state helper，统一承载 task/history query state 的 normalize、parse、query params build、URL write 和 focused path builder
  - `lib/services/workspace-platform-query-facade.ts` 已切到这套 helper；server facade 不再自带第二份 task query path / filter normalize 实现
  - `components/ProjectWorkspace.tsx` 已改为通过 shared helper 读取 task/history URL state；模块切换、task platform filter、生效后的 history filter 与 history modal 开关现在都会稳定回写 URL，并支持直接从 URL 恢复打开聚焦执行历史
  - `lib/services/intent-e2e-workspace-service.ts` 在原有 `workspacePath / workspaceQueryPath` 之外，新增 additive `workspaceHistoryPath`；导入成功后可直接落到工作台里的聚焦执行历史视图
  - `components/IntentE2EWorkbench.tsx` 的保存成功区已优先消费 `workspaceQueryPath / workspaceHistoryPath`，不再只跳旧的泛工作台路径
  - `tests/unit/workspace-platform-query-state.spec.ts` 已补 shared helper coverage；workspace service 和 workspace route spec 也已补 `workspaceHistoryPath` 断言
- 验证：
  - `npx vitest run tests/unit/workspace-platform-query-state.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/api-intent-e2e-run-workspace-route.spec.ts`
  - `npm run build`
  - `npm run db:init`
  - `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第十六刀已完成：workspace platform query-state contract + focused history URL）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前 URL state 只同步“已应用”的 platform filter；task/history 关键字搜索仍然是本地态，不进 URL
  - focused history URL 仍然是工作台 modal 视图，不替代独立执行详情页 `/runs/:executionUid`
  - shared query-state helper 目前主要服务 browser workspace；尚未有 non-UI runner 直接复用这套 URL contract
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否把当前 workspace query-state / facade 再上提成更稳定的 cross-surface query preset contract，并为 `R9` runner adapter 预留可复用的 focused asset/query preset 入口

## 2026-03-30 第二十二次更新（R8 第十七刀：cross-surface workspace query preset contract + execution focused links）

- 本轮目标：
  - 把 workspace focused path 的拼装从单点 helper / service 调用再上提一层，收口成前后端可共用的 query preset contract
  - 让执行详情页 `ExecutionWorkbench / ExecutionConsole` 直接复用这份 preset contract，给 intentImport 面板补稳定的聚焦工作台入口
- 已完成：
  - `lib/workspace-platform-query-preset.ts` 已新增 pure preset helper，统一承载 imported platform summary 的 normalize、focused filter builder，以及 task/history 双路径 preset 构造
  - `lib/services/workspace-platform-query-facade.ts` 已改为复用并 re-export 同一份 focused filter builder；`lib/services/intent-e2e-workspace-service.ts` 也已切到 preset helper 生成 `workspaceQueryPath / workspaceHistoryPath`
  - `components/ExecutionWorkbench.tsx` 与 `components/ExecutionConsole.tsx` 的 intentImport 面板已新增“查看聚焦任务 / 查看聚焦执行历史”链接，直接回到对应项目工作台筛选态
  - `tests/unit/workspace-platform-query-preset.spec.ts` 已补 preset contract 的 priority / fallback / path coverage；README 也已同步补 execution detail 的聚焦入口说明
- 验证：
  - `npx vitest run tests/unit/workspace-platform-query-preset.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第十七刀已完成：cross-surface workspace query preset contract + execution focused links）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前 preset contract 只先接到 workspace 保存链路和 execution detail 两个 UI surface，non-UI runner 还没有直接消费
  - `artifactKinds` 目前只保留在 preset summary 里，没有映射进 URL filter；否则会和当前单值 `platformArtifactKind` query 约定冲突
  - 这套 contract 仍然围绕 workspace URL 组织，`R9` 若要接 runner adapter，可能还需要再抽一层更纯的 runner-side focused query object
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否让 runner adapter / 更多执行入口直接复用这套 preset contract，并决定是否把 focused asset/query preset 扩成非 URL 绑定的更底层共享对象

## 2026-03-30 第二十三次更新（R8 第十八刀：server-side execution detail preset consumer + non-URL query preset）

- 本轮目标：
  - 把 `workspace-platform-query-preset` 再拆出一层非 URL 绑定的 focused query object，避免这套 contract 继续只围绕 path/href 组织
  - 让 `test-plan-service.getExecutionDetail()` 成为第一个 server consumer，直接向 execution detail payload 下发 `intentImport.workspacePreset`
- 已完成：
  - `lib/workspace-platform-query-preset.ts` 已新增底层 `query` preset，统一承载 normalized summary、focused filters、contract-id priority 和 focused 判定；workspace task/history path 现在基于同一份 query preset 组合生成
  - `lib/services/test-plan-service.ts` 的 `getExecutionDetail()` 已在 `intentImport` 下新增 additive `workspacePreset`，把 project/config scope 与 imported platform summary 一次性在服务端收口
  - `components/ExecutionWorkbench.tsx` 与 `components/ExecutionConsole.tsx` 已改为直接消费服务端返回的 `intentImport.workspacePreset`，不再各自手写 `intentImport -> preset` 映射
  - `tests/unit/test-plan-service.spec.ts` 和 `tests/integration/project-read-access-api.spec.ts` 已补 execution detail preset 断言；`tests/unit/workspace-platform-query-preset.spec.ts` 也已覆盖新的 non-URL query preset shape
- 验证：
  - `npx vitest run tests/unit/workspace-platform-query-preset.spec.ts tests/unit/test-plan-service.spec.ts`
  - `npm run build`
  - `npm run db:init`
  - `npx vitest run tests/integration/project-read-access-api.spec.ts`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第十八刀已完成：server-side execution detail preset consumer + non-URL query preset）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前 server consumer 只先接到 execution detail；repair / rerun / background status 事件还没有直接复用这套 preset contract
  - additive `workspacePreset` 仍然是 execution detail payload 内的轻量字段，尚未沉淀成独立 runner-side context object
  - 当前 `query` preset 仍然围绕 imported platform summary 构建；真正进入 `R9` 时，还需要确认 non-UI runner 如何生成或继承这份 summary
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否把 repair / rerun 等更多执行入口也接到这套 server-side preset contract，并为 `R9` runner adapter 预留更直接的 runner-side focused query context

## 2026-03-30 第二十四次更新（R8 第十九刀：execution launch workspace history path + auto-repair follow-up contract）

- 本轮目标：
  - 给 `executePlan / repairExecution` 统一补上 additive 的 `runPath / workspacePath / workspaceHistoryPath`
  - 让执行启动、手动 repair 和 auto-repair follow-up 这些执行入口直接接上 focused workspace preset contract，而不是只在 execution detail 可见
- 已完成：
  - `lib/services/test-plan-service.ts` 已新增 execution workspace links helper；`executePlan()` 与 `repairExecution()` 现在都会返回 additive 的 `executionUid / runPath / workspacePath / workspaceHistoryPath`
  - `auto_repair_started` status event 已新增 `nextRunPath / nextWorkspacePath / nextWorkspaceHistoryPath`，保持旧字段兼容
  - `app/api/test-executions/[executionUid]/repair/route.ts` 与 `app/api/projects/[projectUid]/capabilities/[capabilityUid]/verify/route.ts` 已直接透传这组路径；`components/ProjectWorkspace.tsx` 在启动执行后也会优先使用服务端返回的 `runPath`
  - `components/ExecutionWorkbench.tsx` 与 `components/ExecutionConsole.tsx` 已读取 `nextWorkspaceHistoryPath`，auto-repair banner 新增“查看聚焦执行历史”入口；相关 route / service unit spec 已补新字段断言
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/api-test-plan-execute-route.spec.ts tests/unit/api-execution-repair-route.spec.ts tests/unit/api-project-capability-verify-route.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第十九刀已完成：execution launch workspace history path + auto-repair follow-up contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前这组 workspace path contract 已覆盖 execution launch / manual repair / auto-repair follow-up，但 activity log 与更多 background status payload 还没有统一接入
  - `runPath / workspacePath / workspaceHistoryPath` 仍然是 additive response 字段，尚未沉淀成更完整的 runner-side context object
  - 本轮没有新增独立 integration spec；目前主要依赖 route / service unit coverage 和双构建兜底 additive contract 的稳定性
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否把更多 background status / activity log payload 也接到同一套 server-side preset contract，并为 `R9` runner adapter 预留更直接的 execution-focused query context

## 2026-03-30 第二十五次更新（R8 第二十刀：execution activity log + background status workspace link contract）

- 本轮目标：
  - 给 execution 相关 activity log 补齐 `runPath / workspacePath / workspaceHistoryPath`，让 project activity feed 不再只有文本记录
  - 给后台 auto-repair status payload 统一补当前 execution 的 focused workspace links，并把 auto-repair follow-up 同步写进 activity log
- 已完成：
  - `lib/services/test-plan-service.ts` 已把 `execution_started / execution_passed / execution_failed` 的 activity log meta 统一补上 `runPath / workspacePath / workspaceHistoryPath`
  - `auto_repair_pending / auto_repair_skipped / auto_repair_started / auto_repair_failed` status payload 现在都会带当前 execution 的 `runPath / workspacePath / workspaceHistoryPath`；`auto_repair_started` 继续保留 `nextRunPath / nextWorkspacePath / nextWorkspaceHistoryPath`
  - auto-repair follow-up 已新增 `execution_auto_repair_started` project activity log，meta 同时带当前 execution links 和下一次 rerun 的 `next*` links
  - 新增 `lib/execution-workspace-link-contract.ts` pure helper；`components/ProjectWorkspace.tsx`、`components/ExecutionWorkbench.tsx`、`components/ExecutionConsole.tsx` 已统一消费这套 contract，在 activity feed 和执行事件列表直接展示 execution / focused workspace 链接；对应 helper coverage 已并入 `tests/unit/test-plan-service.spec.ts`
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第二十刀已完成：execution activity log + background status workspace link contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前只把 link contract 接到 activity log 和 execution status payload；artifact / conversation payload 仍未统一接入
  - activity feed 展示的是 focused workspace 入口，不是更细粒度的 execution-scoped history deep link；真正 execution-specific context 仍主要依赖 `/runs/:executionUid`
  - 这套 contract 仍以 additive path 字段存在，尚未沉淀成更完整的 runner-side execution context object
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否把更多 background payload（如 activity / artifact / conversation 侧的 platform context）也接到同一套 preset contract，并为 `R9` runner adapter 预留更直接的 execution context 结构

## 2026-03-30 第二十六次更新（R8 第二十一刀：execution artifact workspace link contract）

- 本轮目标：
  - 给 execution `generated_spec` artifact meta 统一补上 `runPath / workspacePath / workspaceHistoryPath`
  - 覆盖普通执行与 intent-run 导入这两条 execution artifact 写入链，让 artifact side 也能复用同一套 execution workspace link contract
- 已完成：
  - `lib/execution-workspace-link-contract.ts` 已扩成 shared builder + reader helper；现在既能从 payload/meta 读 link contract，也能基于 `executionUid / projectUid / moduleUid / configUid / summary` 构造同一套 workspace links
  - `lib/services/test-plan-service.ts` 写入的 `generated_spec` artifact meta 已统一补上 `runPath / workspacePath / workspaceHistoryPath`，覆盖 passed / failed / exception 三种落盘路径
  - `lib/services/intent-e2e-workspace-service.ts` 的 imported execution artifact 也已补同一组 links，并复用 imported platform summary 生成 focused task/history path
  - `components/ExecutionWorkbench.tsx` 与 `components/ExecutionConsole.tsx` 已在 artifact 卡片上直接展示 execution / focused workspace 链接；对应 service unit coverage 已补到 `tests/unit/test-plan-service.spec.ts` 与 `tests/unit/intent-e2e-workspace-service.spec.ts`
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第二十一刀已完成：execution artifact workspace link contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 当前只把 execution context 接到 artifact meta；`llm_conversations` 仍无结构化 meta 字段，本轮没有碰 schema
  - 目前只覆盖 `generated_spec` artifact，其他 artifact type 还没有统一挂这套 contract
  - imported execution 的 route 返回仍保留原有 `workspacePath / workspaceQueryPath / workspaceHistoryPath` 语义，本轮没有重构这层对外 contract
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否在不改 schema 的前提下，把更多 execution context 上提成更稳定的 server-side detail object，并决定 conversation / artifact / status 之间是否需要一层统一的 execution context envelope

## 2026-03-30 第二十七次更新（R8 第二十二刀：server-side execution detail context object）

- 本轮目标：
  - 在 `getExecutionDetail()` 里新增 additive 的 `executionContext`，统一承载当前 execution 的 `runPath / workspacePath / workspaceHistoryPath`
  - 让 execution detail 页直接消费这份 server-side context；有 platform summary 时走 focused workspace preset，没有时回退到基础项目/模块路径
- 已完成：
  - `lib/services/test-plan-service.ts` 的 `getExecutionDetail()` 已新增 `executionContext`，统一返回当前 execution 的 `runPath / workspacePath / workspaceHistoryPath`，并在存在 `generated_spec` platform summary 时同步挂上 `workspacePreset`
  - 普通 execution 现在会稳定回退到项目/模块级任务路径与执行历史路径；imported execution 会复用 artifact summary 生成 focused workspace task/history path
  - `components/ExecutionWorkbench.tsx` 与 `components/ExecutionConsole.tsx` 已直接消费 `detail.executionContext`，在页头展示当前 execution 的稳定链接；artifact 卡片在自身 meta 没有 links 时也会回退到当前 execution context
  - `tests/unit/test-plan-service.spec.ts` 已补 execution detail coverage，覆盖普通 execution 的基础路径和 imported execution 的 focused `workspacePreset`
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第二十二刀已完成：server-side execution detail context object）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只把 execution context 上提到 detail object；`llm_conversations` 仍无结构化 meta 字段，未改 schema
  - 当前 execution detail 页已经有稳定的 current execution links，但 artifact / status / activity payload 仍是各自 additive contract，尚未合并成统一 envelope
  - artifact 卡片仍优先展示 artifact 自身 meta 的链接；只有 meta 缺失时才回退到 detail `executionContext`
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否在不改 schema 的前提下，把 detail / artifact / status 之间的 execution context contract 进一步收口，并为后续 conversation context 预留统一入口

## 2026-03-30 第二十八次更新（R8 第二十三刀：execution context envelope compatibility contract）

- 本轮目标：
  - 在 shared helper 里补一层兼容的 `executionContext / nextExecutionContext` envelope 读写能力，同时保留现有平铺 path 字段
  - 把 status / activity / artifact 的 execution workspace payload 统一接到这层 envelope，让 detail / artifact / status 至少落到同一套 execution context 表达
- 已完成：
  - `lib/execution-workspace-link-contract.ts` 已新增 envelope payload builder；`readExecutionWorkspaceLinkContract()` 现在既能读旧的平铺 `runPath / workspacePath / workspaceHistoryPath`，也能读 nested `executionContext / nextExecutionContext`
  - `lib/services/test-plan-service.ts` 的 execution activity log、auto-repair status payload、`generated_spec` artifact meta 已统一通过 shared builder 写入 envelope；旧平铺字段继续保留，`auto_repair_started` 额外带 `nextExecutionContext`
  - `lib/services/intent-e2e-workspace-service.ts` 的 imported execution `generated_spec` artifact 和 `execution_passed / execution_failed` activity meta 也已补同一层 `executionContext`
  - `tests/unit/test-plan-service.spec.ts` 与 `tests/unit/intent-e2e-workspace-service.spec.ts` 已补 helper / status / activity / artifact 的 envelope 断言，验证旧平铺 contract 与 nested envelope 并存
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第二十三刀已完成：execution context envelope compatibility contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只把 envelope 收口到 JSON payload/meta；route 返回仍保持原有平铺字段优先，没有统一上提成公共 response contract
  - `llm_conversations` 仍无结构化 meta 字段，conversation 侧还没有接入这套 execution context envelope
  - helper 目前只承载 path 级 execution context；如果后续要把 `workspacePreset` 也并入统一 envelope，还需要单独定义兼容策略
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否把 execution entry response 和 conversation side 也逐步接到同一套 envelope / preset contract，并为 `R9` 的 runner-side context 预留统一入口

## 2026-03-30 第二十九次更新（R8 第二十四刀：execution entry response context contract）

- 本轮目标：
  - 给 `executePlan / repairExecution / persistIntentRunToWorkspace` 的返回值统一补 additive `executionContext`
  - 让现有执行入口 consumer 优先读取这份 `executionContext`，同时保留旧平铺 `runPath / workspacePath / workspaceHistoryPath` 兼容
- 已完成：
  - `lib/execution-workspace-link-contract.ts` 已新增 `ExecutionWorkspaceContext` 与 shared builder；现在 execution detail 和 execution entry response 都能复用同一份 `runPath / workspacePath / workspaceHistoryPath + workspacePreset` 构造逻辑
  - `lib/services/test-plan-service.ts` 的 `executePlan()`、`repairExecution()` 已统一返回 additive `executionContext`；`getExecutionDetail()` 也同步改为复用这套 shared builder
  - `lib/services/intent-e2e-workspace-service.ts` 的 `persistIntentRunToWorkspace()` 已新增 `executionContext`，继续保留 `workspaceQueryPath` 兼容 imported workspace save 结果
  - `app/api/test-executions/[executionUid]/repair/route.ts`、`app/api/projects/[projectUid]/capabilities/[capabilityUid]/verify/route.ts` 现在都会透传 `executionContext`；`app/api/test-plans/[planUid]/execute/route.ts` 因为直接透传 service result，已自动带上该字段
  - `components/ProjectWorkspace.tsx`、`components/ExecutionConsole.tsx`、`components/IntentE2EWorkbench.tsx` 已在执行启动 / repair 启动 / intent run 沉淀回执里优先读取 `executionContext`，旧字段只做 fallback
  - `tests/unit/test-plan-service.spec.ts`、`tests/unit/intent-e2e-workspace-service.spec.ts` 与 4 个相关 route spec 已补 `executionContext` 断言
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/api-test-plan-execute-route.spec.ts tests/unit/api-execution-repair-route.spec.ts tests/unit/api-intent-e2e-run-workspace-route.spec.ts tests/unit/api-project-capability-verify-route.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第二十四刀已完成：execution entry response context contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一了 execution entry response；conversation payload 仍无结构化 meta，尚未接入 execution context contract
  - route 对外仍保留旧平铺字段，`executionContext` 目前是 additive contract，不是唯一入口
  - imported workspace save 仍继续暴露 `workspaceQueryPath`；尚未把 focused task/history 入口完全收口到 `executionContext.workspacePreset`
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否在不改 schema 的前提下，为 conversation side 提供可复用的 execution context 侧带入口，或进一步把 `workspacePreset` 收口成更稳定的 execution context contract

## 2026-03-30 第三十次更新（R8 第二十五刀：execution conversation context sidecar）

- 本轮目标：
  - 在不改 `llm_conversations` schema 的前提下，给 execution conversations 返回补 additive 的 `executionContext` sidecar
  - 让两个 execution 页的 conversation 面板直接消费这层 sidecar，避免 conversation 区域和其他 execution payload 再次脱节
- 已完成：
  - `lib/execution-workspace-link-contract.ts` 已新增 `resolveExecutionWorkspaceContextFromArtifactMeta()`；现在 execution detail、execution entry response 和 conversation side 都能复用同一套 context 解析逻辑
  - `lib/services/test-plan-service.ts` 的 `getExecutionDetail()` 已给 `conversations` 逐条补上 `executionContext`
  - `app/api/conversations/route.ts` 在 `scene=plan_execution` 时会基于 execution + config + `generated_spec` artifact 解析 context，并把 `executionContext` sidecar 回填到 `items`，避免前端轮询覆盖掉这层信息
  - `components/ExecutionWorkbench.tsx` 与 `components/ExecutionConsole.tsx` 已在 conversation 卡片中直接展示 execution context links
  - `tests/unit/test-plan-service.spec.ts` 与 `tests/unit/api-conversations-route.spec.ts` 已补 sidecar 断言
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/api-conversations-route.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第二十五刀已完成：execution conversation context sidecar）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮没有改 `llm_conversations` schema；`executionContext` 仍是 response sidecar，不会落库
  - conversation side 目前只挂 current execution context，没有为单条 conversation 引入更细粒度的 event / artifact 定位信息
  - `workspacePreset` 虽已通过 shared context builder 复用，但还没有在 conversation payload 上单独沉淀成更稳定的公共 contract 文档
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要把 `workspacePreset` 本身进一步固化成 execution context contract，或在不改 schema 的前提下，为 conversation side 增加更细粒度的 event / artifact 关联入口

## 2026-03-30 第三十一次更新（R8 第二十六刀：execution workspacePreset sidecar contract）

- 本轮目标：
  - 把 `workspacePreset` 固化进共享 `executionContext / nextExecutionContext` sidecar contract
  - 让 execution status / activity / artifact，以及 imported workspace save 的 sidecar 都透传完整 context，同时继续保留旧平铺 path 字段兼容
- 已完成：
  - `lib/execution-workspace-link-contract.ts` 的 `ExecutionWorkspaceLinkPayload` 已从 links-only 扩成完整 `ExecutionWorkspaceContext`；`buildExecutionWorkspaceLinkPayload()` 现在会保留 `workspacePreset`
  - `lib/services/test-plan-service.ts` 已改为在 execution started / passed / failed / auto repair status / artifact meta 中统一写入完整 `executionContext / nextExecutionContext`，不再在 sidecar 构建时丢掉 `workspacePreset`
  - `lib/services/intent-e2e-workspace-service.ts` 的 imported execution `generated_spec` artifact 和 `execution_passed / execution_failed` activity meta 也已透传完整 `executionContext`
  - `tests/unit/test-plan-service.spec.ts` 与 `tests/unit/intent-e2e-workspace-service.spec.ts` 已补 `workspacePreset` 断言，覆盖 helper、auto-repair sidecar、execution artifact / activity，以及 imported workspace save
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第二十六刀已完成：execution workspacePreset sidecar contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只固化 response sidecar contract；`workspacePreset` 仍不会以独立 schema 字段落库
  - route / consumer 对外仍保留旧平铺字段，`executionContext` 仍是 additive contract，不是唯一入口
  - conversation side 目前仍只有 current execution context，没有更细粒度的 event / artifact 级关联信息
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要在不改 schema 的前提下，为 conversation / event / artifact side 增加更细粒度的关联入口，或进一步推动 consumer 统一收口到 `executionContext.workspacePreset`

## 2026-03-31 第三十二次更新（R8 第二十七刀：execution detail event / artifact context sidecar）

- 本轮目标：
  - 给 execution detail 的 `events / artifacts` 统一补顶层 `executionContext / nextExecutionContext` sidecar
  - 让 `ExecutionWorkbench` / `ExecutionConsole` 优先消费 item 顶层 sidecar，而不是继续直接解析 `payload / meta`
- 已完成：
  - `lib/execution-workspace-link-contract.ts` 已新增 `readExecutionWorkspaceContextSidecars()`，现在能从 nested `executionContext / nextExecutionContext` 和 legacy flat path contract 中统一恢复 current / next context
  - `lib/services/test-plan-service.ts` 的 `getExecutionDetail()` 已给 `events / artifacts` 逐条补顶层 `executionContext`；带 auto-repair follow-up 的 status event 会额外带 `nextExecutionContext`
  - `components/ExecutionWorkbench.tsx` 与 `components/ExecutionConsole.tsx` 已改为优先读取 item 顶层 sidecar 构建链接；只有在 sidecar 缺失时才 fallback 到原始 `payload / meta`
  - `tests/unit/test-plan-service.spec.ts` 已补 shared reader、detail event sidecar、detail artifact sidecar 断言，覆盖普通 execution 与 imported execution
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第二十七刀已完成：execution detail event / artifact context sidecar）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只补 detail response sidecar，不会把 event / artifact item context 落库成独立 schema 字段
  - `app/api/conversations` 仍只返回 conversation sidecar；还没有给单条 conversation 增加 event / artifact 级关联定位信息
  - auto-repair follow-up 仍继续依赖 status payload 本身；尚未独立抽成 execution event context contract
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要在不改 schema 的前提下，为 conversation side 增加更细粒度的 event / artifact 关联入口，或进一步推动 consumer 统一收口到 `executionContext.workspacePreset`

## 2026-03-31 第三十三次更新（R8 第二十八刀：execution conversation status-event follow-up sidecar）

- 本轮目标：
  - 基于现有 status event 的 `summary + executionContext / nextExecutionContext`，给匹配的 execution conversations 补 follow-up sidecar
  - 让 execution detail 和 `/api/conversations` 轮询结果都能带这层 sidecar，避免 detail 初始态与轮询结果脱节
- 已完成：
  - `lib/execution-workspace-link-contract.ts` 已新增 `buildExecutionConversationSidecarsBySummary()` 与 `hydrateExecutionWorkspaceContextWithFallback()`；现在能从 execution status events 建立 `summary -> current/next context` 索引
  - `lib/services/test-plan-service.ts` 的 `getExecutionDetail()` 已按 status summary 命中为 conversations 补 `nextExecutionContext` 与 additive `executionEventContext`
  - `app/api/conversations/route.ts` 已接入相同 shared helper；`scene=plan_execution` 的轮询返回现在会保留这层 follow-up sidecar
  - `components/ExecutionWorkbench.tsx` 与 `components/ExecutionConsole.tsx` 的 conversation item 类型已对齐新 sidecar；现有 link builder 无需额外改渲染逻辑即可自动显示 follow-up 链接
  - `tests/unit/test-plan-service.spec.ts` 与 `tests/unit/api-conversations-route.spec.ts` 已补 auto-repair follow-up conversation 断言
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/api-conversations-route.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第二十八刀已完成：execution conversation status-event follow-up sidecar）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只覆盖能和 status event summary 精确匹配的 conversation；不会对自由文本 LLM 回复做模糊归因
  - 仍未给 conversation 增加独立 artifact id / event id 落库字段；当前关联仍是 response-side sidecar
  - `nextExecutionContext` 目前主要覆盖 auto-repair follow-up；更细粒度的 artifact 级关联入口仍未补到 conversation side
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要在不改 schema 的前提下，为 conversation side 继续补 artifact 级关联入口，或进一步推动 consumer 统一收口到 `executionContext.workspacePreset`

## 2026-03-31 第三十四次更新（R8 第二十九刀：execution conversation artifact sidecar）

- 本轮目标：
  - 给能被保守识别的终态 execution conversation 补 additive `executionArtifactContext`
  - 让 execution detail 和 `/api/conversations` 轮询结果都带这层 artifact sidecar，为 conversation side 保留更细粒度的关联入口
- 已完成：
  - `lib/execution-workspace-link-contract.ts` 已新增 `ExecutionConversationArtifactContext` 与 `buildExecutionConversationArtifactSidecarsByUid()`；现在能基于终态 conversation 文本、`messageType`、`generated_spec` artifact 的 `success / exception / createdAt` 保守建立 `conversationUid -> artifact context` 映射
  - `lib/services/test-plan-service.ts` 的 `getExecutionDetail()` 已为命中的终态 conversations 补 `executionArtifactContext`，同时保留上一刀的 `executionContext / nextExecutionContext / executionEventContext`
  - `app/api/conversations/route.ts` 已接入同一 shared helper；`scene=plan_execution` 的轮询返回现在与 detail 首屏保持同一层 artifact sidecar
  - `components/ExecutionWorkbench.tsx` 与 `components/ExecutionConsole.tsx` 的 conversation item 类型已对齐新字段，并在命中时显示关联产物标签
  - `tests/unit/test-plan-service.spec.ts` 与 `tests/unit/api-conversations-route.spec.ts` 已补 helper、detail、route 断言，覆盖终态 success / exception conversation 命中与 auto-repair 文本不误挂的保守规则
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/api-conversations-route.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第二十九刀已完成：execution conversation artifact sidecar）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只覆盖保守识别到的终态 execution conversation；不会对一般 thinking / status 文本做模糊归因
  - 仍未给 conversation 增加独立 artifact id 落库字段；当前关联仍是 response-side sidecar
  - 只关联 `generated_spec`；其他 artifact type 仍未补到 conversation side
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要让 consumer 更系统地消费 `executionArtifactContext`，或继续推动 conversation / detail 统一收口到 `executionContext.workspacePreset`

## 2026-03-31 第三十五次更新（R8 第三十刀：execution conversation artifact consumer actions）

- 本轮目标：
  - 让 `executionArtifactContext` 在 consumer 侧形成最小可用操作，而不是只显示标签
  - 支持从 execution conversation 直接定位到关联 artifact，并在命中 `generated_spec` 时复用脚本下载入口
- 已完成：
  - `lib/execution-workspace-link-contract.ts` 已新增 `buildExecutionArtifactAnchorId()`、`findExecutionArtifactByConversationContext()` 与 `readExecutionArtifactDownloadEntry()`；现在能基于 `executionArtifactContext.storagePath` 生成稳定 anchor、命中 detail artifact，并统一读取可下载脚本内容
  - `components/ExecutionWorkbench.tsx` 已把 conversation 侧的 `executionArtifactContext` 升级成“查看关联产物 / 下载关联脚本”操作；artifact 卡片也已挂稳定 anchor
  - `components/ExecutionConsole.tsx` 已接入同一套 helper；console 视图与 workbench 现在在 artifact consumer 行为上保持一致
  - `tests/unit/test-plan-service.spec.ts` 已补 helper 断言，覆盖 artifact anchor、context 命中与 download entry 解析
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第三十刀已完成：execution conversation artifact consumer actions）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只消费已有 `executionArtifactContext`，没有扩展新的 server-side sidecar 字段
  - 只对 `generated_spec` 提供下载行为，其他 artifact type 仍仅支持定位
  - 当前仅提供 anchor 定位，不包含高亮或更复杂的 artifact 聚焦交互
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要围绕 `executionArtifactContext` 增加更强的聚焦反馈，或继续推动 conversation / detail 统一收口到 `executionContext.workspacePreset`

## 2026-03-31 第三十六次更新（R8 第三十一刀：execution artifact focus feedback）

- 本轮目标：
  - 在不扩展 server-side contract 的前提下，围绕既有 `executionArtifactContext` 增加更强的 artifact 聚焦反馈
  - 让 conversation 点击“查看关联产物”后，artifact 卡片进入稳定 focused 状态，并兼容直接打开带 hash 的执行页 URL
- 已完成：
  - `lib/execution-workspace-link-contract.ts` 已新增 `readExecutionArtifactAnchorIdFromHash()` 与 `isExecutionArtifactFocused()`；现在能从 `location.hash` 恢复 artifact anchor，并用同一套规则判断某条 artifact 是否处于 focused 状态
  - `components/ExecutionWorkbench.tsx` 已读取 URL hash 并维护最小 artifact focus 状态；conversation 里的“查看关联产物”会同步设置 focus，命中的 artifact 卡片会显示 focused 样式与“已定位”标记
  - `components/ExecutionConsole.tsx` 已接入同一套 hash/focus helper，独立运行页和 workbench 执行详情页的 artifact 聚焦反馈保持一致
  - `tests/unit/test-plan-service.spec.ts` 已补 helper 断言，覆盖 artifact anchor hash 解析与 focused 判定
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第三十一刀已完成：execution artifact focus feedback）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只提供 focused 样式反馈，不做复杂动画或额外 toast
  - 仍依赖现有 anchor 机制，不增加新的 artifact query / filter 状态
  - `executionArtifactContext` 当前仍只覆盖保守识别的终态 conversation，不会扩到所有对话类型
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要继续推动 conversation / detail 统一收口到 `executionContext.workspacePreset`，或围绕 artifact focus 再补更细的聚焦状态管理

## 2026-03-31 第三十七次更新（R8 第三十二刀：execution workspacePreset consumer badges）

- 本轮目标：
  - 在不改 server-side contract 的前提下，让执行页 consumer 对 `executionContext.workspacePreset` 形成统一、稳定的 summary badge 消费
  - 覆盖 execution header 与 conversation / event / artifact item，避免不同 consumer 对平台上下文各自拼装文案
- 已完成：
  - `lib/execution-workspace-link-contract.ts` 已新增 `pickPreferredExecutionWorkspacePresetContext()` 与 `buildExecutionWorkspacePresetBadges()`；现在能对 `executionContext / nextExecutionContext` 做保守择优，并从 focused `workspacePreset` 产出统一 badge 列表
  - `components/ExecutionWorkbench.tsx` 已接入同一套 helper；execution header、conversation、event、artifact card 现在都会显示统一的平台上下文 badges
  - `components/ExecutionConsole.tsx` 已补齐相同 consumer；独立执行页与 workbench 执行详情页在 `workspacePreset` 呈现上保持一致
  - `tests/unit/test-plan-service.spec.ts` 已补 helper 断言，覆盖 preferred context 选择与 focused preset badge 生成
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第三十二刀已完成：execution workspacePreset consumer badges）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只消费已有 `workspacePreset` sidecar，不新增 route / service / DB 字段
  - badge 仅在 focused preset 可用时展示；历史旧数据或非聚焦上下文仍会保守不显示
  - `intentImport` 面板仍保留现有明细展示，没有在本轮继续收敛到同一 badge row
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要把执行页剩余平台上下文展示进一步统一到 shared helper，或转向下一个与 execution context 消费闭环直接相关的小步

## 2026-03-31 第三十八次更新（R8 第三十三刀：execution intentImport workspacePreset summary helper）

- 本轮目标：
  - 把执行页 `intentImport` 面板里剩余的 test / runner / contract / artifactKinds 展示收口到 shared helper
  - 让 `ExecutionWorkbench` 与 `ExecutionConsole` 在 import 面板上复用同一套平台 summary 文案，而不是继续各自拼装
- 已完成：
  - `lib/execution-workspace-link-contract.ts` 已新增 `buildExecutionWorkspacePresetSummaryBadges()` 与 `buildExecutionWorkspacePresetDetailItems()`；现在能从 `WorkspacePlatformQueryPresetSummary` 统一产出 import 面板需要的 badges / detail items
  - `buildExecutionWorkspacePresetBadges()` 已复用新的 summary helper，header / conversation / event / artifact 的 badge 逻辑与 import 面板保持同源
  - `components/ExecutionWorkbench.tsx` 与 `components/ExecutionConsole.tsx` 的 `intentImport` 面板已改为消费 shared helper，并删除本地 `testType / runnerType / compact id` 文案拼装
  - `intentImport.workspacePreset` 缺失时，consumer 会保守 fallback 到现有 raw `testType / runnerType / testCaseId / testSpecId / verificationContractId / artifactKinds`，避免旧数据展示回退
  - `tests/unit/test-plan-service.spec.ts` 已补 helper 断言，覆盖 summary badge 与 detail item 输出
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第三十三刀已完成：execution intentImport workspacePreset summary helper）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一 execution consumer 的 import 面板 summary 展示，不调整 route / service contract
  - 当前 shared helper 仍只覆盖 summary badges / detail items，不包含 import 面板里的链接布局或导入状态文案
  - `intentImport` 原始字段仍保留在 response 里，当前只是 consumer 侧停止直接拼装这些字段的展示
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要把执行页剩余与平台上下文相关的链接 / 面板布局也继续收口到 shared helper，或转向下一个 execution context 消费闭环的小步

## 2026-03-31 第三十九次更新（R8 第三十四刀：execution intentImport workspacePreset action helper）

- 本轮目标：
  - 把 `intentImport` 面板里剩余的 preset link 判断与 raw summary fallback 继续收口到 shared helper
  - 让 `ExecutionWorkbench` 与 `ExecutionConsole` 的 import 面板进一步减少组件内分支判断
- 已完成：
  - `lib/execution-workspace-link-contract.ts` 已新增 `readExecutionWorkspacePresetSummary()`；现在会优先读取 `workspacePreset.summary`，缺失时再保守回退到 raw `testType / runnerType / testCaseId / testSpecId / verificationContractId / artifactKinds`
  - `lib/execution-workspace-link-contract.ts` 已新增 `buildExecutionWorkspacePresetFocusActions()`；focused preset 现在能统一产出“查看聚焦任务 / 查看聚焦执行历史” actions，并复用既有 `ExecutionWorkspaceLinkAction` contract
  - `components/ExecutionWorkbench.tsx` 与 `components/ExecutionConsole.tsx` 的 `intentImport` 面板已改为消费这两个 helper；组件内不再手写 summary fallback 对象和 preset link 条件渲染
  - `tests/unit/test-plan-service.spec.ts` 已补 helper 断言，覆盖 preset summary 优先级、raw summary fallback 和 focused preset action 输出
- 验证：
  - `npx vitest run tests/unit/test-plan-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第三十四刀已完成：execution intentImport workspacePreset action helper）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一 import 面板的 helper 接线，不调整 execution consumer 的布局结构
  - `ExecutionPresetBadgeRow` 仍在两个组件里各自本地声明，本轮没有继续抽共享 UI 组件
  - 当前 shared helper 仍聚焦 execution 页 consumer，没有扩到其他平台资产页面
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要把 execution 页剩余重复的 preset row / panel 结构继续收口，或转向下一个 execution context 消费闭环小步

## 2026-03-31 第四十次更新（R8 第三十五刀：execution preset badge row shared component）

- 本轮目标：
  - 把 `ExecutionWorkbench` 与 `ExecutionConsole` 中重复的 `ExecutionPresetBadgeRow` 提取为共享组件
  - 保持 execution 页现有 badge 呈现不变，只收 consumer 结构重复
- 已完成：
  - 已新增 `components/ExecutionPresetBadgeRow.tsx`，复用 `ExecutionWorkspacePresetBadge` 类型，承接 execution 页统一的 preset badge row 渲染
  - `components/ExecutionWorkbench.tsx` 已切到共享 `ExecutionPresetBadgeRow`，删除本地重复定义
  - `components/ExecutionConsole.tsx` 已切到共享 `ExecutionPresetBadgeRow`，删除本地重复定义
  - 本轮没有改动 execution context contract、helper 逻辑或页面样式，只减少重复 UI 实现
- 验证：
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第三十五刀已完成：execution preset badge row shared component）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只抽取共享 badge row，没有继续统一更大粒度的 execution panel 结构
  - `intentImport` 面板与 conversation / event / artifact 区块的布局仍分别存在于两个 execution consumer 中
  - 当前共享组件仍只服务 execution 页，尚未扩到其他工作台 consumer
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要把 execution 页剩余重复的 preset panel / detail item 结构继续收口，或转向下一个 execution context 消费闭环小步

## 2026-03-31 第四十一次更新（R8 第三十六刀：execution preset detail grid shared component）

- 本轮目标：
  - 把 `ExecutionWorkbench` 与 `ExecutionConsole` 中重复的 preset detail item grid 提取为共享组件
  - 保持 import 面板 detail item 的展示内容、宽列规则和样式不变，只减少重复 UI 代码
- 已完成：
  - 已新增 `components/ExecutionPresetDetailGrid.tsx`，复用 `ExecutionWorkspacePresetDetailItem` 类型，统一承接 execution 页 preset detail item grid 渲染
  - `components/ExecutionWorkbench.tsx` 已切到共享 `ExecutionPresetDetailGrid`，删除本地重复的 `intentImportPresetDetails.map()` 结构
  - `components/ExecutionConsole.tsx` 已切到共享 `ExecutionPresetDetailGrid`，删除本地重复的 `intentImportPresetDetails.map()` 结构
  - 本轮没有改动 execution preset helper 输出和页面业务逻辑，只继续收 consumer 结构重复
- 验证：
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第三十六刀已完成：execution preset detail grid shared component）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只抽取共享 detail grid，没有继续统一 action row 或更大粒度的 import panel 结构
  - `ExecutionWorkbench` 与 `ExecutionConsole` 仍各自保留 import panel 的容器和 action row 样式
  - 当前共享组件仍只服务 execution 页，尚未扩到其他工作台 consumer
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要把 execution 页剩余重复的 preset action row / panel 结构继续收口，或转向下一个 execution context 消费闭环小步

## 2026-03-31 第四十二次更新（R8 第三十七刀：execution preset action row shared component）

- 本轮目标：
  - 把 `ExecutionWorkbench` 与 `ExecutionConsole` 中重复的 preset action row 提取为共享组件
  - 通过轻量样式参数保留两边现有视觉差异，不改 action 行为和链接 contract
- 已完成：
  - 已新增 `components/ExecutionPresetActionRow.tsx`，复用 `ExecutionWorkspaceLinkAction`，统一承接 execution 页 preset action row 的动作映射
  - `components/ExecutionWorkbench.tsx` 已切到共享 `ExecutionPresetActionRow`，用 props 保留 workbench 侧现有 action row 样式
  - `components/ExecutionConsole.tsx` 已切到共享 `ExecutionPresetActionRow`，用 props 保留 console 侧现有 action row 样式
  - 本轮没有改动 helper 输出、action 文案或跳转逻辑，只继续减少 execution consumer 的重复 UI 结构
- 验证：
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第三十七刀已完成：execution preset action row shared component）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只抽取共享 action row，没有继续统一 import panel 容器和文案结构
  - workbench / console 的 import panel 视觉差异仍通过调用参数保留，没有进一步合并成统一视觉组件
  - 当前共享组件仍只服务 execution 页，尚未扩到其他工作台 consumer
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要把 execution 页剩余重复的 import panel 骨架继续收口，或转向下一个 execution context 消费闭环小步

## 2026-03-31 第四十三次更新（R8 第三十八刀：execution intentImport summary shared component）

- 本轮目标：
  - 把 `intentImport` 面板里 `importedFromRunId + badges + details + importedAt + actions` 这段 summary body 提取为共享组件
  - 保留 workbench / console 两边不同的 header、外层容器和 spacing 差异，不改行为和文案
- 已完成：
  - 已新增 `components/ExecutionIntentImportSummary.tsx`，组合复用现有 `ExecutionPresetBadgeRow`、`ExecutionPresetDetailGrid`、`ExecutionPresetActionRow`
  - `components/ExecutionWorkbench.tsx` 已切到共享 `ExecutionIntentImportSummary`，继续通过 props 保留 workbench 侧的 importedAt / action row spacing 与样式
  - `components/ExecutionConsole.tsx` 已切到共享 `ExecutionIntentImportSummary`，继续通过 props 保留 console 侧的 grid / importedAt / action row 样式
  - 本轮没有改动 intent import helper 输出、action 行为或文案，只继续减少 execution consumer 的重复 panel body 结构
- 验证：
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第三十八刀已完成：execution intentImport summary shared component）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一 import panel 的 summary body，没有继续合并 header 文案和外层容器视觉
  - workbench / console 的 `intentImportTone` / `intentImportPanelTone` 仍各自留在页面侧
  - 当前共享 summary 组件仍只服务 execution 页，尚未扩到其他工作台 consumer
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要把 execution 页剩余的 import panel header / tone helper 继续收口，或转向下一个 execution context 消费闭环小步

## 2026-03-31 第四十四次更新（R8 第三十九刀：execution intentImport UI helper）

- 本轮目标：
  - 把 `ExecutionWorkbench` 与 `ExecutionConsole` 中重复的 `intentImportLabel()` 与 `intentImportPanelTone()` 提取为 shared helper
  - 保留两边各自不同的 badge tone 类名分支，不合并页面级视觉细节
- 已完成：
  - 已新增 `lib/execution-intent-import-ui.ts`，统一输出 execution 页需要的 intent import label 与 panel tone
  - `components/ExecutionWorkbench.tsx` 已改为消费 shared helper，本地只保留 workbench 侧的 badge tone 类名 helper
  - `components/ExecutionConsole.tsx` 已改为消费 shared helper，本地只保留 console 侧的 badge tone 类名 helper
  - 本轮没有改动 import panel 布局、action 行为或 helper 输出结构，只继续减少 execution consumer 的重复 UI 逻辑
- 验证：
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第三十九刀已完成：execution intentImport UI helper）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一 label / panel tone；两边 badge tone 类名仍是页面级差异，没有继续共享
  - `ExecutionWorkbench` 与 `ExecutionConsole` 的 import panel header 结构仍分别存在
  - 当前 helper 仍只服务 execution 页，尚未扩到其他工作台 consumer
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要把 execution 页剩余的 import panel header / badge tone helper 继续收口，或转向下一个 execution context 消费闭环小步

## 2026-03-31 第四十五次更新（R8 第四十刀：execution intentImport badge tone helper）

- 本轮目标：
  - 把 `ExecutionWorkbench` 与 `ExecutionConsole` 中重复的 `intentImportTone()` 提取为 shared helper
  - 通过轻量 variant 参数保留两边现有 badge 视觉差异，不改文案和状态判断
- 已完成：
  - `lib/execution-intent-import-ui.ts` 已新增 `executionIntentImportBadgeTone()`，统一承接 execution 页 intent import badge tone 判断，并支持 `workbench / console` 两种样式分支
  - `components/ExecutionWorkbench.tsx` 已改为消费 shared badge tone helper，本地不再保留 `intentImportTone()`
  - `components/ExecutionConsole.tsx` 已改为消费 shared badge tone helper，本地不再保留 `intentImportTone()`
  - 本轮没有改动 import panel 文案、panel tone 或布局结构，只继续减少 execution consumer 的重复 badge helper
- 验证：
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第四十刀已完成：execution intentImport badge tone helper）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一 badge tone helper；两边 import panel header 结构仍分别存在
  - workbench / console 的 badge 视觉差异仍通过 variant 参数保留，没有进一步合并成统一样式
  - 当前 helper 仍只服务 execution 页，尚未扩到其他工作台 consumer
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要把 execution 页剩余的 import panel header 结构继续收口，或转向下一个 execution context 消费闭环小步

## 2026-03-31 第四十六次更新（R8 第四十一刀：execution intentImport header shared component）

- 本轮目标：
  - 把 `ExecutionWorkbench` 与 `ExecutionConsole` 中重复的 `intentImport` header 结构提取为共享组件
  - 通过参数保留两边在标题标签、badge 样式和描述间距上的轻微差异，不改文案语义
- 已完成：
  - 已新增 `components/ExecutionIntentImportHeader.tsx`，统一承接 execution 页 `标题 + 状态 badge + 描述` 的 header 骨架
  - `components/ExecutionWorkbench.tsx` 已切到共享 `ExecutionIntentImportHeader`，继续通过 props 保留 workbench 侧 header 样式
  - `components/ExecutionConsole.tsx` 已切到共享 `ExecutionIntentImportHeader`，继续通过 props 保留 console 侧 header 样式
  - 本轮没有改动 import panel body、helper 输出或状态文案，只继续减少 execution consumer 的重复 header 结构
- 验证：
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第四十一刀已完成：execution intentImport header shared component）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一 import panel header；外层容器和两页整体布局仍分别存在
  - workbench / console 的 header 视觉差异仍通过 props 保留，没有进一步统一成同一套外观
  - 当前共享 header 组件仍只服务 execution 页，尚未扩到其他工作台 consumer
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要把 execution 页剩余的 import panel 外层骨架继续收口，或转向下一个 execution context 消费闭环小步

## 2026-03-31 第四十七次更新（R8 第四十二刀：execution intentImport panel shared component）

- 本轮目标：
  - 把 `ExecutionWorkbench` 与 `ExecutionConsole` 中重复的 `intentImport` panel 外层装配提取为共享组件
  - 保留两边现有的 spacing、header 样式和 action 样式差异，不改行为和文案
- 已完成：
  - 已新增 `components/ExecutionIntentImportPanel.tsx`，内部统一组合 `executionIntentImportPanelTone()`、`ExecutionIntentImportHeader` 与 `ExecutionIntentImportSummary`
  - `components/ExecutionWorkbench.tsx` 已切到共享 `ExecutionIntentImportPanel`，继续通过 props 保留 workbench 侧 panel spacing 和 action 样式
  - `components/ExecutionConsole.tsx` 已切到共享 `ExecutionIntentImportPanel`，继续通过 props 保留 console 侧 panel spacing、summary grid 和 action 样式
  - 本轮没有改动 intent import helper 输出、action 行为或顶部 execution header 的 import badge，只继续减少 execution consumer 的重复 panel skeleton
- 验证：
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第四十二刀已完成：execution intentImport panel shared component）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一 import panel skeleton；顶部 execution header 的 import badge 仍分别留在两个页面中
  - workbench / console 的视觉差异仍通过 props 保留，没有进一步合并成同一套外观
  - 当前共享 panel 组件仍只服务 execution 页，尚未扩到其他工作台 consumer
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要把 execution 页顶部 import badge 也继续收口，或转向下一个 execution context 消费闭环小步

## 2026-03-31 第四十八次更新（R8 第四十三刀：execution intentImport status badge shared component）

- 本轮目标：
  - 把 `ExecutionWorkbench` 与 `ExecutionConsole` 顶部 execution header 中重复的 `intentImport` status badge 提取为共享组件
  - 保留两边现有的 badge 形态和 tone variant 差异，不改文案和状态判断
- 已完成：
  - 已新增 `components/ExecutionIntentImportStatusBadge.tsx`，统一复用 `executionIntentImportLabel()` 与 `executionIntentImportBadgeTone()`
  - `components/ExecutionWorkbench.tsx` 顶部 execution header 已切到共享 `ExecutionIntentImportStatusBadge`
  - `components/ExecutionConsole.tsx` 顶部 execution header 已切到共享 `ExecutionIntentImportStatusBadge`
  - 本轮没有改动 import panel 结构、helper 输出或其它状态徽章逻辑，只继续减少 execution consumer 的重复 import badge 装配
- 验证：
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第四十三刀已完成：execution intentImport status badge shared component）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一顶部 import badge；顶部 execution header 的其它元素仍分别存在于两个页面
  - 当前共享 badge 组件与 panel 组件仍只服务 execution 页，尚未扩到其他工作台 consumer
  - 进一步抽公共 execution detail view 结构的收益开始下降，需要评估是否继续沿同一路径推进
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否要转向 execution detail 其余重复类型/类型定义收口，或结束当前 consumer 收口阶段并切回下一个 execution context 能力切片

## 2026-03-31 第四十九次更新（R8 第四十四刀：execution detail shared contract）

- 本轮目标：
  - 把 `ExecutionWorkbench` 与 `ExecutionConsole` 中重复的 execution detail 类型定义与 `item -> workspace link actions` helper 收口成共享 contract
  - 保留两边现有 UI、文案和 route response 语义，不改布局和交互行为
- 已完成：
  - 已新增 `lib/execution-detail-contract.ts`，统一承接 execution consumer 共用的 `ExecutionStatus`、`ExecutionDetail`、`ConversationItem / EventItem / ArtifactItem` 以及 `buildExecutionItemWorkspaceLinkActions()`
  - `components/ExecutionWorkbench.tsx` 已切到共享 execution detail contract，不再保留本地重复类型和 `buildExecutionItemLinkActions()`
  - `components/ExecutionConsole.tsx` 已切到共享 execution detail contract，不再保留本地重复类型和 `buildExecutionItemLinkActions()`
  - execution detail contract 已直接复用 `lib/intent-e2e-import.ts` 中已有的 `IntentImportPlatformTestType / IntentImportPlatformRunnerType`，避免 execution consumer 侧继续重复维护平台类型
  - 已新增 `tests/unit/execution-detail-contract.spec.ts`，覆盖 current / next / fallback 三种 workspace link action 选择逻辑
- 验证：
  - `npx vitest run tests/unit/execution-detail-contract.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第四十四刀已完成：execution detail shared contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一 execution detail contract 与 item link helper；页面级 `statusTone`、`messageTone`、`renderEventLine` 等展示 helper 仍分别存在
  - 当前共享 contract 仍只服务 execution 页，还没有抽象成更广义的 run detail contract
  - 继续沿 consumer 收口往下做的收益在下降，下一刀需要评估是否还值得继续抽 shared helper
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否把 execution 页剩余的小型展示 helper 再收一刀，或结束当前 consumer 收口阶段并切回下一个 execution context 能力切片

## 2026-03-31 第五十次更新（R8 第四十五刀：execution detail format helper）

- 本轮目标：
  - 把 `ExecutionWorkbench` 与 `ExecutionConsole` 中重复的 execution detail 格式化 helper 收口成共享纯函数
  - 保留现有时间显示格式、摘要文案和页面行为，不改 UI 结构
- 已完成：
  - 已新增 `lib/execution-detail-format.ts`，统一承接 `formatExecutionMoment()` 与 `summarizeExecutionTextList()`
  - `components/ExecutionWorkbench.tsx` 已切到共享 format helper，不再保留本地 `formatMoment()` / `summarizeTextList()`
  - `components/ExecutionConsole.tsx` 已切到共享 format helper，不再保留本地 `formatMoment()` / `summarizeTextList()`
  - 已新增 `tests/unit/execution-detail-format.spec.ts`，覆盖空值、非法时间、有效时间格式和摘要裁剪逻辑
- 验证：
  - `npx vitest run tests/unit/execution-detail-format.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第四十五刀已完成：execution detail format helper）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一 execution detail 的纯格式化 helper；页面级 `statusTone`、`messageTone`、`renderEventLine` 等展示逻辑仍分别存在
  - 当前 shared format helper 仍只服务 execution 页，没有扩到其他 run detail consumer
  - execution consumer 收口已接近尾声，继续抽 shared helper 的收益正在下降
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否把剩余页面级展示 helper 再收最后一刀，或结束当前 consumer 收口阶段并切回下一个 execution context 能力切片

## 2026-03-31 第五十一次更新（R8 第四十六刀：execution detail tone helper）

- 本轮目标：
  - 把 `ExecutionWorkbench` 与 `ExecutionConsole` 中重复的 execution detail tone helper 收口成共享纯函数
  - 通过 `workbench / console` variant 保留现有 class 差异，不改页面结构和视觉语义
- 已完成：
  - 已新增 `lib/execution-detail-tone.ts`，统一承接 `executionStatusTone()` 与 `executionConversationMessageTone()`
  - `components/ExecutionWorkbench.tsx` 已切到共享 tone helper，不再保留本地 `statusTone()` / `messageTone()`
  - `components/ExecutionConsole.tsx` 已切到共享 tone helper，不再保留本地 `statusTone()` / `messageTone()`
  - 已新增 `tests/unit/execution-detail-tone.spec.ts`，覆盖 workbench / console 两个 variant 的关键状态与消息 tone 映射
- 验证：
  - `npx vitest run tests/unit/execution-detail-tone.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第四十六刀已完成：execution detail tone helper）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一 execution detail 的 tone helper；`renderEventLine()`、console 专属 `outcomeTone()` / `outcomeHintTone()` 等展示逻辑仍保留在页面侧
  - 当前 shared tone helper 仍只服务 execution 页，没有扩到其他 run detail consumer
  - execution consumer 收口收益已经很低，继续抽剩余 helper 需要确认是否真的值得
- 下一步：
  - 继续推进 `R8` 下一刀，评估是否结束当前 execution consumer 收口阶段并切回下一个 execution context 能力切片，或只对剩余单页 helper 做最后一次极小收尾

## 2026-03-31 第五十二次更新（R8 第四十七刀：execution detail preset view-model helper）

- 本轮目标：
  - 把 `ExecutionWorkbench` 与 `ExecutionConsole` 中重复的 execution detail preset view-model 装配收口成共享 helper
  - 保留现有 execution context links、preset badges、intent import details 和 focus actions 的显示结果，不改 UI 结构
- 已完成：
  - 已新增 `lib/execution-detail-preset-view-model.ts`，统一承接 execution consumer 对 `detail.executionContext` 与 `detail.intentImport` 的 links / badges / detail items / focus actions 装配
  - `components/ExecutionWorkbench.tsx` 已切到共享 preset view-model helper，不再本地重复装配 execution context links 和 intent import preset 视图数据
  - `components/ExecutionConsole.tsx` 已切到共享 preset view-model helper，不再本地重复装配 execution context links 和 intent import preset 视图数据
  - 已新增 `tests/unit/execution-detail-preset-view-model.spec.ts`，覆盖 focused preset 与 raw summary fallback 两种场景
- 验证：
  - `npx vitest run tests/unit/execution-detail-preset-view-model.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第四十七刀已完成：execution detail preset view-model helper）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一 execution detail 的 preset view-model 装配；`renderEventLine()`、console 专属 outcome helper 等单页逻辑仍保留在页面侧
  - 当前 shared helper 仍只服务 execution 页，没有扩到其他 run detail consumer
  - execution consumer 收口线已基本见底，继续抽单页私有 helper 的收益很低
- 下一步：
  - 继续推进 `R8` 下一刀，优先评估是否结束当前 execution consumer 收口阶段并切回下一个 execution context 能力切片，而不是继续做低收益的页面级清理

## 2026-03-31 第五十三次更新（R8 第四十八刀：execution entry navigation helper）

- 本轮目标：
  - 停止继续做 execution detail 页面的低收益清理，切回 execution context 入口 consumer
  - 把 execution entry response / workspace persist response 的导航目标解析收口成共享 helper，统一 `runPath / workspacePath / workspaceHistoryPath` 消费
- 已完成：
  - 已新增 `lib/execution-entry-navigation.ts`，统一承接 execution entry response 的 `runPath / workspacePath / workspaceHistoryPath` 解析与 history 链接可用性判断
  - `components/ProjectWorkspace.tsx` 的执行启动跳转已切到共享 navigation helper，不再本地直接读取 `readExecutionWorkspaceLinkContract(json)`
  - `components/ExecutionConsole.tsx` 的 repair 启动跳转已切到共享 navigation helper，不再本地手写 `runPath` fallback
  - `components/IntentE2EWorkbench.tsx` 的 workspace save 回执链接已切到共享 navigation helper，不再本地重复装配 `executionContext / workspaceQueryPath / workspaceHistoryPath`
  - 已新增 `tests/unit/execution-entry-navigation.spec.ts`，覆盖 `executionContext` 优先、legacy fallback 和 history 可用性判断
- 验证：
  - `npx vitest run tests/unit/execution-entry-navigation.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第四十八刀已完成：execution entry navigation helper）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一 execution entry consumer 的导航解析；entry response 的视觉回执组件和文案仍保留在各自页面侧
  - 当前 shared navigation helper 仍只接到 `ProjectWorkspace`、`ExecutionConsole`、`IntentE2EWorkbench` 三个入口 consumer，尚未扩到更多潜在回执面
  - execution context 消费线的主要共享 contract 已基本收口，继续沿这条线推进需要更严格判断收益
- 下一步：
  - 继续推进 `R8` 下一刀，优先评估是否结束当前 execution context consumer 收口阶段，并切回统一测试类型抽象与资产模型的下一块能力切片

## 2026-03-31 第五十四次更新（R8 第四十九刀：capability verification launch navigation consumer）

- 本轮目标：
  - 把 `ProjectIntentWorkbench` 的 capability verify / repair launch 接到 shared execution entry navigation helper
  - 避免 capability verification consumer 继续只把 `payload.runPath` 当作唯一导航入口，统一 `runPath / workspacePath / workspaceHistoryPath` 消费
- 已完成：
  - `components/ProjectIntentWorkbench.tsx` 已接入 `readExecutionEntryNavigationTargets()`，single launch 和 batch launch 都改为先解析 shared navigation 再写入本地 batch monitor
  - capability verification batch item 已补齐 `workspacePath / workspaceHistoryPath`，不再只保留 `runPath`
  - capability verification batch 卡片已补 workspace / history 打开入口，和现有 execution entry consumer 使用同一套 navigation 解析
  - `tests/unit/execution-entry-navigation.spec.ts` 已补 capability verification launch payload 覆盖，验证缺少 `runPath` 时仍可基于 `executionUid + workspace links` 稳定解析
- 验证：
  - `npx vitest run tests/unit/execution-entry-navigation.spec.ts tests/unit/api-project-capability-verify-route.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第四十九刀已完成：capability verification launch navigation consumer）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只统一 capability verification launch consumer，未继续扩到更多非 execution 主线的回执面
  - capability verification 的 promotion governance 审计仍只消费 `runPath` 字段，本轮未继续抽成更大的 shared audit contract
  - 当前 execution context consumer 收口已接近尾声，下一刀需要更严格判断是否继续沿 consumer 线推进
- 下一步：
  - 继续推进 `R8` 下一刀，优先评估是否结束当前 execution context consumer 收口阶段，并切回统一测试类型抽象与资产模型的下一块能力切片

## 2026-03-31 第五十五次更新（R8 第五十刀：create flow precheck empty-state bypass）

- 本轮目标：
  - 修复创建型 scenario 在前置检查阶段被列表空态 `data_missing` 误拦截的问题
  - 让“创建入口就在列表页本身”的同页创建流程也能复用现有 create-flow precheck bypass
- 已完成：
  - 已调整 `lib/ai/intent-e2e-service.ts` 的 `looksLikeCreateFlowPrecheckBypass()`，不再因为 `targetUrl === precheckUrl` 直接排除同页创建场景
  - 保留 `entryUrl === precheckUrl` 与“创建 + 保存”语义判定，避免把非创建型任务误放行
  - 已新增 `tests/unit/intent-e2e-service.spec.ts` 用例，覆盖“商机列表页本身可新建”的 create flow，并校验 precheck 会带 `ignoreFailureClasses: ['data_missing']`
  - 本轮修复直接对应真实失败 run `intent-run-25bb2233-cf83-4db8-9947-36167a035ce2`，该 run 之前在 `暂无数据` 信号下被判为 `data_blocked`
- 验证：
  - `npx vitest run tests/unit/intent-e2e-service.spec.ts`
  - `npm run build`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第五十刀已完成：create flow precheck empty-state bypass）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只放宽了 create flow 的 `data_missing` precheck 旁路；如果页面空态同时不存在新建入口，后续仍可能在分析或执行阶段失败
  - 目前 bypass 仍主要依赖 scenario 文本里的“创建 / 保存”语义，不是基于真实 CTA 观测的更强判定
  - 尚未补这条真实商机创建任务的端到端回归，仍需用目标环境再跑一轮确认
- 下一步：
  - 继续推进 `R8` 下一刀，优先验证这类同页创建任务在真实环境中的恢复情况，并评估是否需要把 create-entry 可用性收口成更强的前置检查 contract

## 2026-03-31 第五十六次更新（R8 第五十一刀：create-entry precheck contract）

- 本轮目标：
  - 把 create-flow empty-state precheck bypass 从 service 内联分支收口成更稳定的前置检查 contract
  - 让现有平台资产 contract 可以显式携带这条 precheck policy，而不是只在运行时私有生效
- 已完成：
  - 已新增 `lib/intent-e2e-precheck-policy.ts`，统一解析 create-entry precheck policy，稳定产出 `ignoreFailureClasses` 与 `policyNotes`
  - `lib/ai/intent-e2e-service.ts` 已切到消费 shared precheck policy helper，不再本地内联判断 create-flow bypass
  - `lib/test-platform-asset-model.ts` 已支持把 precheck policy note 合并进现有 `verificationContract.typeFields.policyNotes`，并纳入 `contractId` 指纹
  - 已新增 `tests/unit/intent-e2e-precheck-policy.spec.ts`，并补充 `tests/unit/intent-e2e-service.spec.ts`，覆盖“列表进创建页 / 同页创建 / 非创建页”三种 precheck contract 形态
- 验证：
  - `npx vitest run tests/unit/intent-e2e-precheck-policy.spec.ts tests/unit/intent-e2e-service.spec.ts`
  - `npm run build`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第五十一刀已完成：create-entry precheck contract）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只是把 precheck policy 显式 contract 化，尚未基于真实 CTA 可点击性或页面动作能力做更强判定
  - 当前仍复用 `verificationContract.typeFields.policyNotes` 作为承载面，没有单独扩新字段
  - 这条 contract 还没有被 import / workspace / insights 等更多 consumer 系统性消费
- 下一步：
  - 继续推进 `R8` 下一刀，优先评估是否让 precheck policy contract 进入更多平台消费面，或结合真实环境回归确认 create-entry 场景恢复效果

## 2026-03-31 第五十七次更新（R8 第五十二刀：platform policy-note query consumer）

- 本轮目标：
  - 让 `verificationContract.typeFields.policyNotes` 进入 intent import summary 与 platform materialized query，避免这条 contract 只停留在原始运行结果里
  - 让 `ProjectWorkspace` 现有 platform observation / search 最小消费这条 policy note，作为 R8 平台资产模型的真实 consumer
- 已完成：
  - `lib/intent-e2e-import.ts` 已支持从导入 prompt 的 `平台验收策略：...` 行与 artifact meta 的 `verificationContract.typeFields.policyNotes` 提取 `verificationPolicyNotes`
  - `lib/test-platform-query-contract.ts` 已让 prompt-side / artifact-side materialized query 稳定保留 `verificationPolicyNotes`，并把 note-only payload 也视为平台 contract 信号
  - `lib/services/intent-e2e-workspace-service.ts` 已在 intent import generation prompt 中写入 `平台验收策略：...`，让 plan prompt 与 artifact bundle 两侧都能携带同一份 policy notes
  - `components/ProjectWorkspace.tsx` 已在现有 platform observation pills 与关键词搜索中最小消费 `verificationPolicyNotes`，可直接检索和查看 precheck / verification policy 文本
  - 已补充 `tests/unit/intent-e2e-import.spec.ts` 与 `tests/unit/intent-e2e-workspace-service.spec.ts`，覆盖 prompt 提取、artifact meta 提取、materialized query 归一化，以及 workspace import prompt 写入 policy note
- 验证：
  - `npx vitest run tests/unit/intent-e2e-import.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第五十二刀已完成：platform policy-note query consumer）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只把 policy notes 接到 import / query / workspace observation 这一条消费链，没有继续扩到 execution detail、insights 或更强索引面
  - 当前 workspace 仍只做最小展示与全文检索，没有按 note 类型拆独立筛选器或聚合统计
  - policy note 仍复用现有 `verificationContract.typeFields.policyNotes` 承载，没有单独扩展更结构化的 precheck governance schema
- 下一步：
  - 继续推进 `R8` 下一刀，优先评估是否把 verification policy notes 扩到 execution detail / insights 等剩余平台 consumer，或结合真实环境回归确认 create-entry 场景恢复效果

## 2026-03-31 第五十八次更新（R8 第五十三刀：execution detail policy-note consumer）

- 本轮目标：
  - 让 execution detail 的 `intentImport` contract 显式保留 `verificationPolicyNotes`
  - 让 `ExecutionWorkbench` / `ExecutionConsole` 通过共享 intent import view-model 最小展示这些 verification policy notes
- 已完成：
  - `lib/execution-detail-contract.ts` 已扩展 `intentImport.verificationPolicyNotes`，execution detail contract 不再把这条平台 policy 信息静默丢掉
  - `lib/services/test-plan-service.ts` 已在 `getExecutionDetail()` 中显式回填 `verificationPolicyNotes`，不再只依赖 spread 传递导入平台摘要
  - `lib/execution-detail-preset-view-model.ts` 已补 shared policy-note detail item，复用现有 `ExecutionIntentImportPanel` 的 detail grid 展示 policy notes
  - `tests/unit/execution-detail-preset-view-model.spec.ts` 已覆盖 focused preset 与 raw import fallback 两种 execution detail consumer 场景
  - `tests/unit/test-plan-service.spec.ts` 已覆盖 execution detail 从 imported artifact meta 提取 `verificationPolicyNotes`
- 验证：
  - `npx vitest run tests/unit/execution-detail-preset-view-model.spec.ts tests/unit/test-plan-service.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第五十三刀已完成：execution detail policy-note consumer）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只把 policy notes 扩到 execution detail consumer，没有继续扩到 insights 或新的平台聚合索引
  - 当前 execution detail 仍把 policy notes 作为字符串列表摘要展示，没有做按 note 类型或来源的结构化拆分
  - workspace preset summary 仍未承载 policy notes，本轮只在 execution detail intent import contract 本地消费
- 下一步：
  - 继续推进 `R8` 下一刀，优先评估是否把 verification policy notes 扩到 insights 等剩余平台 consumer，或结合真实环境回归确认 create-entry 场景恢复效果

## 2026-03-31 第五十九次更新（R8 第五十九刀：insights policy-note consumer）

- 本轮目标：
  - 让 `intent-e2e insights` 的 `recentTraces` 显式保留 `verificationPolicyNotes`
  - 让 `IntentE2EWorkbench` 的最近 trace 卡片最小展示这些 precheck / verification policy notes
- 已完成：
  - `lib/ai/intent-e2e-insights.ts` 已扩展 `IntentE2EInsightRecentTrace` 与内部 `InsightRunRecord`，recent trace 现在会稳定保留 `verificationPolicyNotes`
  - recent trace 已优先读取 `verificationContract.typeFields.policyNotes`，并兼容 fallback 到 legacy `verificationPlan.policyNotes`
  - `components/IntentE2EWorkbench.tsx` 已在现有 trace `result` 卡片中补一行 `policy` 摘要，不新增新的 trace 面板结构
  - `tests/unit/intent-e2e-insights.spec.ts` 已补 recent trace 的 policy-note contract 覆盖，同时验证 legacy verification plan fallback
- 验证：
  - `npx vitest run tests/unit/intent-e2e-insights.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：进行中（第五十九刀已完成：insights policy-note consumer）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - 本轮只把 policy notes 接到 recent trace consumer，没有继续扩到新的 insights summary / watchlist / coverage 聚合字段
  - 当前 trace 卡片仍只展示字符串摘要，没有做按 policy 来源或类型的结构化拆分
  - `R8` 还差最后一轮 close-out 判断，确认 run / audit / workspace / execution detail / insights 这几条平台消费链已经闭合
- 下一步：
  - 继续推进 `R8` 下一刀，优先做统一 close-out，确认平台资产模型在 run / audit / workspace / execution detail / insights 各条消费面都已闭合，再决定是否正式结束 `R8`

## 2026-03-31 第六十次更新（R8 第六十刀：R8 close-out）

- 本轮目标：
  - 对照 R8 完成标准，确认统一测试类型抽象与平台资产模型已经覆盖当前主消费链
  - 回写阶段状态，把 `R8` 从进行中切到已完成，并明确 `R9` 才是下一阶段边界
- 已完成：
  - 已复核 run / snapshot / workspace import / activity audit / execution detail / insights 这几条主链路，当前都已稳定消费统一的 `testType / runnerType / testCase / testSpec / verificationContract / artifactContract` 平台资产模型
  - `verificationPolicyNotes` 已沿 workspace、execution detail、insights 三条剩余可见消费面补齐，R8 收尾期不再存在明显的 platform policy 信息只停留在底层资产而没有主消费入口读取的问题
  - 已更新本文件顶部阶段状态，`R8` 正式切为已完成；后续新增能力应进入 `R9：Runner Adapter 化与非 UI 执行主链路`
- 验证：
  - `npx vitest run tests/unit/intent-e2e-precheck-policy.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-import.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/execution-detail-preset-view-model.spec.ts tests/unit/test-plan-service.spec.ts tests/unit/intent-e2e-insights.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9-R14`：待开始
- 风险 / 未完成：
  - `R8` 结束不代表已经具备真实 non-UI runner；那部分仍明确属于 `R9`
  - 当前平台资产模型虽然已闭合到主要消费面，但不等于所有未来 overview / summary 都已经做成更细粒度的聚合统计
  - 本轮 close-out 没有扩新接口或新执行器，只确认现有统一模型已经足够支撑下一阶段 adapter 化
- 下一步：
  - 进入 `R9`，优先定义统一 runner adapter contract，并落第一批非 UI 执行主链路接入

## 2026-03-31 第六十一次更新（R9 第一刀：统一 runner adapter contract）

- 本轮目标：
  - 为 `R9` 建立统一 runner adapter contract / registry，避免后续 non-UI runner 继续直接分叉在 `intent-e2e-service` 里
  - 把当前 browser E2E 的执行路径先收口到 adapter 调度，为后续 `http_runner / repo_test_runner / contract_runner` 预留稳定插口
- 已完成：
  - 新增 `lib/intent-runner-adapter.ts`，定义统一的 runner adapter contract、registry 和显式的 `playwright_runner / http_runner / repo_test_runner / contract_runner` 映射
  - 当前 `playwright_runner` 已通过 adapter 包装现有 `executeTest -> test-worker.mjs` 执行链；未接线的 non-UI runner 会返回明确的 `IntentRunnerAdapterNotImplementedError`，不再依赖 service 内部隐式分支
  - `lib/ai/intent-e2e-service.ts` 的执行点已改为先 resolve adapter 再执行，当前 browser E2E 主链路保持兼容；同时新增 `tests/unit/intent-runner-adapter.spec.ts`，并在 `tests/unit/intent-e2e-service.spec.ts` 增补了执行参数下沉兼容断言
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/intent-runner-adapter.spec.ts tests/unit/intent-e2e-service.spec.ts`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：进行中（第一刀已完成：统一 runner adapter contract）
  - `R10-R14`：待开始
- 风险 / 未完成：
  - 本轮只完成 adapter contract 和现有 Playwright 执行链收口，`http_runner / repo_test_runner / contract_runner` 仍未具备真实执行能力
  - 当前 adapter input 仍然偏向现有 browser run 上下文；进入真实 non-UI runner 时，可能还需要再补更纯的 runner-side input contract
  - 这一步还没有把任何 non-UI artifact / assertion / trace 真正送入现有 insights / audit 链路
- 下一步：
  - 继续推进 `R9` 第二刀，优先落一条真实 non-UI 执行链路，并让它打通执行、验收和留痕

## 2026-03-31 第六十二次更新（R9 第二刀：`executePlan` 接入 `http_runner`）

- 本轮目标：
  - 把 `executePlan / runExecutionInBackground` 从直接依赖 `executeTest` 收口到统一 runner adapter
  - 落一条最小但真实可执行的 `http_runner` 非 UI 链路，并把平台摘要写回现有 execution artifact query 链
- 已完成：
  - `lib/intent-runner-adapter.ts` 已补最小 `http_runner` 合同执行：支持单次 HTTP 请求、默认 `2xx` / 显式 `status` / `bodyIncludes` / `json path` 断言，并沿用现有 step / log hook 留痕
  - `lib/services/test-plan-service.ts` 已按计划 `generationPrompt` 解析 runner 与平台摘要；`executePlan` / `runExecutionInBackground` 现在统一通过 adapter 分发，未打平台 tag 的 legacy browser 计划仍兼容默认 `browser_e2e + playwright_runner`
  - `generated_spec` artifact meta 现在会为 tagged 的 non-imported execution 落 `platformMeta`；`lib/intent-e2e-import.ts` 已兼容从 `platformAssetBundle` 优先、`platformMeta` 回退读取平台摘要，`tests/unit/intent-runner-adapter.spec.ts`、`tests/unit/test-plan-service.spec.ts`、`tests/unit/intent-e2e-import.spec.ts` 已补对应覆盖
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/intent-runner-adapter.spec.ts tests/unit/test-plan-service.spec.ts tests/unit/intent-e2e-import.spec.ts`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：进行中（第二刀已完成：`executePlan` 接入 `http_runner`）
  - `R10-R14`：待开始
- 风险 / 未完成：
  - 本轮 `http_runner` 只覆盖单请求与基础断言，不处理多请求依赖、复杂鉴权编排或 fixture 生命周期
  - 当前 non-UI 只先打通 `executePlan` 执行、留痕与 artifact query，生成侧与更广的工作台入口还没有扩到新的非 UI 入口
  - `repo_test_runner / contract_runner` 仍保持显式占位，尚未进入真实执行阶段
- 下一步：
  - 继续推进 `R9` 第三刀，优先评估下一个可落地的 non-UI runner / asset query 切片，并保持 adapter / audit / query contract 一致

## 2026-03-31 第六十三次更新（R9 第三刀：`http_runner` trace artifact）

- 本轮目标：
  - 给最小 `http_runner` 非 UI 执行链补一份结构化 trace artifact
  - 让该 trace artifact 进入现有 execution artifact / event / detail 链，而不是只停留在 step / log 流
- 已完成：
  - `lib/intent-runner-adapter.ts` 已新增 runner-level artifact 输出 contract；`http_runner` 现在会把请求、响应摘要、断言步骤和终态组装为最小 `trace` artifact
  - `lib/services/test-plan-service.ts` 已新增统一的 runner artifact 持久化 helper，`executePlan` 的 background execution 现在会把 runner 返回的 `trace / report` 工件写入现有 `execution_artifacts` 和 `artifact` 事件
  - `tests/unit/test-plan-service.spec.ts` 已补 `api_flow + http_runner` 的 trace artifact 落盘断言，确认 artifact meta、artifact event 和现有 workspace context / platform meta 会一起保留
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/test-plan-service.spec.ts`
  - `npx vitest run tests/unit/intent-runner-adapter.spec.ts tests/unit/test-plan-service.spec.ts`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：进行中（第三刀已完成：`http_runner` trace artifact）
  - `R10-R14`：待开始
- 风险 / 未完成：
  - 本轮 trace artifact 只覆盖单请求 `http_runner` 的请求 / 响应 / 断言摘要，尚未扩到多请求链式 trace
  - trace artifact 已进入 execution artifact 列表和事件链，但当前没有新增独立下载 UI；仍主要通过现有 execution detail / artifact index 消费
  - `repo_test_runner / contract_runner` 仍未进入真实执行
- 下一步：
  - 继续推进 `R9` 下一刀，优先评估是否进入受控 `repo_test_runner` 最小 manifest / preset 执行骨架，或先补 non-UI artifact 的剩余消费缺口

## 2026-03-31 第六十四次更新（R9 第四刀：repair / restore 保留平台 runner tag）

- 本轮目标：
  - 修复 `repairExecution` 与 `restoreHistoricalPlanAsLatest` 重建 `generationPrompt` 时丢失平台 tag 的问题
  - 保证已经打上 non-UI 平台 tag 的计划在 repair / history restore 后仍解析到原 runner，而不是回退到默认 `browser_e2e + playwright_runner`
- 已完成：
  - `lib/services/test-plan-service.ts` 已新增平台 tag 继承 helper；`repairExecution` 与 `restoreHistoricalPlanAsLatest` 现在会从原 plan 的 `generationPrompt` 提取并回写 `平台测试类型 / 平台执行器 / 平台资产 / 平台验收策略 / 平台产物类型`
  - `api_flow + http_runner` 计划在 AI 纠错后重跑时，已继续通过 adapter 走真实 `http_runner`，并保持 focused workspace preset 与原平台 contract id 上下文
  - `tests/unit/test-plan-service.spec.ts` 已补 repair rerun 与 history restore 两侧覆盖，确认新 plan prompt 不再丢 runner tag
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/test-plan-service.spec.ts`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：进行中（第四刀已完成：repair / restore 保留平台 runner tag）
  - `R10-R14`：待开始
- 风险 / 未完成：
  - 本轮只继承已有平台 tag，不处理历史脏数据里本来就缺失 tag 的旧 plan
  - runner 解析当前仍依赖 `generationPrompt` 里的平台摘要，尚未升级成单独的结构化持久化字段
  - `repo_test_runner / contract_runner` 仍未进入真实执行阶段
- 下一步：
  - 继续推进 `R9` 下一刀，优先评估 `repo_test_runner` 的最小受控执行骨架，并保持 runner 选择、artifact 留痕与 repair 链一致

## 2026-03-31 第六十五次更新（R9 第五刀：`repo_test_runner` 受控 preset 执行）

- 本轮目标：
  - 给 `repo_test_runner` 落一条最小真实执行链，但保持受控执行，不允许任意 shell / 任意命令
  - 让 tagged `repo_test` plan 能通过 allowlisted repo-owned preset 进入现有 `executePlan -> artifact / event / detail` 链
- 已完成：
  - `lib/intent-runner-adapter.ts` 已新增 `repo_test_runner` JSON contract、preset allowlist 和受控子进程执行；当前仅支持 `vitest_unit / tsc_build / doc_links` 三类 repo-owned preset，并限制 `vitest_unit` 只能命中 `tests/unit/*.spec.ts`
  - `repo_test_runner` 现在会输出最小 `trace` 与 `report` artifact，沿用现有 runner artifact 持久化链，保留 command、targets、stdout/stderr 摘要与终态
  - `tests/unit/intent-runner-adapter.spec.ts` 已补 allowlisted preset 正常执行、非法 preset 失败、非法 target 失败；`tests/unit/test-plan-service.spec.ts` 已补 tagged `repo_test` plan 经 `executePlan` 走 adapter 并写入 focused workspace context / trace / report 的链路覆盖
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/intent-runner-adapter.spec.ts tests/unit/test-plan-service.spec.ts`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
  - `npm run test:e2e`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：进行中（第五刀已完成：`repo_test_runner` 受控 preset 执行）
  - `R10-R14`：待开始
- 风险 / 未完成：
  - 本轮 `repo_test_runner` 仍是 repo 内 hard-coded preset allowlist，还没有独立 manifest / registry 文件
  - 当前只允许 unit-test / build / doc-links 三类最小 preset，没有进入 integration / e2e / 多步 repo workflow
  - `contract_runner` 仍未进入真实执行阶段
- 下一步：
  - 继续推进 `R9` 下一刀，优先评估是否把 `repo_test_runner` 的 hard-coded preset allowlist 上提成 repo-owned manifest / registry，并为 `contract_runner` 预留同类受控执行骨架

## 2026-03-31 第六十六次更新（R9 第六刀：`repo_test_runner` repo-owned manifest / registry）

- 本轮目标：
  - 把 `repo_test_runner` 的 preset allowlist 从 adapter 本体中上提成 repo-owned manifest / registry
  - 保持现有受控执行语义与 `executePlan` / artifact 链行为不回退
- 已完成：
  - 新增 `intent-e2e.repo-test-runner-presets.json`，把 `vitest_unit / tsc_build / doc_links` 三个 preset 的 `displayName / entryPath / args / targetPolicy` 固化成 repo-owned manifest
  - 新增 `lib/repo-test-runner-preset-registry.ts`，统一承接 manifest 归一化、preset 查找和 target policy 校验；当前 `unit_test_spec` 与 `none` 两类 target policy 都已由 registry 负责解释
  - `lib/intent-runner-adapter.ts` 已改为通过 registry 解析 `repo_test_runner` preset、默认 targets 和命令装配；`tests/unit/repo-test-runner-preset-registry.spec.ts` 已补 manifest / target policy 覆盖，原有 adapter 与 `executePlan` repo_test 链路单测继续通过
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/repo-test-runner-preset-registry.spec.ts tests/unit/intent-runner-adapter.spec.ts tests/unit/test-plan-service.spec.ts`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
  - `npm run test:e2e`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：进行中（第六刀已完成：`repo_test_runner` repo-owned manifest / registry）
  - `R10-R14`：待开始
- 风险 / 未完成：
  - 当前 manifest 仍是静态 repo 文件，没有独立管理接口或热更新机制
  - target policy 目前只覆盖 `none / unit_test_spec` 两种最小模式，还没有进入 integration / e2e / 多步 workflow preset
  - `contract_runner` 仍未进入真实执行阶段
- 下一步：
  - 继续推进 `R9` 下一刀，优先评估为 `contract_runner` 落一条同样受控的最小 manifest / registry 骨架，并复用当前 repo-owned preset contract 的校验模式

## 2026-03-31 第六十七次更新（R9 第七刀：`contract_runner` repo-owned manifest / registry skeleton）

- 本轮目标：
  - 为 `contract_runner` 落一条与 `repo_test_runner` 同风格的 repo-owned manifest / registry skeleton
  - 先把 `contract_runner` 从纯 throw 占位收口成受控 contract 解析、显式失败和最小 artifact 留痕链
- 已完成：
  - 新增 `intent-e2e.contract-runner-presets.json`，把首个 `openapi_file` preset 的 `displayName / contractKind / targetPolicy` 固化成 repo-owned manifest；当前 target 只允许命中 `contracts/**/*.json|yaml|yml`
  - 新增 `lib/contract-runner-preset-registry.ts`，统一承接 `contract_runner` manifest 归一化、preset 查找和 target policy 校验；`contract_file` 模式已复用与 `repo_test_runner` 一致的受控 preset contract 思路
  - `lib/intent-runner-adapter.ts` 已改为通过 registry 解析 `contract_runner` contract，并在 preset 解析成功后返回最小 `trace / report` artifact 与显式失败结果；`tests/unit/contract-runner-preset-registry.spec.ts`、`tests/unit/intent-runner-adapter.spec.ts`、`tests/unit/test-plan-service.spec.ts` 已补对应覆盖
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/contract-runner-preset-registry.spec.ts tests/unit/intent-runner-adapter.spec.ts tests/unit/test-plan-service.spec.ts`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：进行中（第七刀已完成：`contract_runner` repo-owned manifest / registry skeleton）
  - `R10-R14`：待开始
- 风险 / 未完成：
  - 当前 `contract_runner` 仍未进入真实 contract diff / schema validation，只先完成受控 preset 骨架与 failure artifact 链
  - manifest 当前只有 `openapi_file` 一个最小 preset，且 target policy 只覆盖 repo 内 `contracts/**` 文件
  - 这一步仍未把 contract 校验成功结果接到真实发布 gate 或更丰富的 contract asset 结构
- 下一步：
  - 继续推进 `R9` 下一刀，优先评估 `contract_runner` 的最小真实 contract 校验链，并保持 repo-owned preset / target policy 约束不回退

## 2026-03-31 第六十八次更新（R9 第八刀：`contract_runner` 最小真实 OpenAPI 校验链）

- 本轮目标：
  - 让 `contract_runner` 的 `openapi_file` preset 进入最小真实执行，而不再只是解析 preset 后显式失败
  - 保持 repo-owned preset / target policy 约束不变，只对受控 `contracts/**` 单文件做最小 OpenAPI 基础校验
- 已完成：
  - 新增 `contracts/demo/petstore.yaml` 作为最小 repo-owned contract fixture；`contract_runner` 现在会真实读取 `contracts/**` 目标文件，而不是停留在纯 contract skeleton
  - `lib/intent-runner-adapter.ts` 已为 `contract_runner` 补上最小 OpenAPI 文件校验链：支持读取 `.json/.yaml/.yml`，当前对 JSON 走对象级检查，对 YAML 走最小结构解析；至少要求存在 `openapi/swagger` 版本字段和 1 个 `paths` 条目
  - `contract_runner` 在校验通过后会返回成功终态，并把 `target / format / version / title / pathCount` 写入 `trace / report` artifact；`tests/unit/intent-runner-adapter.spec.ts` 与 `tests/unit/test-plan-service.spec.ts` 已补成功 / 缺文件失败 / `executePlan` passed 链路覆盖
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/intent-runner-adapter.spec.ts tests/unit/test-plan-service.spec.ts`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：进行中（第八刀已完成：`contract_runner` 最小真实 OpenAPI 校验链）
  - `R10-R14`：待开始
- 风险 / 未完成：
  - 当前 `contract_runner` 只做单文件 OpenAPI 基础校验，不处理多文件 `$ref`、schema diff、breaking-change 分类或 contract baseline 对比
  - YAML 解析仍是最小启发式实现，没有引入完整 YAML / OpenAPI parser
  - 这一步尚未把 contract 校验结果接入真实发布 gate 或版本化 benchmark
- 下一步：
  - 继续推进 `R9` 下一刀，优先评估 `contract_runner` 的最小 baseline / diff 校验链，或为现有 OpenAPI 校验补最小 breaking-change 分类，同时保持 repo-owned preset 约束不回退

## 2026-03-31 第六十九次更新（R9 第九刀：R9 close-out）

- 本轮目标：
  - 对照 `R9` 完成标准，确认当前 runner adapter 与非 UI 执行主链路已经闭合
  - 回写阶段状态，把 `R9` 从进行中切到已完成，并明确下一阶段边界进入 `R10`
- 已完成：
  - 已复核 `http_runner / repo_test_runner / contract_runner` 三条 non-UI runner 链路：当前都已通过统一 adapter contract 进入真实执行、验收与 `trace / report` artifact 留痕，不再依赖 Playwright 页面对象
  - 已复核 `executePlan / runExecutionInBackground / generated_spec / runner artifacts / workspace preset / repair&restore runner tag` 这些主消费链，当前都能稳定承接 non-UI 的 `testType / runnerType / platformMeta`
  - 已更新本文件顶部阶段状态，`R9` 正式切为已完成；后续新增能力应进入 `R10：版本化评测集与冻结基准`
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/repo-test-runner-preset-registry.spec.ts tests/unit/contract-runner-preset-registry.spec.ts tests/unit/intent-runner-adapter.spec.ts tests/unit/test-plan-service.spec.ts tests/unit/intent-e2e-import.spec.ts tests/unit/intent-e2e-service.spec.ts`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
  - `npm run test:e2e`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10-R14`：待开始
- 风险 / 未完成：
  - `R9` 完成不代表 `contract_runner` 已具备完整 baseline diff / breaking-change 分类；这些属于下一阶段的版本化 benchmark 与治理增强
  - 当前 `contract_runner` 的 OpenAPI 校验仍只覆盖单文件基础结构，不处理多文件 `$ref` 和更细的 schema 兼容性分析
  - `repo_test_runner` 与 `contract_runner` 的 preset 体系仍是静态 repo-owned manifest，不提供运行时管理入口
- 下一步：
  - 进入 `R10`，优先把当前多 runner 执行能力接到版本化评测集、冻结样本和回放对比机制，避免后续优化缺少稳定 benchmark

## 2026-03-31 第七十次更新（R10 第一刀：R10 close-out）

- 本轮目标：
  - 把当前 `evaluationBaseline` 从“近期 run 的临时洞察”收口成项目级、版本化 benchmark suite
  - 补齐 benchmark 的冻结、回放、比较与报告输出最小闭环，并回写阶段状态
- 已完成：
  - 新增 `lib/intent-e2e-benchmark.ts`，复用 `lib/ai/intent-e2e-insights.ts` 的 canonical baseline 聚合，支持按 `project / module / testType / runnerType` 过滤生成 `IntentE2EBenchmarkSuite`
  - benchmark 现已落到项目级资产文件：主文件 `intent-e2e.benchmark.json`、版本归档目录 `intent-e2e.benchmarks/*`、对比报告目录 `intent-e2e.benchmark-reports/*`；suite 会稳定记录 `releaseCandidate / selectedEvalCaseIds / frozenMetrics / representativeRunIds`
  - 已补 `replay / compare` 机制：基于冻结 case 的 `snapshotSignature` 回放当前 terminal runs，输出 `improved / unchanged / regressed / missing` 结论和指标 delta；`tests/unit/intent-e2e-benchmark.spec.ts` 与 `tests/unit/intent-e2e-insights.spec.ts` 已补对应覆盖
  - 已更新本文件顶部阶段状态，`R10` 正式切为已完成；后续新增治理能力应进入 `R11`
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-e2e-benchmark.spec.ts`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10`：已完成（第一刀已完成：R10 close-out）
  - `R11-R14`：待开始
- 风险 / 未完成：
  - 当前 replay / compare 依赖已有 terminal run snapshots，不主动触发 benchmark re-execution；主动调度与队列治理属于后续 `R13/R14`
  - benchmark 当前只落项目级 JSON 资产与 compare report，没有额外 HTTP / workbench 管理入口
  - `contract_runner` 仍只具备最小 OpenAPI 基础校验；更细的 contract diff / gate 规则属于后续 `R11/R14`
- 下一步：
  - 进入 `R11`，优先把当前已冻结的 benchmark 结果接到服务端 rollout / merge gate，避免 compare report 仍停留在被动参考层

## 2026-03-31 第七十一次更新（R11 第一刀：merge rollout gate）

- 本轮目标：
  - 把当前 `rolloutStrategy` 从洞察建议接到现有 `project knowledge merge` 服务端门禁
  - 复用 `R10` 已冻结的 benchmark 资产与现有审计链，先收口一条最小可验证的强约束路径
- 已完成：
  - 新增 `lib/intent-e2e-rollout-policy.ts`，提供项目级 rollout policy 解析、默认 `hold / small_batch / full_release` 判定规则，以及统一的 decision normalize / evaluate helper
  - `app/api/intent-e2e/project-knowledge/merge/route.ts` 现已解析 `rolloutOverride / rolloutOverrideReason / rolloutCanaryAcknowledged / rolloutCanaryLabel`，基于 `insights.rolloutStrategy` 在合并前执行服务端 gate；命中阻断时返回 `409`，并把 `rolloutPolicyDecision` 写回响应、audit meta 与 project activity
  - `lib/intent-project-knowledge.ts` 已补 `rolloutPolicyDecision` 审计元数据归一化与文本摘要；`tests/unit/intent-e2e-rollout-policy.spec.ts`、`tests/unit/api-intent-project-knowledge-merge-route.spec.ts` 已覆盖 `hold` 阻断、`small_batch` 明示 canary 放行和审计回执链
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/intent-e2e-rollout-policy.spec.ts tests/unit/api-intent-project-knowledge-merge-route.spec.ts tests/unit/intent-project-knowledge.spec.ts`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10`：已完成（第一刀已完成：R10 close-out）
  - `R11`：进行中（第一刀已完成：merge rollout gate）
  - `R12-R14`：待开始
- 风险 / 未完成：
  - 本轮只把 rollout gate 接到现有 `project knowledge merge` 路径，真实灰度配额扩大、自动降级和 rollback 执行链还未展开
  - `full_release` 目前只校验项目 benchmark 资产存在且可读取，还没有接更细的 compare delta / regression gate
  - 当前没有专门的 integration spec 覆盖该 merge route，本轮验证仍以单测和构建为主
- 下一步：
  - 继续推进 `R11` 下一刀，优先把同一份 rollout policy 接到 merge 之外的推广 / 放量入口，避免服务端门禁只守住单一路径

## 2026-04-01 第七十二次更新（R11 第二刀：R11 close-out）

- 本轮目标：
  - 把同一份 rollout policy 接到 merge 之外的真实推广 / 放量入口
  - 在不扩 capability / UI 大改的前提下，收口 `R11` 的服务端强门禁最小闭环
- 已完成：
  - `lib/intent-e2e-rollout-policy.ts` 已补 action / subject 文案上下文，`project knowledge merge` 与 `recipe governance apply` 现在可复用同一套 `hold / small_batch / full_release` 服务端判定，而不会把 recipe apply 错写成“合并规则”
  - `lib/intent-project-recipe-governance.ts` 已新增 governance patch 匹配与 rollout evaluation helper；只有当请求 patch 精确命中当前可应用的 governance recommendation 时，才进入 rollout gate，普通 recipe 文案更新不受影响
  - `app/api/projects/[projectUid]/intent-recipes/route.ts` 现已对 rollout-sensitive recipe update 解析 `rolloutOverride / rolloutOverrideReason / rolloutCanaryAcknowledged / rolloutCanaryLabel`；命中阻断时返回 `409`，放行时返回 `governanceDecision / rolloutPolicyDecision / rolloutWarning`
  - `tests/unit/intent-e2e-rollout-policy.spec.ts`、`tests/unit/intent-project-recipe-governance.spec.ts`、`tests/unit/api-project-intent-recipes-route.spec.ts` 已覆盖 governance apply 的 `hold` 阻断、`small_batch` canary 放行，以及 rollout helper 的入口无关文案
  - 已更新本文件顶部阶段状态，`R11` 正式切为已完成；后续治理主线进入 `R12`
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/intent-e2e-rollout-policy.spec.ts tests/unit/intent-project-recipe-governance.spec.ts tests/unit/api-project-intent-recipes-route.spec.ts`
  - `npm run test:integration`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10`：已完成（第一刀已完成：R10 close-out）
  - `R11`：已完成（第二刀已完成：R11 close-out）
  - `R12-R14`：待开始
- 风险 / 未完成：
  - `npm run test:integration` 当前仍有 2 条与本轮改动无关的既有失败：`tests/integration/scenario-task-api.spec.ts` 与 `tests/integration/project-read-access-api.spec.ts` 的平台查询断言仍未吸收新增 `verificationPolicyNotes` 字段
  - 当前 `recipe governance apply` 已具备服务端 override / canary gate，但前端仍只消费通用错误提示，未单独提供二次确认交互
  - rollout gate 的 `full_release` 仍以“项目 benchmark 已绑定”作为最小强约束，没有继续细化 compare delta / regression budget
- 下一步：
  - 进入 `R12`，优先把环境 profile、账号/会话与测试数据治理从当前运行链路里显式抽出来，避免 rollout 与 benchmark 已收口后仍被环境资产漂移拖垮

## 2026-04-01 第七十三次更新（R12 第一刀：runtime governance contract）

- 本轮目标：
  - 把环境 profile、凭证引用与 fixture/idempotency contract 从当前运行请求里显式抽出来
  - 先收一条最小服务端治理链：请求归一化、project auth 追踪、运行阻断、workspace 导入保护
- 已完成：
  - 新增 `lib/intent-e2e-runtime-governance.ts`，统一收口 `environmentProfile`（`dev / test / uat / staging`）、`credential.{source, secretRef, accountRef, sessionMode}`、`fixture.{strategy, setupRef, cleanupRef, owner, idempotencyKey}` 的 normalize / merge / validate helper
  - `lib/ai/intent-e2e-request.ts` 已接入 `runtimeGovernance` 请求归一化；`lib/server/intent-e2e-project-auth.ts` 现在会在真正复用项目登录密码时补 project-backed `credential.secretRef`，但不会误覆盖用户显式 password override
  - `lib/ai/intent-e2e-service.ts` 已在 page precheck 前增加 runtime governance blocker：显式治理请求若缺少 `environmentProfile`、凭证引用，或 mutating flow 缺少 `fixture` / `idempotency` contract，会直接终止运行而不是继续消耗 precheck / analyze / repair 配额
  - `app/api/intent-e2e/route.ts` 现已与 `/api/intent-e2e/runs`、`/api/intent-e2e/stream` 对齐，统一走 shared LLM merge + project auth resolution；`lib/ai/intent-e2e-run-registry.ts` 会在 run request summary 里保留 `runtimeGovernance`
  - `lib/services/intent-e2e-workspace-service.ts` 现在会识别 project-backed credential run，不再把项目凭证复制成任务级 legacy auth；README 已同步补充运行入口与 `runtimeGovernance` 口径
  - 新增 / 更新单测：`tests/unit/intent-e2e-request.spec.ts`、`tests/unit/intent-e2e-project-auth.spec.ts`、`tests/unit/intent-e2e-service.spec.ts`、`tests/unit/intent-e2e-workspace-service.spec.ts`、`tests/unit/api-intent-e2e-route.spec.ts`、`tests/unit/intent-e2e-run-registry.spec.ts`
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/intent-e2e-request.spec.ts tests/unit/intent-e2e-project-auth.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/api-intent-e2e-route.spec.ts tests/unit/api-intent-e2e-runs-route.spec.ts tests/unit/api-intent-e2e-stream-route.spec.ts tests/unit/intent-e2e-run-registry.spec.ts`
  - `npm run test:integration`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10`：已完成（第一刀已完成：R10 close-out）
  - `R11`：已完成（第二刀已完成：R11 close-out）
  - `R12`：进行中（第一刀已完成：runtime governance contract）
  - `R13-R14`：待开始
- 风险 / 未完成：
  - 本轮只补最小 runtime governance contract 与 blocker，不包含完整账号池、secret manager、fixture orchestration 或回收执行器
  - `npm run test:integration` 当前仍有 2 条与本轮改动无关的既有失败：`tests/integration/scenario-task-api.spec.ts` 与 `tests/integration/project-read-access-api.spec.ts` 的平台查询断言还没有吸收 `verificationPolicyNotes`
  - 现在只有显式提供 `runtimeGovernance` 的请求才会命中新的治理阻断；旧请求仍保持兼容，后续还需要把默认环境画像和更完整的账号/会话治理接到项目接入链
  - workspace 导入当前默认保护 project-backed credential，不提供单独“强制复制为 task auth”的 override
- 下一步：
  - 继续推进 `R12` 第二刀，优先把 environment profile / fixture strategy 进一步接到项目接入 manifest 与 workspace 导入入口，减少靠调用方手填治理字段的比例

## 2026-04-01 第七十四次更新（R12 第二刀：project governance defaults）

- 本轮目标：
  - 把默认 `environmentProfile / fixture strategy` 接到项目接入 manifest，减少调用方手填
  - 把治理摘要带进 workspace 导入上下文，保证后续脚本版本和执行历史可追踪
- 已完成：
  - 新增 `lib/intent-project-runtime-governance.ts`，定义项目级 runtime governance manifest 默认路径 `reports/intent-e2e/projects/<projectUid>/intent-e2e.project-runtime-governance.json`，并提供读取、归一化与默认值 merge helper
  - `lib/server/intent-e2e-project-auth.ts` 现在会在项目上下文里先合并 project governance defaults，再根据实际登录密码是否来自项目 auth 追加 project-backed `credential.secretRef`；因此项目默认 `environmentProfile / accountRef / sessionMode / fixture` 可以自动进入三条运行入口，而不需要调用方每次显式带上
  - `lib/services/intent-e2e-workspace-service.ts` 已把 `runtimeGovernance` 摘要写进 imported plan prompt、execution artifact meta 和 project activity meta；导入后的脚本版本和执行历史现在能回溯本次环境 / 凭证 / 数据治理上下文
  - `README.md` 已补充 project runtime governance manifest 路径、默认合并规则，以及 workspace 导入会保留治理摘要的行为说明
  - 新增 / 更新单测：`tests/unit/intent-project-runtime-governance.spec.ts`、`tests/unit/intent-e2e-project-auth.spec.ts`、`tests/unit/intent-e2e-workspace-service.spec.ts`
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/intent-project-runtime-governance.spec.ts tests/unit/intent-e2e-project-auth.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10`：已完成（第一刀已完成：R10 close-out）
  - `R11`：已完成（第二刀已完成：R11 close-out）
  - `R12`：进行中（第二刀已完成：project governance defaults）
  - `R13-R14`：待开始
- 风险 / 未完成：
  - 当前 project governance manifest 只支持文件读取与默认 merge，还没有写接口、UI 配置页或接入校验面板
  - 本轮没有新增 secret manager、账号池调度或 fixture 执行器；manifest 目前只负责声明与透传，不负责真实密钥解析和数据回收执行
  - runtime governance 默认值只有在 `projectUid` 存在且 manifest 文件可读取时才会生效；没有项目上下文的旧调用仍保持兼容
- 下一步：
  - 继续推进 `R12` 下一刀，优先把项目级治理 manifest 的校验与接入反馈补到项目接入链，避免 manifest 缺失或字段失配时只能等到 run blocker 才暴露

## 2026-04-01 第七十五次更新（R12 第三刀：project governance feedback）

- 本轮目标：
  - 给 project runtime governance manifest 增加最小校验状态，区分 `missing / invalid / incomplete / ready`
  - 把治理校验反馈补到现有 `insights -> workbench` 链，做到不发起 run 也能先看见接入缺口
- 已完成：
  - `lib/intent-project-runtime-governance.ts` 已扩展 project runtime governance status contract；现在会稳定返回 `ready`、`hasEnvironmentProfile / hasCredentialDefaults / hasFixtureDefaults` 和 issue 列表，并前置识别 `manifest_missing / manifest_invalid / shared_account_ref_missing / fixture_*` 等项目级失配
  - `lib/ai/intent-e2e-insights.ts` 现会在 `projectUid` 作用域下读取该 status，并把精简后的 `runtimeGovernanceStatus` 挂进 `GET /api/intent-e2e/insights` 返回，不把 manifest 内容直接混到 run snapshot
  - `components/IntentE2EWorkbench.tsx` 的治理舱 overview 已新增“项目治理接入”卡片；选中项目后，即使还没发起 run，也能直接看到 manifest 路径、coverage 摘要和缺失字段反馈
  - `README.md` 已补充 `runtimeGovernanceStatus` 行为说明；新增 / 更新单测：`tests/unit/intent-project-runtime-governance.spec.ts`、`tests/unit/intent-e2e-insights.spec.ts`
- 验证：
  - `npm run build`
  - `npm run build:web`
  - `npx vitest run tests/unit/intent-project-runtime-governance.spec.ts tests/unit/intent-e2e-insights.spec.ts`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10`：已完成（第一刀已完成：R10 close-out）
  - `R11`：已完成（第二刀已完成：R11 close-out）
  - `R12`：进行中（第三刀已完成：project governance feedback）
  - `R13-R14`：待开始
- 风险 / 未完成：
  - 本轮只补只读校验反馈，不新增 project runtime governance manifest 写接口，也不补独立配置页
  - project runtime governance 目前仍是静态声明；没有引入真实账号池调度、secret manager 或 fixture orchestration
  - `npm run test:integration` 当前仍有 2 条与本轮无关的既有失败：`tests/integration/scenario-task-api.spec.ts` 与 `tests/integration/project-read-access-api.spec.ts` 的平台查询断言还没有吸收 `verificationPolicyNotes`
- 下一步：
  - 继续推进 `R12` 下一刀，优先把项目级 `accountRef / sessionMode` 与 fixture ownership contract 进一步接到现有 project auth / workspace import 链路，减少共享账号和数据归属仍停留在静态字符串声明

## 2026-04-01 第七十六次更新（R12 第四刀：ownership derivation + close-out）

- 本轮目标：
  - 把 project-backed credential 与 fixture ownership 的缺失字段接到项目上下文派生逻辑里
  - 在不新增 schema 的前提下，让这批派生后的治理字段继续沿现有 workspace import 链路沉淀
- 已完成：
  - `lib/intent-e2e-runtime-governance.ts` 新增 project ownership ref builder：当前支持派生 `account://project/<projectUid>/<loginUsername>` 和 `owner://project/<projectUid>/members/<actorUserUid>`
  - `lib/server/intent-e2e-project-auth.ts` 现在会在真正复用项目内置登录凭证时补默认 `credential.accountRef / sessionMode=shared`；若项目上下文里的 fixture contract 缺少 `owner`，也会基于当前 actor 自动补齐稳定 owner ref
  - 这批派生字段会直接进入已有 `runtimeGovernance` 对象，因此现有 workspace import 的 prompt / artifact / activity meta 持久化链无需新增 contract 也能继续追踪共享账号与数据归属
  - `README.md` 已补充 project auth ownership derivation 行为说明；新增 / 更新单测：`tests/unit/intent-e2e-project-auth.spec.ts`
- 验证：
  - `npm run build`
  - `npx vitest run tests/unit/intent-e2e-project-auth.spec.ts`
  - `npx vitest run tests/unit/intent-e2e-workspace-service.spec.ts`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10`：已完成（第一刀已完成：R10 close-out）
  - `R11`：已完成（第二刀已完成：R11 close-out）
  - `R12`：已完成（第四刀已完成：ownership derivation + close-out）
  - `R13-R14`：待开始
- 风险 / 未完成：
  - 当前 `R12` 收口的是“受控 ref + blocker + defaults + feedback + provenance”最小闭环，不包含外部 secret manager、真实账号池调度器或 fixture orchestration worker
  - `npm run test:integration` 仍保留 2 条与本轮无关的既有失败：`tests/integration/scenario-task-api.spec.ts` 与 `tests/integration/project-read-access-api.spec.ts` 的平台查询断言还没有吸收 `verificationPolicyNotes`
- 下一步：
  - 进入 `R13`，优先把并发配额、取消 / replay、artifact index 与 flaky 标记收成统一任务平台能力

## 2026-04-01 第七十七次更新（R13 第一刀：R13 close-out）

- 本轮目标：
  - 把异步 `intent-e2e` run registry 从“单个任务可跑”收口成最小可运营的任务平台
  - 一次性补齐 `runControl`、并发配额 / 队列、取消 / retry / replay、flaky 标记与 artifact archive/index
- 已完成：
  - 新增 `runControl` contract：`priority / timeoutMs / retryLimit / replayOfRunId` 已接入 `lib/ai/intent-e2e-request.ts` 与 `POST /api/intent-e2e/runs` 请求归一化；当前默认全局并发 `2`、项目并发 `1`，并支持 `INTENT_E2E_MAX_CONCURRENT_RUNS / INTENT_E2E_PROJECT_MAX_CONCURRENT_RUNS` 环境变量覆盖
  - `lib/ai/intent-e2e-run-registry.ts` 现已补 queued scheduler：并发配额命中时 run 会进入 `stage=queued`，同项目同签名请求会被串行化隔离；queued / running run 都可取消，终态快照会稳定保留 `taskPlatform` 元数据（`priority / timeoutMs / retryCount / replay / flaky`）
  - run registry 现已增加最小可靠性策略：`retryLimit` 只对 `env_blocked` 或暂态 timeout / network error 触发整轮 retry，且会缓冲第一次失败的 `completed/final_result`，避免 retry 时终态事件提前落库；`replayOfRunId` 会把 rerun 与 baseline 关联，并在终态分歧时把 replay pair 双向标成 `replay_outcome_changed`
  - 新增 `lib/intent-e2e-run-artifacts.ts`；`lib/ai/intent-e2e-service.ts` 现会把初始页面截图、repair 观察截图、attempt trace、attempt logs、response summary 与 runner artifacts 统一归档到 `reports/intent-e2e/runs/<runId>/`，并把 `artifactIndex` 挂回终态 run result
  - `components/IntentE2EWorkbench.tsx` 已接收 `queued` 阶段；README 已同步补 run platform / artifact index / 环境变量说明；R13 阶段状态正式切为已完成
- 验证：
  - `npm run build`
  - `npm run build:web`
  - `npx vitest run tests/unit/intent-e2e-request.spec.ts tests/unit/intent-e2e-run-registry.spec.ts tests/unit/intent-e2e-run-artifacts.spec.ts tests/unit/api-intent-e2e-runs-route.spec.ts tests/unit/api-intent-e2e-run-route.spec.ts tests/unit/api-intent-e2e-run-stream-get-route.spec.ts`
  - `npm run test:e2e`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10`：已完成（第一刀已完成：R10 close-out）
  - `R11`：已完成（第二刀已完成：R11 close-out）
  - `R12`：已完成（第四刀已完成：ownership derivation + close-out）
  - `R13`：已完成（第一刀已完成：R13 close-out）
  - `R14`：待开始
- 风险 / 未完成：
  - 当前 replay 先收口为“显式 linkage + flaky trace”；不做跨重启自动克隆旧请求，因此没有新增 replay 专用 route
  - artifact 平台当前先提供 archive path + index，不额外新增下载 / 浏览 API；后续若要给 CI/CD 或外部系统消费，需要在 `R14` 里补统一报告出口
  - 本轮仍未处理与当前任务无关的既有 integration 失败：`tests/integration/scenario-task-api.spec.ts` 与 `tests/integration/project-read-access-api.spec.ts` 的平台查询断言还没有吸收 `verificationPolicyNotes`
- 下一步：
  - 进入 `R14`，优先把当前 `taskPlatform + artifactIndex + benchmark / rollout` 能力接到 CI/CD gate、定时回归和新系统接入 manifest，避免平台能力继续停留在工作台内使用

## 2026-04-01 第七十八次更新（R14 第一刀：R14 close-out）

- 本轮目标：
  - 把 `R13` 已收口的 `taskPlatform + artifactIndex + benchmark / rollout` 能力接成可直接给 CI/CD 消费的最小 contract
  - 一次性补齐 repo-owned onboarding manifest、运行入口接线和统一 `ciReport`
- 已完成：
  - 新增 repo-owned system onboarding manifest registry：`intent-e2e.system-onboarding-manifests.json` 与 `lib/intent-e2e-system-onboarding.ts` 已收口 `systemProfile / testType / envProfile / credentialReference / fixtureStrategy / benchmarkBinding`，并内置 1 个非当前系统样板 `vendor_portal_staging`
  - `lib/ai/intent-e2e-request.ts`、`POST /api/intent-e2e` 与 `POST /api/intent-e2e/runs` 现已支持 `onboardingManifestId` 与 `cicdProfile`；入口会在 project auth 之后统一解析 manifest 默认值，把 `targetUrl / runtimeGovernance / systemOnboarding` 固定进标准请求对象
  - 新增 `lib/intent-e2e-cicd-report.ts`：当前统一产出 `passFail / gate / benchmarkCompare / rollbackRecommendation / artifacts` 五段式 `ciReport`；同步直跑入口会直接返回该对象，异步 run registry 也会在终态前挂回 `result.ciReport` 并随 snapshot 落库
  - `tests/unit/intent-e2e-system-onboarding.spec.ts`、`tests/unit/intent-e2e-cicd-report.spec.ts` 以及相关 route / registry / request 单测已补齐；`README.md` 现已同步更新 request / response contract 与 onboarding + CI/CD 说明
- 验证：
  - `npm run build`
  - `npm run build:web`
  - `npm run db:init`
  - `npm run test:integration`（仍保留 2 条与本轮无关的既有失败：`tests/integration/scenario-task-api.spec.ts` 与 `tests/integration/project-read-access-api.spec.ts` 的断言尚未吸收 `verificationPolicyNotes`）
  - `npx vitest run tests/unit/intent-e2e-request.spec.ts tests/unit/intent-e2e-system-onboarding.spec.ts tests/unit/intent-e2e-cicd-report.spec.ts tests/unit/intent-e2e-run-registry.spec.ts tests/unit/api-intent-e2e-route.spec.ts tests/unit/api-intent-e2e-runs-route.spec.ts tests/unit/api-intent-e2e-run-route.spec.ts`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10`：已完成（第一刀已完成：R10 close-out）
  - `R11`：已完成（第二刀已完成：R11 close-out）
  - `R12`：已完成（第四刀已完成：ownership derivation + close-out）
  - `R13`：已完成（第一刀已完成：R13 close-out）
  - `R14`：已完成（第一刀已完成：R14 close-out）
- 风险 / 未完成：
  - 当前 `ciReport` 先走 route / snapshot contract，不额外新增独立 report 下载 API，也还没有 workbench 可视化面板
  - onboarding manifest 当前先收口为 repo-owned registry + 默认值注入，不引入 DB schema、独立配置页或外部 secret manager
  - 仓库里仍有 2 条与本轮无关的既有 integration 失败：`tests/integration/scenario-task-api.spec.ts` 与 `tests/integration/project-read-access-api.spec.ts`
- 下一步：
  - `R7.5-R14` 主线已收口；后续若继续推进平台运营、外部下载接口或更多系统模板，应另起 post-R14 专题，不再往本文件继续塞并行主线

## 2026-04-01 第七十九次更新（post-R14：runtime governance compatibility fix）

- 本轮目标：
  - 修复 `R12 ownership derivation` 带来的兼容性回归，避免没有项目治理默认值的旧控制台 run 被 runtime governance blocker 提前拦截
- 已完成：
  - `lib/server/intent-e2e-project-auth.ts` 现已收口 project-backed credential ownership derivation 触发条件：只有请求本身已进入治理上下文时，才补默认 `credential.accountRef / sessionMode=shared`
  - 没有 project runtime governance defaults 的旧项目请求，现在只会保留 `credential.source=project + secretRef`，继续复用项目内置登录凭证，但不会被误升级成强制治理 blocker
  - `tests/unit/intent-e2e-project-auth.spec.ts` 已补回归断言，锁住“legacy project run 仍兼容、显式治理/项目默认值仍保留 ownership derivation”的双边语义
- 验证：
  - `npx vitest run tests/unit/intent-e2e-project-auth.spec.ts`
  - `npm run build`（当前工作区失败，错误落在现有 `.next/dev/types/routes.d.ts` 生成物损坏，不是本轮源码类型错误）
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10`：已完成（第一刀已完成：R10 close-out）
  - `R11`：已完成（第二刀已完成：R11 close-out）
  - `R12`：已完成（第四刀已完成：ownership derivation + close-out）
  - `R13`：已完成（第一刀已完成：R13 close-out）
  - `R14`：已完成（第一刀已完成：R14 close-out）
- 风险 / 未完成：
  - 本轮只修兼容性回归，不新增 project runtime governance manifest 写入口，也不调整治理 blocker 的 triage 分类文案
  - 当前工作区仍存在 `.next/dev/types/routes.d.ts` 生成物损坏，导致 `npm run build` 无法作为稳定信号，需要单独清理 dev 产物后再复验
- 下一步：
  - 保持 post-R14 以最小 bugfix 收口；若继续推进治理配置体验或 blocker 分类语义，再另起独立切片

## 2026-04-01 第八十次更新（post-R14：status evidence fallback false negative fix）

- 本轮目标：
  - 修复“业务已跑通但 verifier 仍报 `状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口`”的 post-R14 假阴性
  - 只收口 row 已命中后的 `detailUrl` 回退链，不扩展 route contract、DB schema 或 workbench 展示语义
- 已完成：
  - `lib/intent-execution-plan.ts` 与 `lib/intent-execution-compiler.ts` 现已统一补齐状态字段默认 JSON path，默认覆盖 `progress.displayStatus`
  - `lib/intent-execution-compiler.ts` 现已在 row 已命中但主键共享变量为空时，优先从 `row.getAttribute('data-row-key')` 回填稳定主键；若仍为空，再保守回退到行文本中的数字主键痕迹
  - 当 `detailUrl` 可用且 row 已命中时，编译器现在会把上面的 `DerivedPrimaryValue` 接进详情页回退链，避免在业务已成功创建 / 列表已命中的情况下提前误报 `assertion_too_strict`
  - `tests/unit/intent-execution-plan.spec.ts` 与 `tests/unit/intent-execution-compiler.spec.ts` 已补回归，锁住嵌套状态 path 与 `data-row-key -> detailUrl fallback` 语义
- 验证：
  - `npx vitest run tests/unit/intent-execution-plan.spec.ts tests/unit/intent-execution-compiler.spec.ts`
  - `npm run build`（当前工作区失败，错误仍落在既有 `.next/dev/types/routes.d.ts` 生成物损坏，不是本轮源码类型错误）
  - `node scripts/check-roadmap-progress.mjs`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10`：已完成（第一刀已完成：R10 close-out）
  - `R11`：已完成（第二刀已完成：R11 close-out）
  - `R12`：已完成（第四刀已完成：ownership derivation + close-out）
  - `R13`：已完成（第一刀已完成：R13 close-out）
  - `R14`：已完成（第一刀已完成：R14 close-out）
- 风险 / 未完成：
  - 本轮只收口“row 已命中但主键缺失时的详情回退误判”，不补业务专属列表响应识别，也不调整 attempt feed 的前端呈现语义
  - 当前工作区仍存在 `.next/dev/types/routes.d.ts` 生成物损坏，导致 `npm run build` 无法作为稳定信号，需要单独清理 dev 产物后再复验
- 下一步：
  - 继续保持 post-R14 以最小 bugfix 收口；若后续还要处理 attempt feed 展示或更宽的列表记录识别，再另起独立切片

## 2026-04-01 第八十一次更新（post-R14：repair prompt status-evidence alignment）

- 本轮目标：
  - 修复真实 run 仍沿旧 repair prompt 生成 `rowText-only derivedBusinessId / 状态-only detail read / 旧 status paths` 的问题
  - 让 post-R14 的状态证据收口不只停留在 compiler 骨架，也覆盖真实仍在生效的 slot repair 链
- 已完成：
  - `lib/test-generator.ts` 现已把商机列表状态证据 repair guidance 统一升级为：
    - 状态 paths 至少覆盖 `progress.displayStatus`
    - row 已命中时先尝试 `data-row-key`，再回退行文本里的数字主键
    - 商机详情状态字段优先尝试 `商机进展`，再回退通用 `状态`
    - 如果 recent events 已显示脚本进入过 `/business/detail/:id` 或详情字段读取失败，不再把这条链误收口成“未提供详情入口”
  - `lib/intent-action-library.ts` 已同步更新 `assert.resolve-primary-record` 能力说明与示例，避免首轮 generate 继续教模型写旧骨架
  - `tests/unit/test-generator.spec.ts` 与 `tests/unit/intent-action-library.spec.ts` 已补回归，锁住 `data-row-key + progress.displayStatus + 商机进展/状态` 这组修复语义
- 验证：
  - `npx vitest run tests/unit/test-generator.spec.ts tests/unit/intent-action-library.spec.ts`
  - `npm run build`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10`：已完成（第一刀已完成：R10 close-out）
  - `R11`：已完成（第二刀已完成：R11 close-out）
  - `R12`：已完成（第四刀已完成：ownership derivation + close-out）
  - `R13`：已完成（第一刀已完成：R13 close-out）
  - `R14`：已完成（第一刀已完成：R14 close-out）
- 风险 / 未完成：
  - 当前修的是商机创建 family 的状态证据误判，不扩到其他业务详情 label 映射
  - 已失败的旧 run 不会被就地修复；需要基于新 prompt 重新发起 run 才能验证
- 下一步：
  - 直接重跑同一业务流，确认新的 repair/generate 链不再回落到旧的状态证据骨架

## 2026-04-01 第八十二次更新（post-R14：split-search elimination + list-json fallback）

- 本轮目标：
  - 继续只收 post-R14 商机列表状态证据假阴性，不扩到 route contract、DB schema 或更宽的 runtime helper 重构
  - 修掉真实 run 剩余两条窄出口：
    - `Step 5` 先手写一次 `fill + 搜索`，`Step 6 / Verification` 又继续第二次检索
    - row 已命中、`derivedBusinessId` 已可得时，repair 仍直接跳详情页，导致详情页自身 `null.forEach` 时丢失本可从列表 JSON 回填出的状态证据
- 已完成：
  - `lib/test-generator.ts`
    - generate / repair guidance 现已明确：
      - 若前一个 UI step 已经把列表响应缓存到 `artifacts['plan_step_5']`，后续 `Step 6 / Verification` 不得再对同一主值第二次 `fill + 搜索`
      - row 已命中且 `derivedBusinessId / resolvedBusinessId` 可得时，优先在同一份 `listJson` 上补 `pickJsonRecord(..., { paths: ['businessId', 'id'] })` 这条主键回填，再决定是否开详情
    - repair diagnosis 新增两条定向提示：
      - “手动 search step + 后续 helper/verification 再 search”的 split-search 收口
      - `json record not found -> /business/detail/:id -> null.forEach` 时先走 `derivedBusinessId -> listJson` 回填
  - `lib/intent-action-library.ts`
    - `assert.resolve-primary-record` 能力说明与示例已同步对齐：
      - 前一步若只负责切视角 / 缓存列表响应，后一步不得再二次检索
      - `matchedRecordByResolvedBusinessId` 作为 row-key 派生主键后的列表 JSON fallback
  - `lib/intent-execution-compiler.ts`
    - 对 `switchBusinessListOwnershipView` 步骤指令补一条显式约束：
      - 如果后续 assert / verification 已会用 `__e2e.resolvePrimaryRecord(...)` 做回查，当前步骤只做切视角 + 列表 ready，不再手写第二条检索链
  - 回归测试已补齐：
    - `tests/unit/test-generator.spec.ts`
    - `tests/unit/intent-action-library.spec.ts`
    - `tests/unit/intent-execution-compiler.spec.ts`
- 验证：
  - `npx vitest run tests/unit/test-generator.spec.ts tests/unit/intent-action-library.spec.ts tests/unit/intent-execution-compiler.spec.ts`
  - `npm run build`
  - live rerun：`intent-run-f5c46da7-2409-4e94-8394-817162acfb47`
    - 本次未进入 generate / repair，前置检查即被环境阻塞：
      - `页面前置检查失败: 目标页面当前处于环境异常或服务不可用状态。`
    - 因此这次 rerun 不能作为本轮代码修复是否生效的信号
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10`：已完成（第一刀已完成：R10 close-out）
  - `R11`：已完成（第二刀已完成：R11 close-out）
  - `R12`：已完成（第四刀已完成：ownership derivation + close-out）
  - `R13`：已完成（第一刀已完成：R13 close-out）
  - `R14`：已完成（第一刀已完成：R14 close-out）
- 风险 / 未完成：
  - 本轮仍属于 prompt / compiler instruction / capability example 的最小 bugfix，不新增 runtime response classifier，也不改 attempt feed 展示
  - 已失败的历史 run 不会被就地修复；当前新的 live rerun 又被环境 precheck 挡住，仍需待环境恢复后再验证 generate / repair 的真实落地行为
- 下一步：
  - 直接重跑同一业务流，优先检查两点：
    - `Step 5` 是否已收口成“切视角 + ready”，不再和 `Step 6 / Verification` 形成 split-search
    - row 已命中且 `derivedBusinessId` 可得时，是否会先走 `listJson -> matchedRecordByDerivedBusinessId -> status`，而不是立即重开不稳定详情页

## 2026-04-01 第八十三次更新（post-R14：compiler fallback instruction alignment）

- 本轮目标：
  - 继续只收 post-R14 商机列表状态证据假阴性，不扩到 runtime helper、route contract 或更宽的 verifier 语义调整
  - 修掉真实 run `intent-run-4b88c42b-c57d-44c9-b9c9-db8bafbc8c27` 暴露的剩余旧出口：
    - generate 产出的 `plan_step_5` 仍只写到 `statusEvidenceRecordCheck`
    - 当 `matchedRecord` 按手机号未命中时，会直接回落到 `状态证据缺失：列表行已命中，但列表响应未返回状态`
- 已完成：
  - `lib/intent-execution-compiler.ts`
    - 对“手机号 / 联系人 fallback shared variable + resolvePrimaryRecord”这条 compiler 指令补强：
      - row 已命中、列表响应已返回但手机号未命中时，先做 `data-row-key / rowText -> derivedBusinessId`
      - 再优先在同一份 `listJson` 上补 `matchedRecordByDerivedBusinessId`
      - 只有结构化列表 JSON 回填仍失败时，才继续 `detailUrl / detailEntry` fallback
    - verification hint 同步对齐，避免 `Verification` slot 继续自由回退到旧骨架
  - `tests/unit/intent-execution-compiler.spec.ts`
    - 已补回归，锁住 compiler 模板中必须出现：
      - `recordCheck.row.getAttribute('data-row-key')`
      - `matchedRecordByDerivedBusinessId`
      - `matchedRecord || matchedRecordByDerivedBusinessId`
- 验证：
  - `npx vitest run tests/unit/intent-execution-compiler.spec.ts`
  - `npm run build`
- 当前阶段状态：
  - `R7.5`：已完成（多项目冷启动与资产隔离已收口）
  - `R8`：已完成（第六十刀已完成：R8 close-out）
  - `R9`：已完成（第九刀已完成：R9 close-out）
  - `R10`：已完成（第一刀已完成：R10 close-out）
  - `R11`：已完成（第二刀已完成：R11 close-out）
  - `R12`：已完成（第四刀已完成：ownership derivation + close-out）
  - `R13`：已完成（第一刀已完成：R13 close-out）
  - `R14`：已完成（第一刀已完成：R14 close-out）
- 风险 / 未完成：
  - 本轮仍是 compiler instruction 层的最小补丁；不会就地修复已经生成失败的历史 run
  - 需要基于新代码重新发起 run，才能验证 generate / repair 是否不再落回旧 `plan_step_5` 骨架
- 下一步：
  - 直接重跑同一业务流，优先检查：
    - generate 产出的 `plan_step_5` 是否已显式包含 `rowKey / derivedBusinessId / matchedRecordByDerivedBusinessId`
    - `Verification` slot 是否也不再回落到“手机号未命中就直接抛旧状态缺失”这条旧链
