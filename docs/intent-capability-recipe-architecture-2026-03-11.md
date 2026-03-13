# Intent / Capability / Recipe 最小架构

## 目标

把“用户手工描述复杂业务流，再让模型自由生成 Playwright 代码”的模式，替换为三层稳定结构：

1. `知识层`
   项目级手册、历史验证结论、执行沉淀。

2. `能力层`
   稳定、可复用、可版本化的系统操作能力块。

3. `编排层`
   用户只给一句简单需求，系统从知识层和能力层挑选、补齐依赖、输出结构化 recipe。

## 当前已落地

### 数据表

- `project_knowledge_documents`
- `project_knowledge_chunks`
- `project_capabilities`

### 核心逻辑

- 手册文本切块：[`lib/project-knowledge.ts`](/Users/xiaolongbao/Workspace/ai-test/lib/project-knowledge.ts)
- 知识 / 能力持久化：[`lib/db/repository.ts`](/Users/xiaolongbao/Workspace/ai-test/lib/db/repository.ts)
- 依赖补齐式 recipe draft：[`lib/project-knowledge.ts`](/Users/xiaolongbao/Workspace/ai-test/lib/project-knowledge.ts)

### API

- `GET/POST /api/projects/[projectUid]/knowledge`
- `GET/POST /api/projects/[projectUid]/capabilities`
- `POST /api/projects/[projectUid]/draft-recipe`

### 导入脚本

- [`scripts/import-gbs-manual-knowledge.mjs`](/Users/xiaolongbao/Workspace/ai-test/scripts/import-gbs-manual-knowledge.mjs)

默认行为：

- 从 `管帮手PC端操作手册.pdf` 提取文本
- 按章节和段落切成知识块
- upsert 到 `proj_default / 测试环境`
- 同时种入首批稳定能力

## 首批能力

- `auth.sms-password-login`
- `navigation.business-create-page`
- `navigation.business-list-page`
- `business.create-no-attachment`
- `business.list-search-by-phone`
- `composite.business-create-to-order`

这些能力已经绑定到本次真实验证通过的“创建商机 V10”结论，而不是纯手册想象。

## 当前 recipe 行为

输入示例：

`创建商机并在商机列表按手机号校验落库`

输出会稳定给出：

- 登录能力
- 创建商机页导航能力
- 商机列表页导航能力
- 创建商机动作能力
- 列表按手机号检索能力

并自动补齐依赖，不再依赖模型自己猜“先登录还是先开页面”。

当输入 `创建商机并生成订单` 时，recipe 会优先命中 `composite.business-create-to-order`，并复用保留的多节点 `flowDefinition`，而不是把“创建商机 / 列表检索 / 生成订单”再压回单步描述。

## 后续建议

1. 把成功执行记录沉淀成新的 `execution-derived capabilities`
2. 给能力增加版本、禁用、人工审核状态
3. recipe 生成后增加“生成测试任务”按钮，把 recipe 转成可执行 plan
4. 为复杂业务流增加变量绑定和跨页面数据映射
