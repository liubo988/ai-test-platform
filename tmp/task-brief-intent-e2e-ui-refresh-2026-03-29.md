# Task Brief

## 标题
- `/intent-e2e` 工作台 UI 质感重构（UI only）

## 背景
- 当前 `/intent-e2e` 已有一版较完整的工作台样式，但首屏重心、左右分区和二级信息层级仍偏散。
- 用户希望整体更像 Claude 的工作台质感，同时明确要求不要影响现有功能。

## 本轮目标
- 只重构 `/intent-e2e` 页面层的视觉、布局和信息层级。

## 验收标准
- [ ] `/intent-e2e` 首屏视觉重心更明确，输入区、执行区和次级详情分层更清晰。
- [ ] 现有表单输入、执行、停止、恢复、治理和详情查看功能保持可用。
- [ ] 不修改 API 契约、状态流和业务逻辑。
- [ ] `npm run build` 与 `npm run build:web` 通过。

## 范围
- 会改：
  - `components/IntentE2EWorkbench.tsx`
  - `components/BrowserView.tsx`
  - `app/intent-e2e/page.tsx`
  - `app/globals.css`
- 不会改：
  - 数据库 schema
  - `app/api/**`
  - `lib/ai/**`
  - 运行状态、SSE、项目知识和治理逻辑

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 已完成，当前任务不涉及 roadmap 能力推进。
- 对应小步：页面层视觉重构，不改 intent-e2e 主链路行为。
- 本轮完成后：不回写 roadmap 进度，只保留 UI 改动验证结果。

## 计划修改点
- 收紧首屏 Hero、输入区和操作区层级。
- 统一右侧执行区的视觉语言，强化实时画面主视觉。
- 把次级详情、长日志和治理信息继续压到更清晰的次层，而不是首屏平铺。
- 微调全局背景和页面字体，做出更温润的工作台质感。

## 验证
- `npm run build`
- `npm run build:web`
- 本地浏览器桌面 / 移动端截图检查

## 风险 / 未覆盖
- 长组件已有未提交改动，本次会在现状上继续演进，不回退既有逻辑。
- 只做页面层视觉重构，不补新的功能测试用例。

## 完成后动作
- 汇总 UI 改动点与验证结果。
