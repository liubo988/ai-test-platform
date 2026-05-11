# Task Brief

## 标题
- Post Phase 22 modal 数据缺口 hash 路由与 needs_fixture 守护

## 背景
- `modal_or_drawer_save` 当前失败主因已经定位为：订单列表按 `待申请` 筛选后没有可勾选订单行。
- 现有 repeated-failure suppression 能把连续 `data_missing` 收口成 `needs_fixture`，但 insights 的 `targetPath` 只取 URL pathname，导致 `https://.../#/order/list` 被归一成 `/`。
- 对 SPA hash 路由来说，这会削弱失败聚类的精度，也会让不同业务页的重复失败更容易混在一起。

## 本轮目标
- 修正 insights / repeated-failure suppression 的 target path 归一逻辑，让 hash route `#/order/list` 归到 `/order/list`。
- 补一条 modal 数据缺口样例测试，固定两次 `data_missing` 后推荐 `needs_fixture`，避免继续 auto-run。

## 验收标准
- [x] `https://uat-service.yikaiye.com/#/order/list` 在 repeated-failure suppression 中归一为 `/order/list`。
- [x] 连续 modal data gap 被归到 `data_blocked`，推荐决策为 `needs_fixture`。
- [x] 不改变已有 model-quality 重复失败降级为 `draft_only` 的逻辑。
- [x] 相关 unit tests 通过。

## 范围
- 会改：
  - `lib/ai/intent-e2e-insights.ts`
  - `lib/intent-e2e-benchmark.ts`
  - `tests/unit/intent-e2e-insights.spec.ts`
  - `tests/unit/intent-e2e-benchmark.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - launch-decision API contract
  - modal request corpus
  - release-guard baseline
  - UAT fixture / seed 脚本

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Post Phase 22，真实 `AI生成` 流量分母、family 归类和启动守护闭环。
- 对应小步：把 modal 数据缺口从“执行后失败”继续前移到 launch-decision 可消费的 `needs_fixture` 信号。
- 本轮完成后回写：第五百一十次更新。

## 本轮完成
- `normalizeTargetPath(...)` 现在优先识别 URL hash route：
  - `https://uat-service.yikaiye.com/#/order/list` -> `/order/list`
  - 保留普通 pathname URL 的既有行为。
- benchmark replay 的 cluster map 增加 legacy root-route lookup：
  - 新 hash route signature 可兼容旧 frozen baseline 中的 `...|/|...`。
  - 避免升级 target path 归一逻辑后，已冻结 release guard asset 因 signature 变化被误判为 missing evidence。
- 新增 repeated-failure suppression 单测：
  - 两条 `modal_or_drawer_save` / `/order/list` / `data_missing` 失败。
  - dominant bucket 为 `data_blocked`。
  - recommended decision 为 `needs_fixture`。
  - representative runs 保持最新失败优先。

## 验证
- `npx vitest run tests/unit/intent-e2e-insights.spec.ts`
  - 通过，`49` tests。
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-insights.spec.ts`
  - 通过，`2` files / `64` tests。

## 风险 / 未覆盖
- 本轮不创建订单 fixture，也不把 modal family 纳入 release guard。
- 如果只有一次 data gap，当前策略仍不会立刻 suppress；需要连续数据阻断，避免单次偶发空数据把后续真实可运行请求全部挡掉。
- 真正提升 modal terminal pass 的下一步仍是 fixture / seed / precheck，而不是继续调 prompt。

## 完成后动作
- 回写 roadmap。
- 继续跑 release guard / release status 和全量相关校验，确保已治理 4-family 不受影响。
