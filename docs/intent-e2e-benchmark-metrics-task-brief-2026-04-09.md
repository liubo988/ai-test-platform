# Task Brief

## 标题
- E1/E2/E3 benchmark 固定指标补齐

## 背景
- `docs/intent-e2e-experience-recall-playbook-plan-2026-04-09.md` 已明确后续每一刀都必须走 benchmark / holdout 口径，不能只凭零散真实 run 判断收益。
- 当前 `lib/intent-e2e-benchmark.ts` 只统计 `first_pass / terminal_pass / repaired / knowledge_hit`，还缺：
  - 固定指标里的 `blocked_rate`
  - `E1` 的 `experience_hit_rate / experience_helped_*`
  - `E2` 的 `playbook_hit_rate / recipe_hit_rate / untracked_rate`
  - `E3` 的 `review_write_rate`

## 本轮目标
- 在不改主运行链路的前提下，把现有 benchmark / compare report 补成能量化 E1/E2/E3 收益的固定口径。

## 验收标准
- [ ] benchmark suite / replay / compare report 能输出 `blocked_rate`
- [ ] benchmark suite / replay / compare report 能输出 `experience_hit_rate / playbook_hit_rate / recipe_hit_rate / untracked_rate / review_write_rate`
- [ ] compare report 保持向后兼容，现有 benchmark 读路径不被破坏
- [ ] 相关 unit tests、build、文档校验通过

## 范围
- 会改：
  - `lib/ai/intent-e2e-insights.ts`
  - `lib/intent-e2e-benchmark.ts`
  - `lib/intent-e2e-playbook.ts`
  - `tests/unit/intent-e2e-benchmark.spec.ts`
- 不会改：
  - 数据库 schema
  - HTTP route / workbench 入口
  - `intent-e2e` 主执行链路
  - 新增 benchmark 管理脚本

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-experience-recall-playbook-plan-2026-04-09.md`

## Roadmap 对齐
- 当前阶段：后续专项 `E1/E2/E3` 完成后的 benchmark / holdout 口径补齐
- 对应小步：固定指标回写与 compare report 收口
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 在 terminal run normalize 过程中补出 benchmark 所需的 experience / review / priority-family 信号
- 扩 benchmark metrics / compare summary，同时保持旧 benchmark 文件可读
- 用 unit test 固定冻结、回放、对比三段口径

## 验证
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-insights.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不处理 `E3` 的 `cta_accept_rate / repeated_failure_reopen_rate`，因为当前 benchmark 输入还没有稳定用户交互回执
- `playbook_hit_rate` 先按受控 playbook recipe slug 约定统计，不额外引入新 schema

## 完成后动作
- 回写专项文档和 roadmap
- 说明本轮已补的 benchmark 口径，以及仍未纳入的 E3 交互指标
