# Intent Draft Active Run Reuse Task Brief

## 目标
- 修复项目工作台里“意图草稿 -> 测试流程”入口误判无活动 Run、重复创建新意图任务的问题。
- 恢复草稿已有活动 Run 时更明确的按钮反馈，避免用户误以为需要重新开跑。

## 范围
- `lib/intent-e2e-draft-launch.ts`
- `components/ProjectWorkspace.tsx`
- `tests/unit/intent-e2e-draft-launch.spec.ts`

## 最小方案
- 草稿入口跳转 href 统一通过 helper 生成：优先复用最新活动 `runId`，否则才带 `draftLaunch=test_flow`。
- 草稿列表点击“测试流程”前，如果当前列表项没有 `activeRunId`，补一次草稿详情读取做兜底，避免列表状态稍旧时误开新任务。
- 按钮文案从模糊的“继续测试”改回“执行测试中”。

## 验收
- 草稿已有活动 Run 时，再次点击不会创建新任务，而是直接进入对应 `runId` 的意图控制台。
- 草稿无活动 Run 时，仍然按原逻辑进入新的 `draftLaunch=test_flow`。
- 定向单测覆盖 href 选择与按钮文案。

## 验证
- `npx vitest run tests/unit/intent-e2e-draft-launch.spec.ts --reporter=dot`
