# Task Brief

## 标题
- 修复最终列表回查把额外 GET 响应当成硬前提导致的误失败

## 背景
- 真实 run 已出现“页面动作与最终数据都已完成，但 repair/verification 仍因 `page.waitForResponse` 超时失败”的情况。
- 当前失败模式不是业务动作未完成，而是脚本把最终列表回查写成了“必须等到新的列表 GET 才算成功”。

## 本轮目标
- 收口 `intent-e2e` 生成 / repair 提示，避免最终列表验收继续手写 `waitForApiResponse + fill + click + await response` 这条硬链。
- 引导优先复用 `currentVisibleRow` / `artifacts` / `__e2e.resolvePrimaryRecord(...)`，把额外列表 GET 降为辅助证据，而不是成功前提。

## 验收标准
- [ ] repair prompt 会对“最终列表回查硬等 GET 超时”给出明确修法
- [ ] compiler 约束会显式禁止把额外列表 GET 当最终验收前提
- [ ] 最小单测通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `lib/intent-execution-compiler.ts`
  - `tests/unit/test-generator.spec.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - UI 展示层
  - 无关 helper 语义

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 后的高成功率收尾 / 真实 run 缺陷修补
- 对应小步：收口“最终列表回查”误失败模式
- 本轮完成后：不单独回写 roadmap，只做缺陷收口

## 计划修改点
- 在 repair prompt 增加“最终列表回查硬等 GET 超时”的定向诊断
- 在 compiler 约束里明确“最终列表验收优先复用 currentVisibleRow / artifacts / resolvePrimaryRecord”

## 验证
- `npm run build`
- `npx vitest run tests/unit/test-generator.spec.ts tests/unit/intent-execution-compiler.spec.ts`

## 风险 / 未覆盖
- 本轮不改变 runtime helper 的底层等待语义
- 只收口“额外列表 GET 被当成硬前提”的失败，不处理其它真实网络慢或接口未返回问题

## 完成后动作
- 如真实 run 继续复现，再沿失败脚本定位是否还存在“语法合法但语义过期”的旧骨架复用
