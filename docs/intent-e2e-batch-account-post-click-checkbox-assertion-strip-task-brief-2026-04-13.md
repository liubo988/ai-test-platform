# Task Brief

## 标题
- batch-account 去掉 `clickAntdRowCheckbox(...)` 之后的脆弱 checked-locator 复验

## 背景
- `intent-run-b54cd539-8eac-49ab-bd4f-e8666334a313` 最终没有成功，终态是 task-platform 总超时；但最后一条已落盘的 repair result 已经给出新的 deterministic blocker。
- 现场 logs 明确显示 `__e2e.clickAntdRowCheckbox(page, targetRow)` 已经成功，helper 记录的是 `rowKey=461804` 且日志中已经出现 `row checkbox clicked`。
- 生成脚本随后又重新从 `targetRow` 读取 `data-row-key`，拿到重渲染后的 `461730`，再去断言 `locator('tr[data-row-key="461730"] .ant-checkbox-checked:visible')`，最终把已经成功的勾选误判成失败。

## 本轮目标
- 去掉 batch-account 中这类“helper 勾选成功后，又按 rowKey 手写 checked-locator 复验”的脆弱模式。
- 保留 `__e2e.clickAntdRowCheckbox(...)` 作为唯一的勾选成功证据，避免列表重渲染后 rowKey 漂移把成功结果翻成失败。
- 用单测固定这次 live 失败代码形态，防止 repair 再生成同类后置断言。

## 验收标准
- [ ] `clickAntdRowCheckbox(...)` 之后不再保留按 `rowKey` 查 `.ant-checkbox-checked` / `.ant-checkbox-wrapper-checked` 的可见性断言
- [ ] 新增 generator regression 可稳定复刻“rowKey 重读后漂移”的 live 代码并通过
- [ ] 生成代码仍保留 `clickAntdRowCheckbox(...)` 本身

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - route / UI
  - `lib/test-worker.mjs`
  - task-platform 总超时策略

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 后续 batch-account hardening 补漏
- 对应小步：行勾选 helper 后置 checked-locator 复验收口
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 新增 sanitizer，清理 `clickAntdRowCheckbox(...)` 成功后又按 `rowKey` / `.ant-checkbox-checked` 复验的代码块
- 新增 live regression，固定这次 Step 2 的 rowKey 漂移模式
- 回写这次 run 最后一次已落盘 attempt 的失败证据

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 这轮不保证 `intent-run-b54cd539-8eac-49ab-bd4f-e8666334a313` 已启动的旧代码 run 会恢复成功；它需要新的 rerun 才能吃到修复。
- 这轮只收口 helper 后置 checked-locator 复验，不处理更后面的 bookedMgmt 回查或字段断言问题。

## 完成后动作
- 回写 roadmap
- 基于这版继续观察 batch-account rerun 是否已跳过 Step 2 的 rowKey 漂移误判
