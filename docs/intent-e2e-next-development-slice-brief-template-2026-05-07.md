# Intent E2E Next Development Slice Brief Template

## 标题
- `<Document / Priority family> <family> <first cut / closure / guard>`

## 准入结论
- gate command：
  - `npm run intent:next-dev:check -- --project-uid <projectUid> --window-days <days>`
- `developmentGate.status`：
- 允许开发原因：
- traffic-quality report：
  - JSON：
  - Markdown：
- release status：
  - `npm run intent:release-status -- --require-current-compare --json`

## 候选 family
- family：
- family type：
  - `document`
  - `priority`
- source：
  - `real_click`
- evidence：
  - `launchClickCount`：
  - `autoRunStartedCount`：
  - `terminalRunCount`：
  - `terminalPassCount`：
  - `terminalPassRate`：
  - `attachment split`：
  - `launchDecision split`：
- governance：
  - `governanceStatus`：
  - `releaseGuardStatus`：
  - `knowledgeHitStatus`：

## 本轮目标
- 只交付一个完整能力切片：
  - recipe：
  - fixture：
  - verifier：
  - release guard / knowledge-hit evidence：

## 范围
- 会改：
  - `lib/**`
  - `app/api/**`
  - `components/**`
  - `scripts/**`
  - `tests/**`
  - `docs/**`
- 不会改：
  - traffic-quality source 语义
  - release-readiness 既有口径
  - benchmark harness 既有语义
  - unrelated UI / DB schema

## 验收标准
- [ ] 目标 family 有明确 recipe / fixture / verifier 或治理资产。
- [ ] 成功率证据只使用允许的 `source=real_click` 分母。
- [ ] benchmark / replay / draft_import 只用于诊断，不用于真实成功率结论。
- [ ] release guard / knowledge-hit 或对应替代证据已落盘。
- [ ] roadmap 已回写“本轮目标 / 已完成 / 验证 / 阶段状态 / 风险 / 下一步”。

## 验证命令
- `npm run build`
- `npm run build:web`
- `npx vitest run <affected unit tests>`
- `npm run test:integration`（如改 route / DB / repository）
- `npx playwright test --grep @smoke`（如改工作台 / 页面 / 主流程）
- `npm run intent:release-status -- --require-current-compare --json`
- `npm run intent:traffic-quality -- --project-uid <projectUid> --window-days <days>`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## Stop Conditions
- `developmentGate.status` 不是 `ready_for_document_family_governance` 或 `ready_for_ungoverned_priority_family`。
- 候选 family 的 `source` 证据不是 `real_click`。
- 实现开始依赖跨系统样本、benchmark/replay 混统或 draft_import 伪装。
- document family 缺少真实 document-like launch evidence。
- scope 开始扩到不相关 family、全局 OCR-first 或 release-readiness 口径重写。

## 完成后动作
- 刷新 traffic-quality report。
- 刷新 release status / summary。
- 回写 roadmap。
- 更新 handoff 或稳定入口文档。
