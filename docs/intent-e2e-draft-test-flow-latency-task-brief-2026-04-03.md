# Task Brief

## 标题
- 意图草稿“测试流程”跳转提速与 `draft_only` 软提示收口

## 背景
- 当前项目工作台里的意图草稿点击“测试流程”时，会先取草稿详情、再请求 `/api/intent-e2e/launch-decision`，最后才跳到 `/intent-e2e`，导致进入控制台明显偏慢。
- 当 launch decision 返回 `draft_only` 时，草稿页会把结果直接编码进 URL，工作台随后把它当成“实时日志里的启动拦截”展示，用户看到的是报错感知，而不是一条可继续编辑或手动验证的风险提示。

## 本轮目标
- 把草稿页的“测试流程”改成先进入控制台，再由控制台消费自动启动意图。
- 保留 `needs_bootstrap / needs_fixture / needs_clarify` 的硬拦截。
- 把 `draft_only` 收口成草稿入口的软提示，不再让旧 URL 或草稿页显式启动直接落成“实时日志报错”。

## 验收标准
- [ ] 点击草稿“测试流程”时，不再等待 launch-decision 请求完成后才跳转控制台。
- [ ] 草稿页显式发起测试时，`draft_only` 不再把控制台落成“启动已拦截”的硬状态。
- [ ] 旧的 `launchDecision=draft_only` URL 打开后只恢复草稿上下文，不再把实时日志锁死在拦截态。
- [ ] 相关纯函数单测覆盖新 query/href 规则。

## 范围
- 会改：
  - `components/ProjectWorkspace.tsx`
  - `components/IntentE2EWorkbench.tsx`
  - `lib/intent-e2e-draft-launch.ts`
  - `tests/unit/intent-e2e-draft-launch.spec.ts`
- 不会改：
  - `/api/intent-e2e/launch-decision` 路由契约
  - DB schema
  - 无关的 verifier / compiler / insights 逻辑

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 之后的生产化收口期
- 对应小步：草稿入口到工作台的启动体验修复
- 本轮完成后：不单独回写 roadmap 阶段状态，只补本次 task brief 作为 bugfix 约束

## 计划修改点
- 新增草稿测试流 query helper，统一 `draftLaunch=test_flow` 的 URL 构造与软拦截判断。
- 项目工作台只负责快速跳转；工作台负责消费草稿详情、自动启动和风险提示。
- 旧 query 的 `draft_only` 从硬拦截降为 advisory，不影响继续编辑或手动重试。

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-draft-launch.spec.ts`
- `npm run build:web`

## 风险 / 未覆盖
- 不处理新的 route 级 launch-decision 策略，只调整前端消费方式。
- 不补浏览器 E2E；本轮先用纯函数单测和构建验证收口。

## 完成后动作
- 若交互文案仍引发误解，再单独开任务收口“草稿入口风险提示”文案。
