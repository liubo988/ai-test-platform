# Intent E2E Agent 化重构蓝图（2026-03-18）

## 先说结论

当前 `intent-e2e` 的主问题，不是模型不够强，也不是单纯 prompt 不够细。

真正的问题是：系统主链路仍然偏向

`一次页面分析 -> 一次生成整段 Playwright -> 执行失败 -> 整段 repair`

这条链路对简单页面还能工作，但对复杂中后台、弹层/抽屉/iframe、弱稳定接口、数据依赖、权限差异、动态文案变化都不够稳。

如果继续沿着“再补几个 prompt、再多修几次”推进，收益会越来越低。

更合理的方向是把它重构成：

`Planner + Precheck + Skill/Template Registry + Workflow Executor + Verifier + Failure Triage`

目标不是“1 次生成完整脚本”，而是“1-2 次收敛出结构化 workflow，然后由稳定执行器跑通”。

## 当前代码里的关键限制

### 1. 运行前页面分析只有一次

- `lib/ai/intent-e2e-service.ts` 里，生成前只做一次 `analyzePage(targetUrl, input.auth)`。
- 后续 repair 仍然复用这份老 snapshot。
- 这意味着运行过程中出现的新状态，例如抽屉、二次弹窗、切页后表格、错误 toast、接口兜底页，都不会被重新感知。

### 2. 失败后还是在修“整段脚本”

- `lib/ai/intent-e2e-service.ts` 中每次失败后都会再次调用 `repairTest(...)`。
- `lib/test-generator.ts` 里 generate / repair 的主输出仍然是整段代码。
- 这会让很多本来是“局部定位失败 / 环境失败 / 数据失败”的问题，被升级成整段脚本重写。

### 3. 模板命中还是偏硬编码

- `lib/test-generator.ts` 已有 `resolveDeterministicTemplate(...)`，这一步方向是对的。
- 但它还更像少量 hardcode 命中，不是成体系的 `skill registry / capability registry`。
- 所以高频成功经验还没有真正积累成“可版本化、可复用、可统计收益”的资产。

### 4. 执行器偏脚本驱动，不够 workflow 驱动

- `lib/test-worker.mjs` 已经积累了不少稳定 helper，尤其是登录、弹层识别、日志和步骤采集。
- 但上层输入仍然主要是“整段 Playwright 脚本”。
- 这会让执行稳定性过度依赖 LLM 生成质量，而不是依赖执行器本身的确定性。

## 为什么通过率一直上不去

### A. 你在解的不是“代码生成问题”，而是“业务自动化系统问题”

复杂企业后台失败原因通常分成四类：

1. 环境波动
2. 数据前置条件不满足
3. 权限 / 登录 / 会话问题
4. 真正的脚本定位或流程编排问题

但当前链路会把其中 3/4 的问题都压缩成“repair code”。

结果就是：

- 环境异常也去修代码
- 无数据也去修代码
- 登录态失效也去修代码
- 成功信号变了也去修代码

这就是修很多轮、首轮成功率仍然不高的根因。

### B. 图片和文字目前更多参与“前期规划”，没有参与“持续执行感知”

你现在的截图 / 参考图能帮助前期理解目标，但运行时主要还是依赖 Playwright 代码和一次性 snapshot。

这意味着图片没有真正进入：

- 运行中态确认
- 弹层 / 抽屉 / toast 识别
- 成功态判定
- 失败分流

所以它提升的是“理解意图”，不是“保证执行闭环”。

### C. 你想要的是“端到端任务系统”，不是“代码一次性生成器”

用户要的不是一段脚本，而是：

- 可管理的任务
- 可复跑的流程
- 可追踪的失败原因
- 可积累的高频能力
- 可判断哪些失败不该继续自愈

当前系统已经在往这个方向走，但主心骨还没有彻底切换过来。

## 目标架构

### 1. Planner Agent

职责：

- 把用户意图转成结构化 workflow，而不是直接输出 Playwright 代码
- 明确：
  - 前置条件
  - 目标页面
  - 关键业务实体
  - 预期成功信号
  - 可复用能力

输出建议结构：

- `goal`
- `entryUrl`
- `prechecks[]`
- `workflowSteps[]`
- `assertions[]`
- `fallbackStrategies[]`
- `successSignals[]`
- `failureClasses[]`

### 2. Precheck Agent

职责：

- 先判断这次是否适合进入正式执行
- 先跑前置检查，不让明显的环境问题消耗 repair 次数

至少要做：

- 登录页 / 会话是否正常
- 关键页面能否进入
- 搜索接口是否异常
- 页面是否无权限 / 无数据
- 关键按钮或入口是否存在

输出建议：

- `ready`
- `blocked_env`
- `blocked_auth`
- `blocked_permission`
- `blocked_data`

### 3. Skill / Template Registry

职责：

- 把已经证明稳定的业务流，从 prompt 资产升级成正式能力资产
- 让系统优先“命中稳定能力”，而不是默认通用 codegen

一条 skill 至少要包含：

