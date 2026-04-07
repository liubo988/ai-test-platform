# Task Brief

## 标题
- ProjectWorkspace：已导入意图草稿继续允许发起“测试流程”

## 背景
- 当前项目里的意图草稿在导入正式任务后，状态会从 `active` 变成 `imported`。
- `ProjectWorkspace` 里“测试流程”按钮和启动函数都只允许 `active`，导致导入后无法继续从草稿页跳转到 `intent-e2e` 工作台验证。

## 本轮目标
- 允许 `active` 和 `imported` 的意图草稿都可以继续发起“测试流程”。
- 只阻止重复“导入正式任务”，不阻止已导入草稿继续测试。

## 验收标准
- [ ] 已导入草稿在列表和详情里的“测试流程”按钮保持可点。
- [ ] 已导入草稿触发 `runIntentDraftTestFlow()` 时不再报“当前草稿已不可直接发起测试流程”。
- [ ] 仍然不允许已导入草稿再次点击“导入正式任务”。

## 范围
- 会改：
  - `lib/intent-e2e-draft-launch.ts`
  - `components/ProjectWorkspace.tsx`
  - `tests/unit/intent-e2e-draft-launch.spec.ts`
- 不会改：
  - 意图草稿导入服务端逻辑
  - 正式任务执行链路

## 验证
- `npx vitest run tests/unit/intent-e2e-draft-launch.spec.ts`
- `npm run build`
- `npm run build:web`
