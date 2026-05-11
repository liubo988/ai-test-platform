# Task Brief

## 标题
- New Intent Readiness Gate and Failure Recovery Bootstrap

## 背景
- 当前 release-readiness 与 traffic-quality 已完成，但它们回答的是已治理 family 与真实流量分母问题。
- 用户关注的是“全新业务意图”通过 AI 生成按钮时，系统能否提前判断成功概率、缺口和失败补救路径。
- 这次优先做短周期、高收益的一刀：不扩展 document / OCR 主链路，只把新意图 readiness 契约接入 launch-decision 与独立报表。

## 本轮目标
- 建立 `newIntentReadiness` 统一契约，输出推荐模式、信心、缺失契约、失败补救类别和关键 signals。
- 在 `/api/intent-e2e/launch-decision` 返回与 traffic-quality metadata 中落下 readiness 摘要。
- 新增 CLI 生成最近窗口 new-intent readiness JSON / Markdown 报表，且按 source 分离 real_click / draft_import / benchmark_rerun / replay。

## 验收标准
- [x] AI 生成按钮的 launch-decision 响应包含 `newIntentReadiness`。
- [x] traffic-quality `launch_click_count` metadata 能记录 `newIntentReadiness`。
- [x] 新 CLI `npm run intent:new-intent:readiness` 能输出 JSON / Markdown 报表。
- [x] 单测覆盖 known family、document governed family、vague intent、fixture gap、unknown exploration 与 source 分桶。
- [x] 不改变 release-readiness、traffic-quality 成功率或 benchmark harness 既有口径。

## 范围
- 会改：
  - `lib/intent-e2e-new-intent-readiness.ts`
  - `app/api/intent-e2e/launch-decision/route.ts`
  - `lib/intent-e2e-traffic-quality.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `scripts/intent-e2e-new-intent-readiness.ts`
  - `tests/unit/intent-e2e-new-intent-readiness.spec.ts`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - benchmark harness
  - release-readiness completion summary
  - document family recipe / verifier / fixture 主链路
  - OCR route / verifier

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：post release-readiness / traffic-quality 收口后的新意图高成功率短周期增强。
- 对应小步：新意图 readiness gate 与失败补救 bootstrap。
- 本轮完成后回写：最新一条 roadmap 更新。

## 验证
- `npx vitest run tests/unit/intent-e2e-new-intent-readiness.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts`
- `npm run intent:new-intent:readiness -- --project-uid proj_default --input "登录后用手机号 13800001111 搜索商机，进入详情并校验状态字段可见" --target-url "https://uat-service.yikaiye.com/#/business/businesslist" --json`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`

## 风险 / 未覆盖
- 这是 readiness 契约与可见性第一刀，不保证任意未知业务意图都能一次性通过。
- 未新增任何新 family recipe，也未扩展 OCR/document 主链路。
- 历史 traffic-quality 事件没有 `newIntentReadiness` metadata 时，报表会按当前契约重算，只作为当前口径分析。

## 完成后动作
- 回写 roadmap。
- 更新 README / runbook 中的新 CLI 与工作流入口。
