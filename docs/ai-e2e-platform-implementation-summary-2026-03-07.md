# AI E2E Platform 改造汇总（2026-03-07）

本文档汇总本轮从 demo 到可落地版本的完整改造内容，供后续迭代开发直接衔接。

## 1. 目标与结果

### 1.1 目标
- 将测试配置从 demo 形态升级为可持久化系统（MySQL）。
- 首页配置列表支持完整 CRUD，且操作区包含：
  - 生成测试计划
  - 执行测试计划
  - 修改
  - 删除
- 测试计划可预览、可下载脚本。
- 执行计划跳转独立页面，包含：
  - 执行中的 LLM 对话
  - 浏览器实时画面
- 执行日志从“仅结果”升级为“过程级明细”。
- 覆盖简单/中等/复杂三层 E2E 需求。
- 支持新增字段：排序号、功能模块。
- 生成脚本文件（`gen-*.spec.ts`）需落库关联到测试任务。

### 1.2 结果
- 已完成数据库建模、接口层、服务层、执行链路、前端页面与交互重构。
- 计划生成代码与执行产物脚本均已持久化（含 JSON 内容）。
- 执行历史支持详细日志展开、筛选、导出。
- 执行详情页支持下载本次脚本。
- 数据库初始化脚本已可对远程 MySQL 执行并成功。

---

## 2. 数据库设计（MySQL）

### 2.1 关键表
- `test_configurations`：测试配置主表
- `test_plans`：测试计划主表（含生成代码、摘要、分层统计）
- `test_plan_cases`：计划用例明细（simple/medium/complex）
- `test_executions`：执行任务主表
- `llm_conversations`：LLM 对话记录（生成/执行场景）
- `execution_stream_events`：执行过程事件流（frame/log/step/artifact/status）
- `execution_artifacts`：执行产物（含 generated_spec）

### 2.2 用户新增关注字段
- `test_configurations.sort_order`（排序号）
- `test_configurations.module_name`（功能模块）
- `test_plans.generated_files_json`（JSON，保存生成测试文件内容）

### 2.3 脚本
- 建表脚本：`scripts/e2e-platform-schema.sql`
- 初始化/兼容迁移脚本：`scripts/init-e2e-db.mjs`
- npm 命令：`npm run db:init`

> 已验证：`db:init` 在远程库执行成功（`E2E platform schema initialized.`）。

---

## 3. 后端架构与主要实现

### 3.1 DB 层
路径：`lib/db/*`
- `client.ts`：MySQL 连接池
- `bootstrap.ts`：DB 启动保障
- `crypto.ts`：敏感字段加密（如登录密码）
- `ids.ts`：业务 UID 生成
- `repository.ts`：仓储层（配置/计划/执行/事件/会话/产物）

关键能力：
- 配置按 `sort_order ASC, updated_at DESC` 查询。
- 登录密码服务端加密存储。
- `generated_files_json` JSON 安全读写。
- 执行事件、对话、产物统一持久化。

### 3.2 服务层
路径：`lib/services/test-plan-service.ts`
- `generatePlanFromConfig(configUid)`
  - 页面分析 + LLM 生成代码
  - 写入计划、写入分层用例、写入生成对话
- `executePlan(planUid)`
  - 并发保护（同计划不可并发 running）
  - 创建 execution 后异步后台执行
- `getExecutionDetail(executionUid)`
  - 聚合 execution + plan + cases + events + conversations + artifacts

### 3.3 执行器链路
- `lib/test-worker.mjs`
  - 执行生成代码
  - 实时发 `frame`
  - 新增 `step/log` 过程事件（控制台、pageerror、requestfailed、步骤状态）
- `lib/test-executor.ts`
  - 接收 worker IPC
  - 通过 hooks 回调 `onFrame/onStep/onLog`
- `test-plan-service.ts`
  - 将 hooks 事件写入 `execution_stream_events`
  - 生成执行摘要（步骤通过/失败统计）

---

## 4. API 清单

### 4.1 配置 CRUD 与计划
- `GET /api/test-configs`
- `POST /api/test-configs`
- `GET /api/test-configs/[configUid]`
- `PUT /api/test-configs/[configUid]`
- `DELETE /api/test-configs/[configUid]`（归档）
- `POST /api/test-configs/[configUid]/generate-plan`
- `GET /api/test-plans/[planUid]`

### 4.2 执行
- `POST /api/test-plans/[planUid]/execute`
- `GET /api/test-configs/[configUid]/executions`
- `GET /api/test-executions/[executionUid]`
- `GET /api/test-executions/[executionUid]/events`
- `GET /api/test-executions/[executionUid]/stream`（SSE）

### 4.3 会话
- `GET /api/conversations?scene=plan_generation|plan_execution&refUid=...`

---

## 5. 前端改造汇总

### 5.1 首页 `app/page.tsx`
- 配置列表字段：
  - 排序号
  - 功能模块
  - 配置信息
  - 计划版本
  - 最近执行
- 操作按钮：
  - 生成测试计划
  - 执行测试计划
  - 修改
  - 删除
