# Task Brief

## 标题
- batch-account bookedMgmt 订单号存在性校验改为允许多条合法命中

## 背景
- `intent-run-822e7e5b-e11f-4ed1-8f37-ea680dd0faca` 已证明“推进更远脚本复用”生效，run 不再退回前半段。
- 当前新的 deterministic blocker 稳定停在 `Step 7`：`入账列表未找到订单号=202604011028194322 的记录`。
- 真实运行日志显示 bookedMgmt 列表里同一订单号可能合法出现多条记录；当前 helper / 验收脚本仍把这类场景视为“多条唯一记录冲突”，这和需求“至少存在一条订单号等于目标值的记录”不一致。

## 本轮目标
- 把 batch-account 在 bookedMgmt 的订单号验收从“唯一命中”收口为“存在性命中”。
- 保持最小改动：只放宽 `selectedOrderNo` 这条 existence-only 校验链，不改其他需要唯一命中的通用表格 helper 语义。

## 验收标准
- [ ] Step 7 canonical `resolvePrimaryRecord(...)` 骨架会对 `shared.selectedOrderNo` 开启 `allowMultipleUniqueMatches`
- [ ] Step 8 / final verification 里基于 `shared.selectedOrderNo` 的直接 `findAntdTableRow(...)` 也会允许多条合法命中
- [ ] 新增 regression 能直接复刻 `822e...` 这类 bookedMgmt 多条同订单号记录场景并通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - DB schema
  - route / UI
  - 通用 `findAntdTableRow` 默认“多条唯一记录即失败”的基线语义

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 后续 batch-account hardening 补漏
- 对应小步：bookedMgmt 订单号存在性校验从唯一命中收口为 existence-only 命中
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 调整 batch-account Step 7 canonical 回查骨架，自动给 `resolvePrimaryRecord(...)` 注入 `allowMultipleUniqueMatches: true`
- 新增 batch-account existence-only sanitizer，把 Step 8 / verification 里 `shared.selectedOrderNo` 的直接 `findAntdTableRow(...)` 也收口为允许多条合法命中
- 补充 `822e...` 风格 regression

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 这轮只修“存在性校验过严”，不处理如果 bookedMgmt 后续还会出现详情字段 / 金额一致性的新 blocker。
- 这轮不修改 `findAntdTableRow` 的默认歧义失败语义，避免误伤其他需要唯一命中的业务流。

## 完成后动作
- 回写 roadmap
- 重新跑同一条 `订单批量入账到入账管理核对` 草稿，确认 blocker 不再停在 Step 7 的“多条记录误判失败”