- `slug`
- `matchers`
- `requiredContext`
- `plannerPatch`
- `executorImpl`
- `verifierImpl`
- `knownPitfalls`
- `successRate`
- `lastVerifiedAt`

首批建议直接抽出来的 skill：

1. 统一登录
2. Antd 表格搜索
3. Antd Modal / Drawer 编辑并保存
4. 商机创建
5. 商机列表检索
6. 分佣配置搜索并编辑比例

### 4. Workflow Executor

职责：

- 接受结构化 workflow
- 用稳定 helper 执行每个步骤
- 每步都产出结构化状态，而不是只看最终 pass/fail

建议步骤粒度：

- `navigate`
- `ensure_auth`
- `wait_surface`
- `search_table`
- `open_editor`
- `fill_form`
- `submit`
- `verify_persisted_value`

### 5. Verifier

职责：

- 独立于执行动作之外做结果确认
- 不再只依赖单个 toast 或单句文案

成功信号建议至少支持并行判断：

1. toast / message
2. 抽屉或弹窗关闭
3. 表单值仍为目标值
4. 重新查询后数据命中
5. 后置页面状态变化

### 6. Failure Triage

职责：

- 失败后先分类，再决定是否 repair

建议先分成：

- `env_transient`
- `auth_failed`
- `permission_blocked`
- `data_missing`
- `selector_drift`
- `assertion_too_strict`
- `workflow_gap`

关键原则：

- `env_transient / data_missing / permission_blocked` 不应该消耗 LLM repair
- 只有 `selector_drift / assertion_too_strict / workflow_gap` 才进入 repair

## 对现有仓库最现实的改造顺序

### Phase 1：先止损，不大改模型

目标：先把“明显不该 repair 的失败”拦住。

建议直接做：

1. 在 `lib/ai/intent-e2e-service.ts` 增加失败分类器
2. 环境失败、无权限、无数据失败不再消耗 `selfHealRetries`
3. stream 结果里显式输出 `failureClass`
4. 把 `最终失败` 改成：
   - 脚本失败
   - 环境阻塞
   - 数据阻塞
   - 认证阻塞

这一步 ROI 最高。

### Phase 2：把模板升级成正式 skill registry

目标：提高首轮命中率。

建议直接做：

1. 把 `resolveDeterministicTemplate(...)` 从硬编码函数升级成 registry
2. 每个 skill 独立定义匹配条件、执行器、验证器
3. 记录每个 skill 的命中率、通过率、最近验证时间
4. 前端工作台显示“本次命中哪个 skill / 为什么命中”

这一步会比继续加 repair memory 更直接提升成功率。

### Phase 3：从“生成代码”切到“生成 workflow”

目标：把系统主输出从整段 Playwright 代码改成结构化步骤。

建议直接做：

1. 新增 workflow schema
2. Planner 先产出 workflow JSON
3. Executor 按步骤执行
4. 只有 workflow 中某个未覆盖步骤，才局部生成代码或补 helper

一旦这步完成，LLM 的职责就从“写完整脚本”降级成“规划 + 补局部”。

### Phase 4：把图片真正接入运行时

目标：让图片不只是前期理解材料。

建议直接做：

1. 运行时关键节点截图
2. 关键节点调用视觉判断：
   - 是否打开了目标弹层
   - 是否命中了目标 tab
   - 是否出现异常页
   - 是否成功保存
3. 视觉结果只作为 verifier / triage 辅助，不直接当主执行器

注意：图片适合做“确认”和“分流”，不适合直接替代稳定 DOM 操作。

## 我对你现在最建议的路线

不是继续冲“1-2 次自动生成完整可跑脚本”。

而是改成两个目标：

### 目标一

把首轮成功定义改成：

`1-2 次收敛出正确 workflow / 命中正确 skill`

### 目标二

把最终执行成功率提升交给：

- skill registry
- workflow executor
- verifier
- failure triage

也就是说：

模型负责“想清楚怎么做”。

系统负责“稳定把它做出来”。

这才是复杂后台自动化更现实的分工。

## 建议对应到当前文件

### 第一优先级

- `lib/ai/intent-e2e-service.ts`
  - 加失败分类
  - 控制哪些失败进入 repair
  - 输出结构化 triage 信息

### 第二优先级

- `lib/test-generator.ts`
  - 把模板命中抽成 registry
  - 从“整段 codegen”逐步过渡到“workflow planning”

### 第三优先级

- `lib/test-worker.mjs`
  - 抽稳定步骤 helper
  - 给 verifier / triage 暴露更多结构化事件

### 第四优先级

- `lib/page-analyzer.ts`
  - 从“一次性分析器”升级为“可在关键步骤重采样的状态感知器”

## 最后一句判断

如果你继续沿着现在这条主链路只做 prompt / repair 微调，成功率还会涨一点，但很难跨过复杂后台所需的稳定性门槛。

如果你切到 `Planner + Skill + Workflow Executor + Failure Triage`，这条线才有可能真正做成项目级、团队级可复用的平台能力。
