# Task Brief

## 标题
- E1 recall sharpen：hash-route 页面归一化 + family 透传

## 背景
- 当前 benchmark baseline 已拿到，但 `experience_hit_rate=3.0%` 仍偏低。
- 复盘现有 `experience recall` 代码后，发现两个直接影响命中的缺口：
  - hash-route 目标页在 recall 中会退化成 `/`，削弱“同页面”命中。
  - `searchIntentE2EExperienceHints(...)` 支持 `scenarioFamily`，但主链路调用没有透传，削弱“同 family”命中。

## 本轮目标
- 只增强 `E1 recall` 的页面 / family 信号命中。
- 不改 benchmark 口径，不扩 route / UI，不进入 `E4 OCR`。

## 验收标准
- [ ] hash-route 目标页在 experience recall 中能稳定归一化为业务路径，而不是 `/`
- [ ] 主链路调用 experience recall 时会透传场景 family
- [ ] 相关 unit tests 和 build 通过

## 范围
- 会改：
  - `lib/intent-e2e-experience-search.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-experience-search.spec.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-experience-recall-playbook-plan-2026-04-09.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - DB schema
  - benchmark route / workbench UI
  - `E4 OCR / visual anchors` 大切片

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-experience-recall-playbook-plan-2026-04-09.md`

## Roadmap 对齐
- 当前阶段：后续专项 `E1/E2/E3` baseline 已有，开始做最小 recall sharpen
- 对应小步：基于 benchmark baseline 继续推进 `E1 experience recall` 的命中质量
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 统一 experience recall 的 `targetPath` 归一化，补齐 hash-route 解析
- 在主链路调用 `searchIntentE2EExperienceHints(...)` 时透传当前 family 信号
- 为上述两点补回归用例

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-experience-search.spec.ts tests/unit/intent-e2e-service.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不会直接提高 `playbook_hit_rate`；当前 `proj_default` 尚无已合并的 `intent.*` recipe
- 也不会补第二阶段 recall rerank 或 recipe-aware 二次召回

## 完成后动作
- 回写专项文档和 roadmap
- 若真实收益仍不足，再评估下一刀是否继续增强 recall scoring 或转入 `E4`
