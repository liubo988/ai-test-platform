# 项目化 E2E 平台改造进度（2026-03-09）

## 已完成

### 1. 数据模型升级

- 新增项目表：`test_projects`
- 新增模块表：`test_modules`
- 为任务、计划、用例、执行、会话、事件、产物补充 `project_uid`
- 为测试任务补充 `module_uid`

涉及：
- `scripts/e2e-platform-schema.sql`
- `scripts/init-e2e-db.mjs`
- `lib/db/repository.ts`

### 2. 项目级认证继承

- 登录信息从任务级提升到项目级
- 新增 `loginDescription` 用于描述登录页 tab 切换方式
- 页面分析和计划生成阶段都开始消费项目级认证说明

涉及：
- `lib/services/test-plan-service.ts`
- `lib/page-analyzer.ts`
- `lib/test-generator.ts`

### 3. 项目与模块 CRUD

已新增接口：

- `GET/POST /api/projects`
- `GET/PUT/DELETE /api/projects/[projectUid]`
- `GET/POST /api/projects/[projectUid]/modules`
- `GET/PUT/DELETE /api/modules/[moduleUid]`

任务接口继续沿用：

- `GET/POST /api/test-configs`
- `GET/PUT/DELETE /api/test-configs/[configUid]`

### 4. 首页重构

- 首页改为项目卡片视图
- 支持新建测试项目
- 项目卡片展示：
  - 名称
  - 背景图
  - 描述
  - 模块数
  - 任务数
  - 最近执行状态

涉及：
- `app/page.tsx`

### 5. 项目详情页重构

- 新增项目详情页
- 左侧模块导航
- 右侧任务列表
- 模块菜单支持收起
- 模块保存后左侧即时刷新
- 任务创建必须先选择模块

涉及：
- `app/projects/[projectUid]/page.tsx`
- `components/ProjectWorkspace.tsx`

### 6. 执行详情新页面

- 新增执行详情入口：`/runs/[executionUid]`
- 新页面聚焦：
  - 任务上下文
  - 登录策略
  - LLM 对话
  - 浏览器实时画面
  - 执行事件
  - 执行产物
- 已去掉旧页面里低价值的“计划用例层级”展示

涉及：
- `app/runs/[executionUid]/page.tsx`
- `components/ExecutionConsole.tsx`
- `app/api/execution-details/[executionUid]/route.ts`

### 7. 兼容层

- 新增中间件，把旧执行详情路径 `/executions/:id` 自动重定向到 `/runs/:id`
- 同时兼容旧的执行详情 API 访问路径 `/api/test-executions/:id`

涉及：
- `proxy.ts`

### 8. 项目与模块执行统计

- 首页项目卡片新增：
  - 项目级执行通过率
  - 运行中执行数
  - 最近执行时间
- 项目详情页新增：
  - 项目级通过率与进行中数量
  - 模块级执行次数、通过率、最近执行时间
- 统计基于现有执行记录聚合，不需要新增表结构

涉及：
- `lib/db/repository.ts`
- `app/page.tsx`
- `components/ProjectWorkspace.tsx`

## 方案文档

已输出方案评估文档：

- `docs/projectized-e2e-platform-solution-2026-03-09.md`

## 当前验证状态

已完成本地基础验证：

- `npm run build`
- `npm run build:web`
- `npm run test:unit`
- `npm run test:integration`

当前没有新的编译期阻塞记录。

## 建议下一步

1. 在目标环境执行数据库初始化/迁移脚本
2. 补项目级协作、审计和归档恢复能力
3. 为项目/模块统计补更细的趋势视图
4. 再接入登录策略建议、失败归因等 Agent 增强能力
