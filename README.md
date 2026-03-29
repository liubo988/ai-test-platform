# 自动化测试中台（Node + Vitest + Playwright）

## 能力
- Unit / Integration / E2E 分层测试
- 市场边缘用例结构化沉淀（`edge-cases/cases.json`）
- 自动生成回归测试（`npm run edge:generate`）
- CI 自动执行全链路测试
- 支持 LLM 生成测试（有 API Key 时启用，无 Key 自动 fallback 模板）
- 新增 AI 意图驱动 E2E MVP：`简单文本/图片 -> ScenarioCard -> 项目知识裁剪 -> 动作约束 DSL -> 高频动作库 -> Playwright 生成 -> 执行 -> 修复记忆增强自愈`
- 新增前端工作台：`/intent-e2e`

## 快速开始
```bash
npm install
npm run edge:generate
npm run test:all
```

## 常用命令
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run test:smoke`
- `npm run test:all`
- `npm run edge:generate`
- `npm run edge:report`

## LLM 生成（可选）
默认推荐模型：`api-proxy-codex/gpt-5.3-codex`

1. 复制 `.env.example` 为 `.env` 并填入 key
2. 导出环境变量后执行：
```bash
npm run edge:generate
```
3. 结果会输出到：
- `tests/integration/generated/*.spec.ts`
- `reports/generation-summary.json`

## AI 意图驱动 E2E MVP
当前已经新增多条入口：
- 前端工作台：`/intent-e2e`（默认使用服务端 `runId + SSE` 流式反馈）
- 后端接口（非流式 fallback）：`POST /api/intent-e2e`
- 后端接口（直接 SSE fallback）：`POST /api/intent-e2e/stream`
- 后端接口（创建服务端运行）：`POST /api/intent-e2e/runs`
- 后端接口（查询运行状态）：`GET /api/intent-e2e/runs/:runId`
- 后端接口（订阅运行事件）：`GET /api/intent-e2e/runs/:runId/stream`
- 后端接口（停止运行）：`POST /api/intent-e2e/runs/:runId/cancel`
- 后端接口（保存到项目工作台）：`POST /api/intent-e2e/runs/:runId/workspace`
- 后端接口（预览项目知识草稿）：`GET /api/intent-e2e/project-knowledge/draft`
- 后端接口（写出项目知识草稿）：`POST /api/intent-e2e/project-knowledge/draft`
- 后端接口（合并选中项目知识规则）：`POST /api/intent-e2e/project-knowledge/merge`
- 后端接口（读取项目知识审计记录）：`GET /api/intent-e2e/project-knowledge/audits`
- 后端接口（读取项目知识备份列表）：`GET /api/intent-e2e/project-knowledge/backups`
- 后端接口（按备份回滚项目知识规则）：`POST /api/intent-e2e/project-knowledge/backups/restore`
- 后端接口（汇总历史运行洞察）：`GET /api/intent-e2e/insights`

同时可读取当前服务端默认配置：
- `GET /api/llm/config`

### Intent E2E 开发主线
- `intent-e2e` 当前的开发主文档、阶段状态、逐轮完成内容、验证结果、风险与下一步，统一以 [docs/intent-e2e-high-success-roadmap-2026-03-20.md](docs/intent-e2e-high-success-roadmap-2026-03-20.md) 为准。
- 详细的“最近一次联调验证”与阶段回写不再在 README 和 roadmap 双份维护，避免状态漂移。
- 如果当前任务涉及 `ExecutionPlan / VerificationPlan`、verifier、starter helper、repair memory、project knowledge 或 `/intent-e2e` 工作台，请先阅读 roadmap 中的“当前状态快照”“阶段状态”和最新一条进度更新。

### 工作台能力
在 `/intent-e2e` 页面里可以直接：
- 输入一句测试目标
- 上传最多 4 张截图
- 补充可选目标 URL
- 填写可选登录信息
- 临时覆盖 provider / model / baseUrl / vision / retry 配置
- 实时查看阶段状态、ScenarioCard、动作约束 DSL / 高频动作库、尝试日志、脚本生成、自愈过程与浏览器实时画面
- 运行完成后直接查看：命中了哪些项目知识规则、推荐了哪些 helper、洞察里建议优先复用哪些 starter helper、最终脚本实际用了哪些 helper
- repair 阶段会自动命中历史相似失败记忆，把已验证修法与常见误区一起注入到修复 Prompt
- generate / repair 阶段都会先匹配项目知识规则文件，自动裁剪 DSL、动作库和 Prompt；最近历史通过率更高的规则会被前置，观察期中的新规则会轻微降权，已降级或命中过去可疑回滚候选的高风险规则会被自动跳过
- generate / repair 阶段还会额外吃到来自已转正或稳定高通过率规则的 starter helper 建议；如果当前步骤语义匹配，会优先复用已验证过的 `__e2e.*` helper，而不是再手写一套脆弱的底层点击 / 等待逻辑
- starter helper 不再只是自然语言提示：首批通过 catalog 白名单的 helper 会直接回写到 DSL `preferredHelpers`，并把对应 capability 作为 Starter 资产插进高频动作库，连同历史复用次数、通过率和支持规则一起给到模型
- 成功运行后，如果本次确实命中了 Starter 资产，可直接把它们预填到项目能力工作台；保存后会立刻进入项目 capability / recipe 体系，不再只是停留在运行时建议
- 成功运行后，如果本次命中了多条 Starter 资产，可直接在结果区勾选后批量沉淀到项目能力库；若只想精修某一条，再单独打开对应 capability 草稿
- 项目能力工作台里可先按来源 / Starter Helper / 验证状态筛出 Starter 能力，再对当前筛选结果做批量归档、批量验证或批量修复失败项，避免沉淀后又只能逐条清理
- 无论是单条验证还是批量验证 / 修复，顶部“能力验证批次”面板都会持续显示执行状态、等待目录回写数和每条运行入口，直到 capability `meta` 真正同步完成
- repair memory 达到阈值后，可在工作台里直接预览 / 写出项目知识规则草稿，并勾选候选后一键合并回项目规则文件；合并时会自动备份旧文件、展示本次变更预览、给出 merge / restore 前后覆盖对比，并保留最近审计记录
- 可直接在工作台查看“历史运行洞察”：最近通过率、知识命中率、推荐 helper 复用率、Starter Helper 建议、Top 规则 / helper / 失败类别，以及疑似导致成功率下滑的规则合并回滚提示
- 新 merge 的规则会先进入“观察期”卡片：默认观察前 6 次终态运行，展示基线通过率、当前通过率、剩余样本数；若前 3 次起通过率跌到 35% 以下，或相对合并前基线下滑 15 个点以上，会自动降级并支持直接回滚到对应备份
- 随时停止当前自动测试，并保留已生成的上下文和尝试记录
- 自动显示服务端 `runId`，刷新页面后可自动恢复当前运行
- 在流式执行完成后查看最终 `ScenarioCard`、编译后的描述、每次尝试的脚本 / 日志 / 结果
- 在流式执行结束后，可直接把本次结果保存为项目任务，或追加为已有任务的新脚本版本；同时写入执行历史，失败结果也能沉淀到工作台继续修复

### 请求体示例
```json
{
  "input": "访问结算页，输入有效手机号并提交，最终看到成功页面",
  "targetUrl": "http://127.0.0.1:4173/checkout",
  "attachments": [
    {
      "name": "expected-success-page.png",
      "dataUrl": "data:image/png;base64,...",
      "purpose": "预期成功页参考"
    }
  ],
  "auth": {
    "loginUrl": "https://example.com/login",
    "username": "13800138000",
    "password": "123456",
    "loginDescription": "密码登录"
  },
  "llmConfig": {
    "provider": "openai",
    "model": "api-proxy-codex/gpt-5.3-codex",
    "baseUrl": "https://api.openai.com/v1",
    "apiStyle": "responses",
    "visionEnabled": true,
    "selfHealRetries": 2,
    "maxPlanSteps": 8
  }
}
```

### 返回内容
- `POST /api/intent-e2e`：返回完整 JSON，字段包括 `scenarioCard`、`description`、`attempts`、`finalResult`
- `POST /api/intent-e2e/stream`：返回 SSE 事件流，包含 `stage`、`scenario_card`、`description`、`attempt_started`、`attempt_execution_started`、`attempt_event`、`attempt_step`、`attempt_log`、`attempt_result`、`final_result`；保留为直接流式 fallback
- `POST /api/intent-e2e/runs`：立即返回 `{ runId, run }`，服务端后台继续执行
- `GET /api/intent-e2e/runs/:runId`：返回当前运行快照，包含 `status`、`stage`、`events`、`result`
- `GET /api/intent-e2e/runs/:runId/stream`：先补发 backlog，再推送实时事件，适合刷新恢复 / 断线重连
- `POST /api/intent-e2e/runs/:runId/cancel`：触发服务端停止当前运行
- `POST /api/intent-e2e/runs/:runId/workspace`：把最终运行结果导入现有项目工作台，沉淀为任务、脚本版本和执行历史
- `GET /api/intent-e2e/insights`：汇总最近终态运行的通过率、知识命中率、helper 复用率、`starterHelpers`、Top 规则 / helper / 失败类别、`probationRules`，以及基于 merge 审计推导的回滚候选

### Repair Memory
- 默认会把失败聚类和成功修法写入 `reports/intent-e2e-repair-memory.json`
- 可通过环境变量 `INTENT_E2E_REPAIR_MEMORY_PATH` 覆盖持久化路径
- 每次失败会按错误类别 + 归一化错误签名聚类，记录常见误区与最近失败代码片段
- 后续 repair 会先查询相似历史，再把 `常用修法 / 常见误区` 注入 Prompt；修复成功后再回写成功策略

### Project Knowledge
- 默认会读取根目录 `intent-e2e.project-knowledge.json` 作为项目知识规则文件
- 可通过环境变量 `INTENT_E2E_PROJECT_KNOWLEDGE_PATH` 切换到别的 JSON 文件
- 每条规则可按 URL / 标题 / 页面正文 / iframe URL / 用户意图命中后，自动追加全局规则、步骤约束、首选 helper 和动作库能力
- 这是后续最推荐的迭代入口：优先改这份 JSON，而不是直接改 Prompt 大段文案

### Knowledge Draft
- 默认会把自动草拟的规则候选输出到 `reports/intent-e2e.project-knowledge.draft.json`
- 可通过环境变量 `INTENT_E2E_PROJECT_KNOWLEDGE_DRAFT_PATH` 覆盖草稿输出路径
- 合并时默认会先把旧规则文件备份到 `reports/intent-e2e.project-knowledge.backups/`
- 可通过环境变量 `INTENT_E2E_PROJECT_KNOWLEDGE_BACKUP_DIR` 覆盖备份目录
- merge / restore 审计默认会追加到 `reports/intent-e2e.project-knowledge.audit.jsonl`
- 可通过环境变量 `INTENT_E2E_PROJECT_KNOWLEDGE_AUDIT_PATH` 覆盖审计日志路径
- `GET /api/intent-e2e/project-knowledge/draft` 会基于当前 repair memory 返回候选规则预览
- `POST /api/intent-e2e/project-knowledge/draft` 传入 `{ "write": true }` 会把草稿写到文件，工作台里也已提供一键写出入口
- `POST /api/intent-e2e/project-knowledge/merge` 传入候选 `candidateIds` 后，会把选中的建议规则直接合并回 `intent-e2e.project-knowledge.json`，并返回 backup 路径、变更预览、覆盖对比与最新审计记录
- `POST /api/intent-e2e/project-knowledge/merge` 若本次新增规则命中过去的“可疑回滚候选”规则 ID，会额外返回 `guardrailWarning`，提醒先小范围验证
- 如果请求里额外带上 `projectUid`，merge / restore 会先校验该项目的 `owner/editor` 权限，并尝试把这次操作同步写入项目 activity log
- `GET /api/intent-e2e/project-knowledge/audits` 会返回最近的 merge / restore 审计记录；可选通过 `projectUid` 过滤某个项目上下文触发的操作
- `GET /api/intent-e2e/project-knowledge/backups` 会返回当前规则文件可用的备份列表
- `POST /api/intent-e2e/project-knowledge/backups/restore` 传入某个 `backupPath` 后，可直接把项目规则回滚到该备份版本，并返回回滚前后配置对比
- `GET /api/intent-e2e/insights` 可选带 `projectUid`、`runLimit`、`auditLimit`；若指定 `projectUid`，会校验该项目的 `owner/editor/viewer` 权限
- `GET /api/intent-e2e/insights` 当前直接复用已持久化的 run snapshot 和知识审计，不额外建表；新 merge 的规则会进入最多 6 次终态运行的观察期，并结合合并前最多 5 次终态运行做基线对比
- 观察期在满足至少 3 次样本后，如果通过率降到 35% 以下，或相对基线下滑达到 15 个点，会自动标记为 `degraded`；完成 6 次观察且未降级则自动转正
- `GET /api/intent-e2e/insights` 还会从已转正或稳定高通过率规则里提炼 `starterHelpers`：要求 helper 至少复用 2 次、成功 2 次且通过率不低于 70%，并给出来源规则、复用次数和推荐文案
- 当前服务端在执行 generate / repair 前，会把最近运行沉淀出的规则表现反馈回规划阶段：高通过率规则会前置进 DSL / Prompt，观察期规则轻微降权，已降级或历史低通过率且命中过回滚候选的规则会被降权甚至跳过；同时把 `starterHelpers` 一起注入规划，让首轮生成优先复用已验证过的 helper
- 当前 starter helper 还会先经过 runtime helper catalog 过滤：只有执行层真实存在、且能映射到当前 DSL 语义的 helper 才会进入 Prompt / DSL / 动作库；命中的 helper 会被回写进步骤级 `preferredHelpers`，并计入本次推荐 helper 复用统计
- 当前运行结果里的 `knowledge` 还会额外返回 `starterAssets`，前端结果区既可把它们批量写入项目能力库，也可单条转成 capability 草稿；preset 在 URL / sessionStorage 往返时也会保留 starter 证据元信息
- 项目工作台里的能力目录现在会解析 capability `meta`：即使某条 Starter 能力后续已经被验证升级，仍会保留 Starter 来源标记，并允许按来源 / Helper / 验证状态继续筛选；当前筛选结果还支持直接批量归档、批量验证和批量修复失败项，验证批次面板也会自动追踪结果回写
- 草稿默认只会把“重复出现且至少修成功过一次”的失败模式提炼成候选规则，并标记哪些规则已经被现有知识覆盖

## GitHub 自动化
- `ci.yml`：PR/main 自动跑 unit + integration + e2e
- `edge-case-intake.yml`：Issue 标签 `edge-case` 自动入库到 `edge-cases/cases.json`
- `ai-generate-tests.yml`：`edge-cases/**` 变更后自动生成测试并发 PR

## 下一步建议
1. 给能力验证批次再补“失败原因聚合 / 一键只看未回写项”视图，减少大批量治理时在目录卡片和运行页之间来回切换
2. 继续扩充 runtime helper catalog，把更多已稳定高收益的 helper 纳入白名单（如 `select_option`、`enter_frame_context`、`wait_for_visible_modal`）
3. 决定是否把当前全局 `intent-e2e.project-knowledge.json` 继续拆成 project-scoped 知识文件，减少多项目之间的规则串扰
4. 接入真实预发环境 E2E（通过 `E2E_BASE_URL`）
5. 完善 provider 切换占位（OpenAI / Claude / Gemini），保持执行层不变
