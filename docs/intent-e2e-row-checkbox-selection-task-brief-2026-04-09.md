# Task Brief

## 标题
- 修复列表目标行复选框点击不稳导致的批量操作失败

## 背景
- 真实 run 已出现“目标页面已到达、筛选已完成，但在选中列表行做批量操作时卡在复选框点击”的失败。
- 当前失败模式表现为：
  - `locator.click: Timeout ... waiting for ... .ant-checkbox`
  - `未找到可点击的行复选框`
- 核心问题不是业务动作不存在，而是脚本默认去点第一条/随机一条行里的 checkbox，或直接点脆弱的 `.ant-checkbox` 细节。

## 本轮目标
- 新增稳定的行复选框 helper，统一处理可见 wrapper / clone row / 选中态校验。
- 在 generate / repair 提示里明确要求“先定位目标行，再点该行复选框”，不再让模型手写 `.ant-checkbox` 细节。
- 把 `未找到可点击的行复选框` 纳入可修复的 selector drift 归因。

## 验收标准
- [ ] worker 暴露 `__e2e.clickAntdRowCheckbox(...)`
- [ ] prompt / repair 会优先引导使用该 helper
- [ ] `未找到可点击的行复选框` 不再走 `unknown`
- [ ] 最小单测通过

## 范围
- 会改：
  - `lib/test-worker.mjs`
  - `lib/test-generator.ts`
  - `lib/ai/intent-e2e-failure-triage.ts`
  - `tests/unit/test-executor.spec.ts`
  - `tests/unit/test-generator.spec.ts`
  - `tests/unit/intent-e2e-failure-triage.spec.ts`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - UI 页面层
  - 无关执行 helper

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 后真实 run 缺陷收口
- 对应小步：批量操作里的目标行选择稳定化
- 本轮完成后：不单独回写 roadmap

## 验证
- `npm run build`
- `npx vitest run tests/unit/test-executor.spec.ts tests/unit/test-generator.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts`

## 风险 / 未覆盖
- 本轮不处理“目标行本身不可选”的业务前提问题，只处理脚本误点第一行/脆弱 checkbox 定位
- 不改 ExecutionPlan schema
