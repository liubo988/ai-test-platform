# Task Brief

## 标题
- Post Phase 22 真实 AI 生成流量 family 归因回填

## 背景
- `business_batch_add_contacts_verify` 已完成 tracked corpus、playbook evidence 和 release guard 接线。
- 最新 30 天 traffic-quality 报告仍显示 `real_click / auto_run / untracked` 有 13 次 launch 和 13 次 auto-run，但逐条查看事件后确认它们都是这条“商机批量加入通讯录”请求在 family 接入前写入的旧 `untracked` 事件。
- 如果报告只按写入时 family 聚合，后续 top family 选择会继续被旧归因污染，影响 `AI生成` 成功率治理优先级。

## 本轮目标
- 报告生成时只对历史 `untracked` 事件做只读归因回填：使用当前请求路由规则从 `metadata.input / targetUrl` 重新识别 family。
- 不改原始 JSONL 事件日志，不改数据库 schema，不改变 launch / terminal 计数。

## 验收标准
- [x] 旧 `untracked` real_click 事件可以在报告 bucket 中归到当前可识别 family。
- [x] 无法识别的事件仍保持 `untracked`。
- [x] traffic-quality 报告刷新后，`business_batch_add_contacts_verify` 承接旧启动计数。
- [x] 相关 unit tests 与 TypeScript build 通过。

## 范围
- 会改：
  - `lib/intent-e2e-traffic-quality.ts`
  - `tests/unit/intent-e2e-traffic-quality.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 原始 `intent-e2e.traffic-quality-events.jsonl`
  - 数据库 schema
  - release-guard baseline 口径
  - UI / API contract

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Post Phase 22，真实 `AI生成` 流量分母、family 归类、guardable evidence 闭环。
- 对应小步：用当前路由规则修正历史 `untracked` 事件的报告归因，避免下一个 family 选择被旧口径误导。
- 本轮完成后回写：第五百零八次更新。

## 本轮完成
- `buildIntentE2ETrafficQualityReport(...)` 在聚合事件 bucket 前，对 `priorityScenarioFamily=untracked` 的事件调用当前 family route。
- 回填只使用事件 `metadata` 中已有的请求文本和目标 URL；只影响报告归类，不写回事件日志。
- 新增单测覆盖：旧 real_click `untracked` 的“批量加入通讯录 + 通讯录检索验证”请求会在报告中归到 `business_batch_add_contacts_verify`，且不再生成 `real_click / auto_run / untracked` bucket。

## 验证
- `npx vitest run tests/unit/intent-e2e-traffic-quality.spec.ts`
  - 通过，`5` tests。
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30 --json`
  - 通过，刷新报告：[intent-e2e.traffic-quality-report.latest.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.traffic-quality-report.latest.json)
  - `real_click / auto_run / business_batch_add_contacts_verify`：`launch=13 / auto=13 / terminal=21 / pass=19 / rate=90.5%`
  - `real_click / auto_run / untracked`：已消失
  - document selection 仍为 `no_document_candidates`
- `npx vitest run tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts tests/unit/intent-e2e-benchmark.spec.ts`
  - 通过，`25` tests。
- `npm run build`
  - 通过。

## 风险 / 未覆盖
- 这次修的是统计归因，不是直接提升某个执行器步骤的通过率。
- 旧失败仍会留在 30 天 raw pass rate 中；当前 release guard 的 4-family green window 仍是判断当前治理结果的主依据。
- document-like 真实流量仍未出现，本轮不创建文档 family 的伪基线。

## 完成后动作
- 回写 roadmap。
- 继续按真实 `AI生成` 流量选择下一条高收益 family，而不是对任意开放式文档/OCR 请求承诺 100%。
