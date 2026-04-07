# Task Brief

## 标题
- 收紧列表状态证据口径，禁止裸 `rowText` 直接判定成功

## 背景
- 当前 `business_create_list_verify` 相关脚手架在目标行命中后，允许把整行 `rowText` 里出现的 `新入库` 直接当作最终状态证据。
- 这会把“命中了一行包含状态文本的列表行”和“明确校验了同一条记录的状态字段”混在一起，导致最终 `success` 口径偏松。
- 用户当前需要更严格的验收标准：最终成功至少要落在以下证据之一：
  - 同一条结构化列表记录的状态字段
  - 详情页 / 详情抽屉字段
  - 若未来补了稳定的同一行状态单元格读取，也可作为可接受证据

## 本轮目标
- 去掉 `rowText` 裸命中后的直接成功短路。
- 保留 `rowText` 仅作为辅助线索，用于派生主键 / 详情回退，不再单独充当最终通过条件。
- 同步更新 compiler 指令、生成 / 修复 prompt、动作库示例与单测，避免旧口径继续被模型生成出来。

## 验收标准
- [ ] compiler 生成的状态回查骨架不再出现“`rowText` 命中即 success”的分支。
- [ ] prompt / 动作库不再教授“整行文本命中状态即可收口”。
- [ ] 相关 unit tests 覆盖并通过。

## 范围
- 会改：
  - `lib/intent-execution-compiler.ts`
  - `lib/test-generator.ts`
  - `lib/intent-action-library.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
  - `tests/unit/test-generator.spec.ts`
  - `tests/unit/intent-action-library.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - `ProjectWorkspace` / 草稿恢复控制台逻辑
  - 数据库 schema
  - 新增运行时 helper
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：status evidence success-criteria tightening
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- compiler 的 row status fallback 改成：
  - `rowText` 仅用于辅助派生 `derivedBusinessId`
  - 最终状态只接受 `listJson / matchedRecord` 或 `detailField`
- prompt / action library 明确：
  - `rowText` 只能作为辅助线索
  - 不得再把裸 `rowText` 当最终成功条件

## 验证
- `npx vitest run tests/unit/intent-execution-compiler.spec.ts tests/unit/test-generator.spec.ts tests/unit/intent-action-library.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不新增“同一行状态单元格读取” helper，因此会比旧口径更保守。
- 若未来要兼顾严格性与更高通过率，可再单独收“状态单元格读取”一刀。

## 完成后动作
- 回写 roadmap
