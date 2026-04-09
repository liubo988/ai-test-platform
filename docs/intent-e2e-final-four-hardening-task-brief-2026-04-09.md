# Task Brief

## 标题
- Intent E2E 后续专项收尾：历史 playbook 沉淀、recipe-aware recall、E4 OCR 与 benchmark 复量化

## 背景
- 当前后续专项文档里 `E1-E3` 主体已经落地，但还有 4 个直接影响真实成功率或量化闭环的缺口未收口：
  - `proj_default` 尚未把历史成功 run 的 `playbookCandidates` 批量沉淀到项目 recipe，导致 `playbook_hit_rate=0`
  - benchmark 基线仍停留在旧窗口，需要按最新代码和最新真实 runs 重新冻结 / 对比
  - experience recall 仍是单阶段检索，还没补 `recipe-aware / playbook-aware` 二次 rerank
  - `E4` 的图片文字锚点增强尚未接入，带图任务仍主要依赖单次多模态理解
- 用户要求严格按现有 md 开发计划做最小切口收尾，不扩新 route / 新 UI / 新 schema，并在 4 条都完成后再统一汇报。

## 本轮目标
- 补一层 repo-owned 的历史 playbook 批量 promotion 入口，并真正写入项目 recipe 资产。
- 在主链路 recall 上补 `recipe-aware / playbook-aware` 二次 rerank。
- 按开发文档落最小版 `E4 OCR / structured visual anchors`。
- 重新冻结 holdout 并产出新一轮 compare / roadmap 回写。

## 验收标准
- [ ] 能从历史成功 run snapshot 批量提取 `review.playbookCandidates` 并 merge 到项目 `intent-e2e.project-recipes.json`
- [ ] experience recall 在已有 base score 之上补 `recipe-aware / playbook-aware` rerank，主链路会透传当前 recipe slugs
- [ ] 附图任务会额外提取轻量 OCR / 文字锚点摘要，并只增强 `visualAnchors / family routing / clarify signal`
- [ ] 重新跑 benchmark freeze / compare，更新专项文档与 roadmap 的阶段状态、验证和风险

## 范围
- 会改：
  - `docs/intent-e2e-final-four-hardening-task-brief-2026-04-09.md`
  - `docs/intent-e2e-experience-recall-playbook-plan-2026-04-09.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `package.json`
  - `README.md`
  - `docs/runbook.md`
  - `lib/intent-e2e-playbook.ts`
  - `lib/intent-e2e-experience-search.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/ai/intent-attachment-ocr.ts`
  - `lib/ai/scenario-card.ts`
  - `scripts/intent-e2e-playbook-promotion.ts`
  - `tests/unit/intent-e2e-playbook.spec.ts`
  - `tests/unit/intent-e2e-playbook-promotion.spec.ts`
  - `tests/unit/intent-e2e-experience-search.spec.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/scenario-card.spec.ts`
  - `tests/unit/intent-attachment-ocr.spec.ts`
- 不会改：
  - 数据库 schema
  - `app/**` route 契约
  - 工作台 UI 交互流程
  - 无关部署脚本 / 无关脏改动

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-experience-recall-playbook-plan-2026-04-09.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：后续专项 `E1-E4` 收尾
- 对应小步：
  - 历史 playbook candidate 批量 promotion
  - recipe-aware recall rerank
  - `E4 OCR / structured visual anchors`
  - benchmark 重新冻结与 compare
- 本轮完成后准备回写到哪一条更新：
  - `docs/intent-e2e-experience-recall-playbook-plan-2026-04-09.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## 计划修改点
- 新增 repo-owned 历史 playbook promotion CLI，复用：
  - `listIntentE2ERunSnapshots(...)`
  - `buildIntentProjectRecipeMergeInputsFromPlaybookCandidates(...)`
  - `mergeIntentProjectRecipes(...)`
- 在 experience recall 中补第二阶段 rerank，优先使用当前 recipe slugs 与历史 playbook slug 的重合度做提权。
- 新增轻量附件 OCR 摘要器，先把截图里的标题 / 按钮 / tab / 列头等文字转成结构化 visual anchors，再接回 ScenarioCard 生成。
- 基于真实项目 scope 重新跑 benchmark，并把最新阶段状态和风险回写到专项文档与主 roadmap。

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-playbook.spec.ts tests/unit/intent-e2e-playbook-promotion.spec.ts tests/unit/intent-e2e-experience-search.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/scenario-card.spec.ts tests/unit/intent-attachment-ocr.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run intent:playbook:promote -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --run-limit 200`
- `npm run intent:benchmark:freeze -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --test-type browser_e2e --max-cases 5 --release-candidate <label>`
- `npm run intent:benchmark:compare -- --project-uid proj_default --run-limit 200 --compared-label <label>`

## 风险 / 未覆盖
- `playbook_hit_rate` 需要后续真实新 run 命中 project recipe 才会显著提升；仅回填历史资产不能直接改写旧 run snapshot。
- `E4 OCR` 首版只做轻量结构化文字锚点，不处理复杂视觉关系推理。
- benchmark compare 若继续对同一批当前 runs 做对比，可能只能得到有限增量；需要据实记录，不夸大收益。

## 完成后动作
- 回写专项文档与主 roadmap 的“本轮目标 / 已完成 / 验证 / 阶段状态 / 风险 / 下一步”。
- 保留新 CLI 入口和 runbook 说明，供后续继续批量 promotion 与 benchmark 复测。
