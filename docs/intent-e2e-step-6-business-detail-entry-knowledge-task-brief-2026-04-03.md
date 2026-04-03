# Task Brief

## 标题
- post-R14 success hardening：Step 6 business detail-entry default knowledge 收口

## 背景
- `2026-04-03` forced rerun `intent-run-13f62e93-0ee4-42cb-98b8-135407603d87` 已确认：
  - `detailUrl` invalid surface guard 已真实进入 repair 主链路
  - 当前终态已经显式收口为：
    - `详情页无效：detailUrl 未出现商机详情 surface`
- 继续查看同一条 run 证据后可以确认：
  - 当前默认 knowledge 资产没有这条 family 的显式 `detailEntry / detailReadyLocator`
  - verification / repair prompt 虽然已经知道 `商机详情` surface，但还没有项目级“列表行 -> 查看 -> 商机详情”的固定入口提示
- 当前最小下一刀不应继续扩 runtime，也不应把 `business/detail` 直接标成 blocker；先补一条显式 knowledge，验证 prompt 能稳定看到这条详情入口链。

## 本轮目标
- 只补默认 project knowledge 中“新建商机后回列表校验商机进展”的显式详情入口 hint。
- 让 prompt / DSL / verification 上下文都能看到：
  - `detailEntry{ trigger=row_action; actionLabel=查看; target=drawer_or_modal }`
  - `detailReadyLocator.textIncludes=商机详情`
  - `商机进展 -> 状态` 的详情字段读取优先级
- 先完成 code/test/documentation 收口；真实 rerun 是否继续，等本轮验证后再定。

## 验收标准
- [ ] 默认 `intent-e2e.project-knowledge.json` 新增一条只命中该 family 的规则
- [ ] 规则同时包含：
  - `promptNotes`
  - `addGlobalRules`
  - `stepPatches`
  - `recordLookupHints`
  - `detailSurfaceHints`
- [ ] 单测直接读取默认 knowledge，并验证：
  - 命中该规则
  - `detailEntry / detailReadyLocator` 被解析出来
  - 生成 prompt 中出现该规则的显式详情入口指导

## 范围
- 会改：
  - `intent-e2e.project-knowledge.json`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - `lib/test-worker.mjs`
  - `lib/intent-execution-compiler.ts`
  - `lib/test-generator.ts`
  - DB / API 契约

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`
- `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening
- 对应小步：`Step 6 business detail-entry default knowledge code/test validation`
- 本轮完成后回写：
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
  - `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`

## 计划修改点
- 默认 knowledge：
  - 新增“新建商机后列表状态回查”规则
  - 用 promptNotes 和 addGlobalRules 显式固定“列表行 -> 查看 -> 商机详情 -> 读商机进展”
- step patch：
  - 只对 `assert` 且带 `商机进展 / 新入库 / 我创建的` 的步骤加详情入口 helper 提示
- 结构化 hint：
  - `recordLookupHints.detailEntry`
  - `recordLookupHints.detailReadyLocator`
  - `detailSurfaceHints.titleIncludes=商机详情`
- 单测：
  - 直接读取默认 knowledge 文件，验证命中和 prompt 展示

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts -t "business create status detail-entry default project knowledge"`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不保证真实 rerun 直接通过
- 本轮不解决 `business/detail` 自身错误页 / 权限页根因
- 本轮不把该 family 直接升级成项目级专属 asset 文件，先只补默认 fallback knowledge
