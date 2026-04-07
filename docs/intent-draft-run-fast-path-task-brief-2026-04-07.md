# Task Brief

## 标题
- intent-e2e：意图草稿启动复用 ScenarioCard 与首版脚本

## 背景
- 当前从“意图草稿”点击“测试流程”后，服务端仍会重新执行一次 `ScenarioCard` 生成与首轮脚本生成。
- 草稿本身已经保存了 `scenarioCard` 和 `planCode`，继续全量重跑会让“AI 正在自动推进整条链路”阶段等待过长。

## 本轮目标
- 草稿启动时，把已保存的 `scenarioCard` 和首版脚本带入 run 请求。
- 服务端优先复用这些预编译资产，跳过重复规划与首轮生成。

## 验收标准
- [ ] 从意图草稿启动 run 时，若草稿已有 `scenarioCard`，服务端不再重复调用 `generateScenarioCard()`。
- [ ] 若草稿已有 `planCode`，首轮尝试直接复用该脚本，不再重复调用 `generateTest()`。
- [ ] 非草稿启动、或草稿资产缺失时，仍保持原有链路。

## 范围
- 会改：
  - `components/IntentE2EWorkbench.tsx`
  - `lib/ai/intent-e2e-request.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-request.spec.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
- 不会改：
  - 草稿存储结构
  - launch-decision 规则
  - repair / verifier 逻辑

## 验证
- `npx vitest run tests/unit/intent-e2e-request.spec.ts tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `npm run build:web`
