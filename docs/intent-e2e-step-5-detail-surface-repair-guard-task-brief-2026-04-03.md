# Task Brief

## 标题
- post-R14 success hardening：Step 5 detail-surface repair-guard rerun 收口

## 背景
- `2026-04-03` forced replay `intent-run-88325a3e-f541-4046-b0c8-4dd1ade87dbd` 已确认：
  - runtime / worker 侧的 invalid detail surface guard 已真实进入主链路
  - 但 repair 仍会生成旧的 `page.goto(detailUrl) + readDetailField(...)` 分支
  - 最终失败仍停在泛化口径：
    - `状态证据缺失：列表行已命中，但列表响应、详情抽屉与详情页都未返回状态`
- 现场关键证据已经很明确：
  - 已进入 `#/business/detail/:id`
  - 已出现 `Cannot read properties of null (reading 'forEach')`
  - 已出现 `detail surface invalid page`
- 说明当前剩余阻塞不在 helper/runtime，而在 repair/slot patch 指导还没有把 guard 真写进 `detailUrl` fallback。

## 本轮目标
- 只收 repair / slot patch 对 `detailUrl` fallback 的最小指导缺口。
- 当当前链路已知 `detailSurface.titleIncludes=商机详情` 时，强制 repair 先写：
  - `waitForVisibleDetailSurface(...)`
  - `if (!detailSurface) throw new Error('详情页无效：detailUrl 未出现商机详情 surface')`
- 再补 `1` 次真实 forced rerun，确认最终失败口径从泛化 `状态证据缺失` 收口到显式 invalid detail surface。

## 验收标准
- [ ] `lib/test-generator.ts` 的通用 detailUrl 指导不再鼓励裸 `page.goto + readDetailField`
- [ ] repair prompt 对两类真实失败签名都能补 `waitForVisibleDetailSurface(...)` + `详情页无效...`
- [ ] 单测覆盖：
  - 已进入 detail route 但仍回抛“未提供详情入口”
  - 泛化 `状态证据缺失：列表行已命中，但列表响应、详情抽屉与详情页都未返回状态`
- [ ] 真实 forced rerun 终态升级为：
  - `详情页无效：detailUrl 未出现商机详情 surface`

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - `lib/test-worker.mjs`
  - `lib/intent-execution-compiler.ts`
  - DB / API 契约
  - 其它 family 的 verifier 语义

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`
- `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening
- 对应小步：`Step 5 detail-surface repair-guard rerun closure`
- 本轮完成后回写：
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
  - `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`

## 计划修改点
- 通用 prompt：
  - 把 detailUrl 详情链统一收口成 `goto -> waitForVisibleDetailSurface -> readDetailField`
- repair diagnosis：
  - 对真实的泛化 `状态证据缺失` 和“已进 detail route 但仍回抛未提供详情入口”补定向 guard 提示
- 单测：
  - 更新旧断言
  - 新增真实失败签名回归
- 真实验证：
  - 用同一 draft 再跑 `1` 次 forced rerun

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
- forced rerun：
  - `intent-run-13f62e93-0ee4-42cb-98b8-135407603d87`

## 风险 / 未覆盖
- 本轮不解决业务侧 `null.forEach` 根因
- 本轮不保证真实 run 直接通过
- 本轮只要求把最终失败口径升级为显式 invalid detail surface，后续是否补 `detailEntry / detailReadyLocator` 另开一刀
