# Task Brief

## 标题
- Document sample scout for gate-safe continuation

## 背景
- 当前 `next-dev` gate 仍为 `no_admissible_code_work`。
- 完整 90 天 traffic-quality DB 查询曾遇到连接中断/长等待，不适合作为每次继续开发前的快速判断。
- 需要一个不连接数据库的轻量入口，直接用 traffic-quality JSONL 和 formal-task seed audit 判断是否有 document-like 样本线索。

## 本轮目标
- 新增 document sample scout 纯逻辑与 CLI。
- 支持扫描 30/90/365 等多个窗口。
- 输出 document-like `real_click` 数量、formal document-like seed 数量、top real-click family 概览和下一步建议。

## 验收标准
- [x] 命令不连接数据库，只读取事件日志和 formal-task seed audit。
- [x] 30/90/365 天窗口能分别输出 document-like `real_click` 数量。
- [x] 没有 document-like real_click / formal seed 时，明确给出 `collect_document_real_click`。
- [x] 单测覆盖 document real-click、formal seed fallback 和无信号阻断三类分支。

## 范围
- 会改：
  - `lib/intent-e2e-document-sample-scout.ts`
  - `scripts/intent-e2e-document-sample-scout.ts`
  - `tests/unit/intent-e2e-document-sample-scout.spec.ts`
  - `package.json`
  - README / runbook / prep / roadmap
- 不会改：
  - document family recipe / fixture / verifier
  - OCR 主链路
  - traffic-quality 完整报表语义
  - release-readiness 语义

## 验证结果
- `npx vitest run tests/unit/intent-e2e-document-sample-scout.spec.ts`
  - 通过，`1` file / `3` tests。
- `npm run intent:document-sample:scout -- --project-uid proj_default --windows 30,90,365`
  - 通过，`recommendation=collect_document_real_click windows=30d:0/88 90d:0/88 365d:0/88 formal_document_like=0`。
- `npm run build`
  - 通过。
- `npm run build:web`
  - 通过。
- `node scripts/check-doc-links.mjs`
  - 通过。
- `node scripts/check-roadmap-progress.mjs`
  - 通过。

## 当前阶段状态
- 已有一个 gate-safe 的 document sample scout 入口。
- 当前项目仍没有 document-like real_click 或 formal seed，因此仍不能启动 document / OCR / verifier 开发。

## 风险 / 未覆盖
- scout 是轻量准入扫描，不计算 terminal pass rate，也不替代完整 traffic-quality。
- 如果 event log 缺失历史事件，只能以当前 JSONL 为准；正式结论仍以完整 traffic-quality + release-status 为准。

## 完成后动作
- [x] 跑 build、文档链接、roadmap 检查。
