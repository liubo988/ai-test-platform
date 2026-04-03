# Task Brief

## 标题
- post-R14 success hardening：真实 run 指标回放与继续开刀决策

## 背景
- `S1-S6` 与三条 `S6+` 最小候选切片都已完成：
  - `DOM delta`
  - `structured data evidence`
  - `shared session minimal`
- 按当前 md 约束，下一步不应继续发散开发，而应先回真实 run 指标，判断是否还有必要新增切片。

## 本轮目标
- 只基于当前本地真实 run 样本，补一份最小但可执行的指标回放。
- 重点回答：
  - 当前样本里的 `first_pass_rate / terminal_pass_rate / top_failure_reasons` 是什么
  - 这些样本是否已经足够代表最新代码
  - 下一步是继续开新刀，还是先 rerun 最新代码回收新样本

## 验收标准
- [x] 给出样本范围与局限
- [x] 给出最小指标摘要：`first_pass_rate / terminal_pass_rate / top_failure_reasons`
- [x] 给出明确结论：是否继续开新切片
- [x] 结论与现有 success hardening 文档口径一致，不额外扩 scope

## 范围
- 会改：
  - `docs/intent-e2e-s6plus-real-run-review-task-brief-2026-04-02.md`
  - `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`
- 不会改：
  - `lib/**`
  - `app/**`
  - `components/**`
  - route / worker / runner / repair 主链代码

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## 数据来源
- `reports/intent-e2e/runs/**/run-trace.json`
- `reports/intent-e2e/runs/**/attempt-*-response-summary.json`

## 验证
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 已补最新代码同场景 rerun `3` 次，但只覆盖 1 条真实业务场景
- 本轮不改业务代码，只做样本回放与是否继续开刀的决策

## 完成后动作
- 给出简短执行建议：
  - 若样本已过时，先用同一真实场景 rerun 最新代码
  - 若样本已足够且仍集中暴露同一失败簇，再决定是否开新刀
  - 本轮已完成 rerun，下一步按 review 文档中的单刀优先级继续