- 配置抽屉：支持 `sortOrder/moduleName` 编辑。
- 计划预览抽屉：
  - 计划摘要
  - 分层用例
  - 生成代码
  - 下载脚本
- 执行历史抽屉：
  - 列表筛选：状态、关键词
  - 列表排序：时间倒序/正序（默认倒序）
  - 导出：JSON/CSV
  - 展开单次执行详细日志
    - 事件类型筛选（默认“全部(隐藏frame)”）
    - 日志级别筛选（all/error/warn/info）
    - 时间范围筛选（all/15m/1h/24h）
    - 关键词筛选
    - 导出单次明细 JSON/CSV
    - 定位首条 error
    - 默认自动展开首条失败记录并自动定位首条 error
  - UI 优化：失败/运行中卡片高亮

### 5.2 执行详情页
- 页面：`app/executions/[executionUid]/page.tsx`
- 组件：`components/ExecutionWorkbench.tsx`
- 功能：
  - 执行中的 LLM 对话
  - 浏览器实时画面
  - 事件流展示
  - 计划用例层级
  - 执行产物
  - 下载本次脚本（`generated_spec.meta.content`）

### 5.3 实时画面
- 组件：`components/BrowserView.tsx`
- 基于 WebSocket 接收 screencast 帧，执行中实时渲染。

---

## 6. “生成脚本落库关联”实现说明

### 6.1 计划生成阶段
- 生成文件名 `gen-*.spec.ts`。
- 内容写入：
  - 数据库：`test_plans.generated_files_json`（`name/content/language`）
  - 不再落地写入项目目录下 `tests/e2e/generated/*.spec.ts`（避免文件噪音）

### 6.2 执行产物阶段
- 成功执行后保存 `generated_spec` 产物：
  - `execution_artifacts.artifact_type = generated_spec`
  - `execution_artifacts.meta` 包含 `fileName` 与 `content`（代码内容来自数据库逻辑，不再依赖本地 `.spec.ts`）
  - `storage_path` 使用逻辑路径（示例：`db://executions/{executionUid}/{fileName}`）
- 前端可下载“本次脚本”。

---

## 7. 关键文件清单

### 7.1 DB & 脚本
- `scripts/e2e-platform-schema.sql`
- `scripts/init-e2e-db.mjs`
- `lib/db/client.ts`
- `lib/db/bootstrap.ts`
- `lib/db/crypto.ts`
- `lib/db/ids.ts`
- `lib/db/repository.ts`

### 7.2 服务与执行
- `lib/services/test-plan-service.ts`
- `lib/test-executor.ts`
- `lib/test-worker.mjs`

### 7.3 API
- `app/api/test-configs/route.ts`
- `app/api/test-configs/[configUid]/route.ts`
- `app/api/test-configs/[configUid]/generate-plan/route.ts`
- `app/api/test-configs/[configUid]/executions/route.ts`
- `app/api/test-plans/[planUid]/route.ts`
- `app/api/test-plans/[planUid]/execute/route.ts`
- `app/api/test-executions/[executionUid]/route.ts`
- `app/api/test-executions/[executionUid]/events/route.ts`
- `app/api/test-executions/[executionUid]/stream/route.ts`
- `app/api/conversations/route.ts`

### 7.4 前端
- `app/page.tsx`
- `app/executions/[executionUid]/page.tsx`
- `components/ExecutionWorkbench.tsx`
- `components/BrowserView.tsx`
- `app/globals.css`

### 7.5 配置
- `.env.example`
- `package.json`
- `next.config.mjs`

---

## 8. 已执行验证

多轮验证均通过：
- `npm run build:web`
- `npm run test:unit`
- `npm run db:init`（远程库）

---

## 9. 当前已知注意项

- `tests/e2e/generated/` 下有较多历史生成脚本文件，属于执行产物，不影响运行。
- 如果后续需要减小 DB 体积，可考虑对 `generated_spec.meta.content` 做裁剪或分层存储策略。
- `execution_stream_events` 当前支持高频 frame，前端已默认隐藏 frame 防止刷屏。
- 历史遗留说明：
  - 在本次后半段修正前，执行成功后会在项目目录生成 `gen-*.spec.ts`。该行为已移除。
  - 从当前版本开始，新增执行不再生成本地 `.spec.ts`，仅存数据库 JSON（计划与执行产物）。

---

## 10. 建议后续迭代（可选）

1. 将历史筛选偏好（状态/排序/事件类型/级别/关键词/时间范围）保存到 `localStorage`。
2. 增加执行日志服务端分页接口，避免单次载入过大。
3. 增加“重新执行上次失败步骤”能力（若执行器支持步骤重放）。
4. 增加配置排序号拖拽排序与批量更新接口。
5. 增加权限与审计（谁创建/修改/执行）。

---

## 11. 启动/联调参考

1. 安装依赖：`npm install`
2. 初始化数据库：`npm run db:init`
3. 本地启动：`npm run dev`
4. 打开首页后流程：
   - 新建配置（含排序号/功能模块）
   - 生成测试计划（预览+下载脚本）
   - 执行计划（跳转执行页）
   - 在首页执行历史中查看/筛选/导出详细日志
