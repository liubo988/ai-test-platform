# Task Brief

## 标题
- AI 生成 needs_fixture 启动契约与图片路由指标收口

## 背景
- `modal_or_drawer_save` 当前主要失败不是 OCR 或 selector，而是前置订单数据缺口。
- repeated-failure suppression 已能把连续 data gap 推荐为 `needs_fixture`，但启动决策 API / 工作台文案还缺直接契约覆盖。
- 用户主要通过“AI生成”按钮发起自然语言 + 图片请求，需要单独观察 with-image 请求是否被路由到已治理 family，不能只看总体 terminal pass rate。

## 本轮目标
- 把 `recent_repeated_data_block -> needs_fixture` 补成 launch-decision API 和工作台可见契约。
- 在 traffic-quality 报表中增加图片请求 route hit / gate / terminal 指标，作为后续 OCR 和文档 family 治理分母。

## 验收标准
- [x] `resolveIntentE2ELaunchDecision(...)` 对 repeated data gap 返回 `needs_fixture`。
- [x] `POST /api/intent-e2e/launch-decision` 会把 repeated data gap 的 suppress 结果透传给最终启动决策，并记录 traffic-quality。
- [x] 工作台能把 `recent_repeated_data_block` 显示成前置数据缺口，而不是未知 reason。
- [x] traffic-quality report 输出 `imageRouteMetrics`，统计 real_click with-image 请求的 tracked family 命中率、launch gate 通过率和 terminal 通过率。

## 范围
- 会改：
  - `components/IntentE2EWorkbench.tsx`
  - `lib/intent-e2e-traffic-quality.ts`
  - `tests/unit/intent-e2e-launch-decision.spec.ts`
  - `tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
  - `tests/unit/intent-e2e-traffic-quality.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 会验证但不改：
  - `lib/intent-e2e-launch-decision.ts`
  - `app/api/intent-e2e/launch-decision/route.ts`
- 不会改：
  - 数据库 schema
  - 新增外部依赖
  - live UAT fixture seed
  - release guard baseline

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Post Phase 22，真实 AI 生成流量口径、top family 选择与可守护治理。
- 对应小步：把 modal data gap 前移到“AI生成”启动决策；补图片请求成功率分母。
- 本轮完成后回写：最新一条 roadmap 更新。

## 验证
- `npx vitest run tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts`
- `npx vitest run tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-release-guard.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `bash scripts/check-boundaries.sh`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30 --json`
- `npm run intent:release-guard:preflight`
- `npm run intent:knowledge-hit-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit-guard.json`
- `npm run intent:release-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json`
- `npm run intent:release-status -- --require-current-compare --json`

## 风险 / 未覆盖
- `imageRouteMetrics` 只统计“with-image 请求是否路由到 tracked family”，不声称 OCR 一定被使用；OCR 显式 used-rate 仍需要后续在 ScenarioCard 生成链路写入稳定元数据。
- 本轮不创建 UAT 订单 fixture；没有可用业务数据时，modal family 仍应返回 `needs_fixture` 或保持 data-blocked。

## 完成后动作
- 回写 roadmap。
- 刷新 traffic-quality report，确认图片指标进入 JSON / Markdown 报表。
