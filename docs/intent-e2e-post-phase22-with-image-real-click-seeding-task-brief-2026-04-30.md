# Task Brief

## 标题
- AI 生成 with-image real-click seed 样本包

## 背景
- 当前 traffic-quality 已能区分图片路由和 OCR metadata，但最新 30 天报告显示 `realClickWithImageLaunchClicks=0`。
- 用户主场景是通过“AI生成”按钮输入自然语言和图片，下一步必须先积累 post-instrumentation 的真实点击带图样本分母。
- 现有 real-click seed 工具只覆盖无图片的 mixed / stable 样本包，不能稳定触发图片附件、OCR metadata 和 with-image launch 指标。

## 本轮目标
- 给 `scripts/intent-e2e-seed-real-click-samples.mjs` 增加显式 `with_image` profile。
- 为当前系统内的高频稳定 family 提供一条带图片附件的 AI 生成样本。
- 保持默认 `mixed` 和 `stable` 样本包不变，避免污染已有 release / traffic 口径。

## 验收标准
- [x] `--profile with_image` 可以构造带 `data:image/png;base64,...` 附件的 seed request。
- [x] with-image 样本强制 `llmConfig.visionEnabled=true`。
- [x] with-image 样本仍通过 current-system scope guard，只指向 `uat-service.yikaiye.com`。
- [x] 默认 `mixed` 样本包顺序和语义唯一性保持不变。
- [x] seed report 输出 `withImageSamples` 和每条样本的 attachment count。

## 范围
- 会改：
  - `scripts/intent-e2e-seed-real-click-samples.mjs`
  - `tests/unit/intent-e2e-seed-real-click-samples.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - traffic-quality 指标定义
  - release guard baseline
  - OCR prompt / verifier / 模型调用策略

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Post Phase 22，真实 AI 生成流量与图片/OCR 成功率口径治理。
- 对应小步：补齐可控 with-image real-click 样本入口，让 `real_click.with_image.*` 分母可主动积累。
- 本轮完成后回写：最新一条 roadmap 更新。

## 验证
- `node --env-file-if-exists=.env scripts/intent-e2e-seed-real-click-samples.mjs --help`
  - 通过。
- `npx vitest run tests/unit/intent-e2e-seed-real-click-samples.spec.ts`
  - 通过，`1` file / `6` tests。
- `npx vitest run tests/unit/intent-e2e-seed-real-click-samples.spec.ts tests/unit/scenario-card-generate.spec.ts tests/unit/intent-e2e-request.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/api-project-intent-drafts-route.spec.ts tests/unit/api-project-intent-draft-route.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts tests/unit/api-intent-e2e-runs-route.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-release-guard.spec.ts`
  - 通过，`13` files / `133` tests。
- `npm run build`
  - 通过。
- `npm run build:web`
  - 通过。
- `node scripts/check-doc-links.mjs`
  - 通过，`6` files checked。
- `node scripts/check-roadmap-progress.mjs`
  - 通过，`515` updates checked。
- `bash scripts/check-boundaries.sh`
  - 通过。
- `git diff --check`
  - 通过。
- `npm run intent:release-guard:preflight`
  - 通过，`baselines=4`、`files=10`、`errors=0`、`warnings=0`。
- `npm run intent:knowledge-hit-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit-guard.json`
  - 通过，`evidences=4`、`failedEvidences=0`。
- `npm run intent:release-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json`
  - 通过，`passedBaselines=4/4`。
- `npm run intent:release-status -- --require-current-compare --json`
  - 通过，`status=ready`、`canRelease=true`。
- `node --env-file-if-exists=.env scripts/intent-e2e-seed-real-click-samples.mjs --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --actor-user-uid usr_default_owner --base-url http://127.0.0.1:3667 --profile with_image --max-samples 1`
  - 通过，`draftsCreated=1/1`、`autoRunStarted=1`、`terminalRuns=1`、`passedRuns=1`、`withImageSamples=1`。
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30 --json`
  - 通过，`realClickWithImageLaunchClicks=1`、`realClickWithImageTerminalPasses=1`、`draftGeneratedOcrUsedCount=1`。

## 风险 / 未覆盖
- 本轮只跑通 1 条真实 with-image seed，不能把 `1/1` 外推为图片场景长期成功率。
- with-image profile 已能在本地服务和 UAT 配置可用时增加 `real_click.with_image.launch_click_count`。
- 这条样本用于启动图片分母积累；后续若 terminal 失败集中在某一步，仍需要 family recipe / fixture / verifier 治理。

## 完成后动作
- 回写 roadmap。
- 跑完整验证链。
