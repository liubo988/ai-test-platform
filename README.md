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

### 最近一次联调验证（2026-03-19）
- 已修正 `intent-e2e` 前置检查的阻断分支：`precheckPageAccess()` 返回 `blocked` 时会直接产出结构化终态结果，不再继续走页面分析。
- 已兼容 Next 16 生产构建要求：`/intent-e2e` 与 `/projects/[projectUid]` 页面中依赖 `useSearchParams()` 的工作台已包进 `Suspense`，`npm run build:web` 可稳定通过。
- 已补上 OpenAI Responses API 的重试兜底：当上游返回 `reasoning item was provided without its required following item` 时会自动重试。
- 已修正需求编排工作台中的已归档能力目录展示，恢复操作可直接在 UI 中完成。
- 当前验证结果：`npm run build`、`npm run build:web`、`npm run test:integration`、`npm run test:e2e` 均已通过；`product-create.spec.ts` 仅因缺少真实账号环境变量而按预期跳过。

### 工作台能力
在 `/intent-e2e` 页面里可以直接：
- 输入一句测试目标
- 上传最多 4 张截图
- 补充可选目标 URL
- 填写可选登录信息
- 临时覆盖 provider / model / baseUrl / vision / retry 配置
- 实时查看阶段状态、ScenarioCard、动作约束 DSL / 高频动作库、尝试日志、脚本生成、自愈过程与浏览器实时画面
- 运行完成后直接查看：命中了哪些项目知识规则、推荐了哪些 helper、最终脚本实际用了哪些 helper
- repair 阶段会自动命中历史相似失败记忆，把已验证修法与常见误区一起注入到修复 Prompt
- generate / repair 阶段都会先匹配项目知识规则文件，自动裁剪 DSL、动作库和 Prompt
- repair memory 达到阈值后，可在工作台里直接预览 / 写出项目知识规则草稿，并勾选候选后一键合并回项目规则文件；合并时会自动备份旧文件、展示本次变更预览、给出 merge / restore 前后覆盖对比，并保留最近审计记录
- 可直接在工作台查看“历史运行洞察”：最近通过率、知识命中率、推荐 helper 复用率、Top 规则 / helper / 失败类别，以及疑似导致成功率下滑的规则合并回滚提示
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
- `GET /api/intent-e2e/insights`：汇总最近终态运行的通过率、知识命中率、helper 复用率、Top 规则 / helper / 失败类别，以及基于 merge 审计推导的回滚候选

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
- 如果请求里额外带上 `projectUid`，merge / restore 会先校验该项目的 `owner/editor` 权限，并尝试把这次操作同步写入项目 activity log
- `GET /api/intent-e2e/project-knowledge/audits` 会返回最近的 merge / restore 审计记录；可选通过 `projectUid` 过滤某个项目上下文触发的操作
- `GET /api/intent-e2e/project-knowledge/backups` 会返回当前规则文件可用的备份列表
- `POST /api/intent-e2e/project-knowledge/backups/restore` 传入某个 `backupPath` 后，可直接把项目规则回滚到该备份版本，并返回回滚前后配置对比
- `GET /api/intent-e2e/insights` 可选带 `projectUid`、`runLimit`、`auditLimit`；若指定 `projectUid`，会校验该项目的 `owner/editor/viewer` 权限
- `GET /api/intent-e2e/insights` 当前直接复用已持久化的 run snapshot 和知识审计，不额外建表；回滚候选会比较某次 merge 前后最多各 5 次终态运行，通过率下滑达到 20 个点时会高亮提醒
- 草稿默认只会把“重复出现且至少修成功过一次”的失败模式提炼成候选规则，并标记哪些规则已经被现有知识覆盖

## GitHub 自动化
- `ci.yml`：PR/main 自动跑 unit + integration + e2e
- `edge-case-intake.yml`：Issue 标签 `edge-case` 自动入库到 `edge-cases/cases.json`
- `ai-generate-tests.yml`：`edge-cases/**` 变更后自动生成测试并发 PR

## 下一步建议
1. 基于当前 insights 做规则排序、自动降级或半自动回滚 guardrail，把“看得到趋势”继续推成“系统会主动保护成功率”
2. 把更多业务动作沉淀成 runtime helper（如 `login`、`submit_order`、`assert_order_created`）
3. 决定是否把当前全局 `intent-e2e.project-knowledge.json` 继续拆成 project-scoped 知识文件，减少多项目之间的规则串扰
4. 接入真实预发环境 E2E（通过 `E2E_BASE_URL`）
5. 完善 provider 切换占位（OpenAI / Claude / Gemini），保持执行层不变
