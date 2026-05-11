# Task Brief

## 标题
- AI 生成图片/OCR 显式 metadata 与 traffic-quality 指标

## 背景
- 当前 OCR 已参与 ScenarioCard 生成：截图摘要会进入 prompt，并合并回 `visualAnchors / notes`。
- 但历史链路没有把 “OCR 是否尝试 / 是否产生锚点 / 是否随草稿进入后续运行” 写成稳定 metadata。
- 用户主场景是“AI生成”按钮，后续要提高图片场景成功率，必须先把 OCR 参与率和带图片终态成功率纳入可观测分母。

## 本轮目标
- 给 ScenarioCard 生成结果的 `llmMeta` 写入 OCR attempted / used / anchor count。
- 让草稿生成事件、draft launch payload、launch-decision 事件和 run-started 事件都能携带 `prefilledScenarioLlmMeta` 或 OCR 摘要信号。
- 在 traffic-quality report 中增加 `ocrMetrics`。

## 验收标准
- [x] `generateScenarioCard(...)` 返回 `attachmentOcrAttempted / attachmentOcrUsed / attachmentOcrVisualAnchorCount / attachmentOcrTextSnippetCount`。
- [x] `normalizeIntentE2ERequestBody(...)` 支持安全归一 `prefilledScenarioLlmMeta`。
- [x] 从意图草稿启动运行时，payload 会保留 `prefilledScenarioLlmMeta`。
- [x] traffic-quality report 输出 `ocrMetrics`，区分草稿生成 OCR 使用率和 terminal OCR anchor observed pass rate。
- [x] 当前 30 天报告能显示历史 with-image terminal 的 OCR anchor observed 情况。

## 范围
- 会改：
  - `lib/ai/scenario-card.ts`
  - `lib/ai/intent-e2e-request.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/intent-e2e-traffic-quality.ts`
  - `app/api/projects/[projectUid]/intent-drafts/route.ts`
  - `app/api/projects/[projectUid]/intent-drafts/[draftUid]/route.ts`
  - `components/IntentE2EWorkbench.tsx`
  - 相关 unit tests
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - OCR 模型调用策略
  - 新增外部依赖
  - release guard baseline

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Post Phase 22，真实 AI 生成流量与图片/OCR 成功率口径治理。
- 对应小步：把 OCR 从隐式 prompt 辅助升级为可统计、可追踪、可治理的运行元数据。
- 本轮完成后回写：最新一条 roadmap 更新。

## 验证
- `npx vitest run tests/unit/scenario-card-generate.spec.ts tests/unit/intent-e2e-request.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/api-project-intent-drafts-route.spec.ts tests/unit/api-project-intent-draft-route.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts tests/unit/api-intent-e2e-runs-route.spec.ts`
- `npx vitest run tests/unit/scenario-card-generate.spec.ts tests/unit/scenario-card.spec.ts tests/unit/intent-e2e-request.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/api-project-intent-drafts-route.spec.ts tests/unit/api-project-intent-draft-route.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts tests/unit/api-intent-e2e-runs-route.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-release-guard.spec.ts`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30 --json`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `bash scripts/check-boundaries.sh`
- `git diff --check`
- `npm run intent:release-guard:preflight`
- `npm run intent:knowledge-hit-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit-guard.json`
- `npm run intent:release-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json`
- `npm run intent:release-status -- --require-current-compare --json`

## 风险 / 未覆盖
- 历史 `draft_generated` 事件没有 OCR metadata，所以 `draftGeneratedOcrUsedRate` 只对后续样本完整。
- 当前不会改变 OCR prompt 或模型调用方式，只增加可观测性和 payload 传递。
- 仍不能把 with-image 历史 terminal `44.4%` 外推成真实点击成功率，因为当前 `real_click.with_image.launch_click_count=0`。

## 完成后动作
- 回写 roadmap。
- 刷新 traffic-quality JSON / Markdown 报表。
