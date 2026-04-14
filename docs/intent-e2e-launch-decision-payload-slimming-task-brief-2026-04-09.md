# Intent E2E Launch Decision Payload Slimming Task Brief

## 目标
- 修复意图草稿/工作台在“正在评估启动条件…”阶段长时间卡住的问题。
- 保持启动决策语义不变，只移除这一步不需要的大字段传输。

## 范围
- `components/IntentE2EWorkbench.tsx`
- `lib/ai/intent-e2e-request.ts`
- `tests/unit/intent-e2e-request.spec.ts`
- `tests/unit/intent-e2e-draft-launch.spec.ts`

## 最小方案
- `launch-decision` 请求只发送最小判定字段：`input / targetUrl / projectUid / moduleUid / intentDraftUid / auth / llmConfig / runtimeGovernance / attachment count proxy`。
- 不再在这一步传输 `prefilledScenarioCard`、`prefilledPlanCode`、原始图片 base64。
- 前端对 `launch-decision` 增加显式超时，避免无限停留在“正在评估启动条件…”。
- 草稿列表按钮文案恢复为“继续测试”。

## 验收
- 启动评估请求不再携带大体积草稿资产。
- 若服务端评估超时，前端能结束等待并给出明确错误，而不是一直停在第一步。
- 相关纯函数单测通过。

## 验证
- `npx vitest run tests/unit/intent-e2e-request.spec.ts tests/unit/intent-e2e-draft-launch.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts --reporter=dot`
