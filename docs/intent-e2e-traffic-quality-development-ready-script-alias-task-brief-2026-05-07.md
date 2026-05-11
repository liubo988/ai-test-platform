# Task Brief

## 标题
- Traffic Quality development-ready npm alias and CLI help

## 背景
- `developmentGate.status` 已经可以机器化判断下一阶段是否有可开发候选。
- 自动化和人工回归仍需要记住 `--require-development-ready` 长参数，不利于稳定复用。

## 本轮目标
- 增加 development-ready 的稳定 npm 短命令。
- 给 traffic-quality CLI 增加 `--help`，明确 gate 参数和常用阈值。
- 同步 README / runbook，不改变 traffic-quality 报表语义。

## 验收标准
- [x] 可以运行 `npm run intent:traffic-quality -- --help` 查看参数。
- [x] 可以运行 `npm run intent:traffic-quality:development-ready -- --project-uid proj_default --window-days 30` 执行 gate。
- [x] 默认 `npm run intent:traffic-quality` 行为保持不变。

## 范围
- 会改：
  - `package.json`
  - `scripts/intent-e2e-traffic-quality-report.ts`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - release-readiness 报表语义
  - benchmark harness
  - document family verifier / OCR 主链路

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Post Phase 22 / traffic-quality development gate 收口
- 对应小步：把 gate 入口产品化为稳定 npm script
- 本轮完成后回写：第五百三十二次更新

## 验证
- `npm run intent:traffic-quality -- --help`
- `npm run build`
- `npm run intent:traffic-quality:development-ready -- --project-uid proj_default --window-days 30`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 当前 `proj_default` 的 gate 预期仍失败，因为 `developmentGate.status=no_admissible_code_work`。
- 该入口只阻断无证据开发，不负责制造真实流量样本。

## 完成后动作
- 回写 roadmap。
- 保持默认 traffic-quality report 和 release-readiness 既有口径不变。
