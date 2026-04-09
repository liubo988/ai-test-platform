# Task Brief

## 标题
- Hermes 审计结论落成 Intent E2E 经验召回与 Playbook 开发文档

## 背景
- 当前 `AI生成` 链路已经具备 `ScenarioCard`、`ExecutionPlan / VerificationPlan`、`repair memory`、`successful run` 沉淀、`starter helper`、`failure pressure` 等基础设施，但“自然语言换个说法、同页面相近需求、带截图的开放式任务”仍容易退回自由生成或低置信盲跑。
- 用户要求评估 `~/Workspace/hermes-agent/` 中哪些能力值得借用，以提升当前项目“意图任务 / AI生成”的真实成功率，并明确这些方向是否符合 OpenAI / Claude / Playwright 官方最佳实践。
- 这次不直接改主链路代码，先把审计结论收敛成一份可直接执行的后续开发文档，避免后续继续凭感觉扩能力。

## 本轮目标
- 新增一份 post-`success-hardening` 的专项开发文档。
- 明确“要借什么 / 不借什么”、与现有 `S1-S6` 方案和 roadmap 的关系、建议切片、量化指标、验证方式和不做项。
- 给出对成功率的现实预期和 benchmark 口径，避免写成泛化概念方案。

## 验收标准
- [ ] 文档明确列出可借用的 Hermes 能力，且只保留对 `intent-e2e` 真正有帮助的部分。
- [ ] 文档明确说明当前仓库已具备的学习闭环与资产治理能力，避免重复造轮子。
- [ ] 文档拆成清晰、可执行的增量切片，包含目标、范围、验收和验证命令。
- [ ] 文档写清成功率提升的现实边界、benchmark 方法和不做项。

## 范围
- 会改：
  - `docs/intent-e2e-experience-recall-playbook-task-brief-2026-04-09.md`
  - `docs/intent-e2e-experience-recall-playbook-plan-2026-04-09.md`
- 不会改：
  - `lib/**`
  - `app/**`
  - 数据库 schema
  - 运行中 UI / API 行为

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`
- `docs/reactive-juggling-aho.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：`intent-e2e` post-`success-hardening` 的后续增量规划，不替代主 roadmap。
- 对应小步：为后续“经验召回 / playbook / 异步复盘 / OCR 锚点增强”建立单独开发文档。
- 本轮完成后准备回写到哪一条更新：本轮仅新增专项文档，不回写 roadmap；后续真正动代码时再按切片回写 roadmap 进度。

## 计划修改点
- 新增一份以 `experience recall + project-scoped playbook + async review + OCR anchors` 为核心的开发文档。
- 文档中显式复用现有 `repair memory`、`successful run knowledge candidate`、`starter helper`、`recipe registry`、`failure pressure` 和 `benchmark` 设施。
- 明确说明为什么不直接照搬 Hermes 的通用 memory / persona / free-form skill 系统。

## 验证
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 当前真实 `AI生成` holdout 成功率尚未重新冻结，文档内只能给工程估算，不能当成已验证结果。
- 本轮不改代码，因此不会直接证明成功率提升，只会固定后续开发边界与验收口径。

## 完成后动作
- 将新文档作为后续开发主文档之一。
- 后续每个切片真正开工前，按 `docs/task-brief-template.md` 再补各自的 Task Brief。
