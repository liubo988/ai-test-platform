# Task Brief

## 标题
- post-R14 success hardening：Step 7 row-action detail surface title/ready relaxation

## 背景
- `Step 6 business detail-entry default knowledge` 已确认真实命中：
  - forced rerun `intent-run-f271ee22-6ff8-45d7-be2e-ee5015d7fc0e`
  - 生成阶段已打印：
    - `命中 1 条项目知识规则：新建商机后列表状态回查`
  - 首轮执行已出现：
    - `row action clicked`
- 当前新的真实首轮失败已前移为：
  - `未找到可见弹框: titleIncludes=商机详情`
- 同一条 run 的后续 repair 已额外暴露：
  - 这条链需要：
    - `waitForVisibleAntdModal(... required: false)`
    - modal miss 后再回退 `waitForVisibleDetailSurface(...)`
  - 现有 `waitForVisibleAntdModal` 实现并不支持 `required: false`
- 因此本轮目标不是继续扩知识，也不是处理后续 repair 漂移；只把 detail surface ready 过严这条链正式前置到首轮模板与执行 helper。

## 本轮目标
- 放宽 row-action 详情入口后的 detail surface ready 判定：
  - `商机详情` 允许按保守标题候选匹配，例如 `商机`
  - `waitForVisibleAntdModal` 支持 `required: false`
  - drawer/modal miss 后，首轮模板可回退到 `waitForVisibleDetailSurface(...)`
- 保持最小改动：
  - 不改 `project knowledge` 结构
  - 不扩新 route / DB / runtime 治理
  - 不并行处理 `抖音` 下拉枚举问题

## 验收标准
- [ ] `waitForVisibleAntdModal` 支持 `required: false`
- [ ] detail title 支持 `商机详情 -> 商机` 这类保守放宽
- [ ] compiler 对 `detailEntry.target=drawer_or_modal` 且有详情标题时，生成：
  - 先试 `waitForVisibleAntdModal(... required: false)`
  - 再回退 `waitForVisibleDetailSurface(... required: false)`
  - 两者都失败时显式抛“查看后未出现可用详情弹层或详情页”
- [ ] 单测覆盖 helper 行为与 compiler 代码骨架

## 范围
- 会改：
  - `lib/test-worker.mjs`
  - `lib/intent-execution-compiler.ts`
  - `tests/unit/test-executor.spec.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
- 不会改：
  - `intent-e2e.project-knowledge.json`
  - `lib/intent-project-knowledge.ts`
  - `DB / API 契约`
  - `商机来源=抖音` 相关生成逻辑

## 验证
- `npx vitest run tests/unit/test-executor.spec.ts -t "visible antd modal"`
- `npx vitest run tests/unit/intent-execution-compiler.spec.ts`
- `npm run build`
- 若代码验证通过，再用同一真实场景 forced rerun 继续确认 failure 是否从 `title/ready` 再前移
