# Task Brief

## 标题
- 修复多变量 `extractVariable` 被当成单个 shared key 的编译回归

## 背景
- 真实订单/批量入账类 flow 会在同一步同时提取 `selectedOrderNo`、`selectedServiceItem`、`selectedAmount`。
- 之前的执行链路里，逗号分隔的 `extractVariable` 可能被当成一个整体 key 继续传递，最终产出类似 `shared['selectedOrderNo,selectedServiceItem,selectedAmount']` 的错误脚本。
- 这会同时打坏 shared variable materialization、variable verification checks，以及批量入账弹窗的 scoped 验收提示。

## 本轮目标
- 抽出共用变量拆分 helper，统一处理多变量 `extractVariable`。
- 让 `intent-action-dsl`、`intent-execution-plan`、`intent-execution-compiler` 都按独立变量名工作，而不是把整串值继续向下游传递。
- 用最小单测锁住：
  - merged shared key 不再回归
  - 批量入账订单号提取与 modal scoped 校验提示不再退回旧骨架

## 验收标准
- [x] `collectFlowVariableNames(...)` 能稳定拆分逗号、换行和中文分隔符变量串。
- [x] execution plan / verification plan 会把多变量拆成独立 shared variables 与 variable checks。
- [x] compiler 不再输出 merged shared key，并会补订单号提取与批量入账弹窗 scoped 校验提示。
- [x] 受影响 unit tests 与 `npm run build` 通过。

## 范围
- 会改：
  - `lib/task-flow.ts`
  - `lib/intent-action-dsl.ts`
  - `lib/intent-execution-plan.ts`
  - `lib/intent-execution-compiler.ts`
  - `tests/unit/task-flow.spec.ts`
  - `tests/unit/intent-execution-plan.spec.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - UI 页面层
  - 旧 run 产物回写

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-row-checkbox-selection-task-brief-2026-04-09.md`

## Roadmap 对齐
- 当前阶段：R7 后真实 run 缺陷收口
- 对应小步：批量入账订单字段提取与多变量 shared 收口
- 本轮完成后：不单独回写 roadmap，先通过 rerun 观察真实收益

## 计划修改点
- 在 `task-flow` 增加共用变量名拆分 helper。
- 在 DSL / execution plan / verification plan 接统一拆分逻辑。
- 在 compiler 对多变量写入、订单号提取和批量入账 modal 验收补最小收口提示。
- 补最小 regression specs，锁住 `shared['a,b,c']` 类回归。

## 验证
- `npx vitest run tests/unit/task-flow.spec.ts tests/unit/intent-action-dsl.spec.ts tests/unit/intent-execution-plan.spec.ts tests/unit/intent-execution-compiler.spec.ts`
- `npm run build`

## 风险 / 未覆盖
- 这刀只收口 planner/compiler/verification 链路，不会自动修复已经落盘的旧 run 代码。
- 真实 run 若仍失败，需要继续追 `lib/test-generator.ts` / repair prompt 是否还在复用旧断言骨架。

## 完成后动作
- 用新的 compiler 输出重新观察失败 run 是否从“merged key / 错字段断言”前进到下一层。
- 若 rerun 仍复用旧 modal 全文断言骨架，再继续收口 generate / repair 提示层。
