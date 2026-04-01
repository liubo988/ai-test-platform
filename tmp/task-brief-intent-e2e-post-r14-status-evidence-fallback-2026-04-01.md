# Task Brief

## 标题
- post-R14 商机列表状态证据 fallback 假阴性修复

## 背景
- 真实 run 已完成商机创建与列表命中，但 verifier 在 `businessId` 未从创建响应提取成功、列表响应又无法按手机号回查记录时，提前报出“状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口”。
- 当前失败会把已经跑通的业务动作误记成 `assertion_too_strict`，继续消耗 repair 配额。

## 本轮目标
- 收紧商机列表状态验收的 false negative：row 已命中时优先利用 `data-row-key` / 行内主键痕迹继续解锁详情页回退，同时补齐嵌套状态路径默认值。

## 验收标准
- [x] 状态字段默认 path 包含 `progress.displayStatus` 一类嵌套状态路径
- [x] row 已命中但 `businessId` 为空时，编译器会优先尝试 `data-row-key` 再回退行文本数字
- [x] 相关 unit tests 通过

## 范围
- 会改：
  - `lib/intent-execution-plan.ts`
  - `lib/intent-execution-compiler.ts`
  - `tests/unit/intent-execution-plan.spec.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
- 不会改：
  - DB schema
  - route contract
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：post-R14 bugfix
- 对应小步：状态证据 fallback 误判收口
- 本轮完成后回写：post-R14 bugfix 更新

## 计划修改点
- 扩展状态字段默认 JSON path
- 在状态 fallback 骨架里增加 `data-row-key -> 行内数字` 的保守主键派生

## 验证
- `npx vitest run tests/unit/intent-execution-plan.spec.ts tests/unit/intent-execution-compiler.spec.ts`
- `npm run build`

## 风险 / 未覆盖
- 本轮不补业务专属列表接口识别
- 本轮不调整 workbench 对中间 attempt 失败的展示语义

## 完成后动作
- 回写 roadmap

## 实际验证结果
- `npx vitest run tests/unit/intent-execution-plan.spec.ts tests/unit/intent-execution-compiler.spec.ts`
  - 通过，`23/23 passed`
- `npm run build`
  - 已通过

## 第二轮补充（repair prompt 对齐）
- 真实 run `intent-run-9048f08e-55bb-4b0d-b7bb-25714cc0baa8` 暴露出另一条仍在生效的旧链路：
  - slot repair prompt 仍在教模型使用旧的 `rowText-only derivedBusinessId`、旧的状态 paths，以及只读 `状态` 不读 `商机进展`
  - 因此即使编译器骨架已修，repair 产物仍会回退成旧脚本
- 本轮补充改动：
  - `lib/test-generator.ts`
  - `lib/intent-action-library.ts`
  - `tests/unit/test-generator.spec.ts`
  - `tests/unit/intent-action-library.spec.ts`
- 本轮补充验证：
  - `npx vitest run tests/unit/test-generator.spec.ts tests/unit/intent-action-library.spec.ts`
    - 通过，`83/83 passed`
  - `npm run build`
    - 通过

## 第三轮补充（split-search + list-json fallback 对齐）
- 最新真实 run `intent-run-71047aee-5c04-4e7e-bafb-e43baf8fe388` 暴露出两条剩余窄出口：
  - `Step 5` 仍会先手写一次 `fill + 搜索`，随后 `Step 6 / Verification` 又继续 `resolvePrimaryRecord(...)` 或 `waitForApiResponse + fill + click`
  - row 已命中、`derivedBusinessId` 已可得时，repair 仍会直接跳详情页；如果详情页自身抛 `Cannot read properties of null (reading 'forEach')`，脚本会继续丢失本可从列表 JSON 回填出来的状态证据
- 本轮补充改动：
  - `lib/test-generator.ts`
    - 补强 generate / repair guidance：
      - 前置 `plan_step_5` 若已手写检索，后续 `Step 6 / Verification` 不得再做第二次搜索
      - row 已命中且 `derivedBusinessId / resolvedBusinessId` 可得时，先在同一份 `listJson` 上做 `pickJsonRecord(...paths=['businessId','id'])` 回填，再决定是否开详情
  - `lib/intent-action-library.ts`
    - 在 `assert.resolve-primary-record` 能力说明与示例里同步补上：
      - “前一步缓存列表响应，后一步不得再二次检索”
      - `matchedRecordByResolvedBusinessId` 的结构化列表 JSON 回填
  - `lib/intent-execution-compiler.ts`
    - 对 `switchBusinessListOwnershipView` 步骤指令补一条显式约束：
      - 若后续 assert / verification 已会用 `__e2e.resolvePrimaryRecord(...)`，当前步骤只做切视角 + ready，不再手写第二条检索链
  - 新增/更新单测：
    - `tests/unit/test-generator.spec.ts`
    - `tests/unit/intent-action-library.spec.ts`
    - `tests/unit/intent-execution-compiler.spec.ts`
- 本轮补充验证：
  - `npx vitest run tests/unit/test-generator.spec.ts tests/unit/intent-action-library.spec.ts tests/unit/intent-execution-compiler.spec.ts`
    - 通过，`100/100 passed`
  - `npm run build`
    - 通过
  - live rerun：`intent-run-f5c46da7-2409-4e94-8394-817162acfb47`
    - 未进入 generate / repair，前置检查即被环境阻塞：
      - `页面前置检查失败: 目标页面当前处于环境异常或服务不可用状态。`
    - 结论：这次 live rerun 不能作为本轮代码修复是否生效的信号，需要等环境恢复后再复跑同一业务流

## 第四轮补充（compiler fallback instruction 对齐）
- 最新真实 run `intent-run-4b88c42b-c57d-44c9-b9c9-db8bafbc8c27` 暴露出另一条还在生效的旧出口：
  - generate 阶段产出的 `plan_step_5` 仍沿用了旧的手机号 fallback 骨架：
    - 只写到 `statusEvidenceRecordCheck`
    - `matchedRecord` 按手机号未命中后，直接回落到 `throw new Error('状态证据缺失：列表行已命中，但列表响应未返回状态')`
  - 根因不是 runtime helper，而是 compiler 给 `fallback shared variable + resolvePrimaryRecord` 这条指令还没明确教到：
    - `rowKey -> derivedBusinessId`
    - `listJson -> matchedRecordByDerivedBusinessId`
- 本轮补充改动：
  - `lib/intent-execution-compiler.ts`
    - 对“手机号 / 联系人 fallback shared variable”场景补强 step / verification 指令：
      - row 已命中、列表响应已返回但手机号未命中时，必须先尝试 `data-row-key` + `rowText` 派生 `derivedBusinessId`
      - 优先在同一份 `listJson` 上做 `matchedRecordByDerivedBusinessId`
      - 只有结构化列表 JSON 回填仍失败时，才继续走 `detailUrl / detailEntry`
  - `tests/unit/intent-execution-compiler.spec.ts`
    - 新增断言，锁住 compiler 模板里必须出现：
      - `recordCheck.row.getAttribute('data-row-key')`
      - `matchedRecordByDerivedBusinessId`
      - `matchedRecord || matchedRecordByDerivedBusinessId`
- 本轮补充验证：
  - `npx vitest run tests/unit/intent-execution-compiler.spec.ts`
    - 通过，`13/13 passed`
  - `npm run build`
    - 通过
