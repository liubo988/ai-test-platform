# Task Brief

## 标题
- 意图草稿测试流程不再被项目 cold-start 资产误拦截

## 背景
- 用户从“意图草稿”执行“订单批量入账到入账管理核对”等草稿时，被 `needs_bootstrap` 拦截。
- 这些草稿已经带有 ScenarioCard / 首轮脚本等可复用草稿资产，不应按全新意图的项目冷启动资产口径硬拦截。

## 本轮目标
- 保留全新意图的项目 cold-start 保护。
- 让显式从意图草稿发起、且带可执行草稿资产的测试流程不再被 `needs_bootstrap` 阻断。

## 验收标准
- [x] launch decision 能识别草稿可执行资产提示。
- [x] 草稿 URL 上历史 `needs_bootstrap` 查询参数不会继续硬阻断草稿恢复。
- [x] 受影响单测、构建和前端构建通过。

## 范围
- 会改：
  - `lib/ai/intent-e2e-request.ts`
  - `lib/intent-e2e-launch-decision.ts`
  - `lib/intent-e2e-draft-launch.ts`
  - `app/api/intent-e2e/launch-decision/route.ts`
  - `components/IntentE2EWorkbench.tsx`
  - 相关 unit tests
- 不会改：
  - 数据库 schema
  - benchmark harness
  - release-readiness 口径
  - document family / OCR 主链路

## Roadmap 对齐
- 当前阶段：最终交付后的观测与缺口修复状态。
- 对应小步：修复真实草稿启动 gate 误拦截。
- 本轮完成后回写：`docs/intent-e2e-high-success-roadmap-2026-03-20.md` 最新进度。

## 验证
- `npx vitest run tests/unit/intent-e2e-request.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-draft-launch.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只放行带草稿资产的意图草稿测试流程；不改变全新意图缺项目资产时的 `needs_bootstrap` 行为。
- 若部署环境缺少项目知识文件，后续仍应补齐资产以提升新意图成功率。

## 完成后动作
- 回写 roadmap。
- 在最终回复中说明根因、改动与验证结果。
