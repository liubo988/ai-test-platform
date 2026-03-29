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
- 当前系统已经不只是 prompt 生成脚本，而是具备：
  - 结构化规划
  - 受控执行
  - 业务验收
  - 学习闭环
  - 治理与灰度建议
- 但当前系统仍然主要面向 `browser E2E`。
- 如果下一阶段目标是“接其它系统的功能测试、单元测试、接口测试，并进入生产流程”，则必须把当前能力从“单类型高成功率引擎”升级成“多测试类型、强门禁、可运营的平台”。

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
- `rolloutStrategy` 目前是统一洞察输出，不是真正接入发布链路的服务端强门禁。
- `evaluationBaseline` 已可用，但还不是“版本化、冻结、可复放”的生产级 benchmark 套件。
- 环境、账号、数据、凭证、并发、工件、CI/CD 还没有形成平台级治理。
- 对“其它系统功能测试 / 单元测试”的支持，还没有统一测试类型模型和 runner adapter。

## 下一阶段目标

下一阶段目标不是继续补单个 helper，而是把当前系统升级成：

1. `多测试类型统一平台`
2. `服务端强门禁与真实灰度放量`
3. `可冻结评测集与版本化回归`
4. `环境 / 账号 / 数据 / 凭证治理`
5. `队列 / 并发 / 工件 / flaky 管理`
6. `CI/CD 接入与多系统低成本接入`

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

- R8：统一测试类型抽象与资产模型，待开始
- R9：Runner Adapter 化与非 UI 执行主链路，待开始
- R10：版本化评测集与冻结基准，待开始
- R11：服务端强门禁与真实灰度放量，待开始
- R12：环境 / 账号 / 数据治理，待开始
- R13：调度、可靠性与工件平台，待开始
- R14：CI/CD 接入与多系统接入模板，待开始

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

下一步开发从 `R8` 开始，不再继续零散补 helper 或单条业务规则。

### R8 第一优先级

先做统一测试类型抽象与资产模型：

- 先解决“平台到底支持哪些测试类型”
- 再解决“不同测试类型怎么复用同一套 run / audit / insights”
- 最后才进入具体 runner adapter

没有这一步，后面的“接其它系统功能测试 / 单元测试”都会退化成一次次定制开发。

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
