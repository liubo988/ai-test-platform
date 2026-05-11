# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions `ui_extract` env-connectivity block diagnosis

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 上一轮只读结论已经固定：
  - `ui_assert_extract` replay gate stop 更像 replay transport/read 路径问题
  - 允许对 `intent-run-d30cc572-2cfd-46fe-a9ea-e5eda3621cf7` 使用 `latest-window fallback gate`
  - 若 fallback gate 通过，下一步才应继续 `ui_extract 1/1`
- 本轮实际执行中：
  - 官方 replay CLI 在当前 shell 里再次未返回可验证 JSON
  - 随后尝试继续 `ui_extract 1/1` 两次，均返回 `failureClass=env_transient`
- 需要判断当前阻塞是否来自环境连接问题，而不是新的代码/共享路径回退。

## 本轮目标
- 只读确认这两次 `ui_extract` stop 是否属于真实环境阻塞。
- 明确当前是否存在新的 deterministic code blocker / harness blocker。
- 明确在环境恢复之前是否还允许继续 benchmark execution。
- 明确环境恢复后是否需要先做新的 sequencing judgement，而不是直接沿用旧链路继续跑。

## 验收标准
- [ ] 固定两次 `ui_extract 1/1` 的 report path / run id / `failureClass=env_transient`
- [ ] 固定浏览器级环境证据（至少一条 browser-level connection error）
- [ ] 明确当前 blocker 是否为环境连接问题，而不是代码 blocker
- [ ] 明确本轮不会改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus
- [ ] 明确环境恢复前不得继续 `ui_extract replay / assert_extract_ui / compare`
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-ui-extract-env-connectivity-block-diagnosis-task-brief-2026-04-23.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - benchmark harness
  - benchmark pointer
  - corpus 资产
  - 任何生产代码

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-ui-assert-extract-replay-gate-fallback-admissibility-judgement-task-brief-2026-04-23.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-23T09-08-43-880Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-23T10-35-00-003Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-23T10-36-54-015Z-family-modal_or_drawer_save-fresh-rerun.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions `ui_extract` env-connectivity block diagnosis
- 本轮完成后回写：roadmap 最新一条更新

## 固定结论
- 两次 `ui_extract 1/1` 都未形成新的 deterministic 失败形态，只表现为 `failureClass=env_transient`：
  - `2026-04-23T10-35-00-003Z-family-modal_or_drawer_save-fresh-rerun.json`
    - `runId=intent-run-241b549a-d6ba-490a-b4ba-08eedd74a63f`
  - `2026-04-23T10-36-54-015Z-family-modal_or_drawer_save-fresh-rerun.json`
    - `runId=intent-run-5d41b22e-69db-4eb8-81d5-15388b06f9ab`
- 浏览器级环境证据已固定：
  - Playwright `page.goto('https://uat-service.yikaiye.com/#/order/list')` 返回 `net::ERR_CONNECTION_CLOSED`
  - `curl` 访问同域名 HTTPS 返回 `LibreSSL SSL_connect: SSL_ERROR_SYSCALL`
- 因此当前 blocker 更接近环境连接问题，而不是新的 code blocker / harness blocker。
- 本轮不应继续修改代码，也不应继续执行 `ui_extract replay / assert_extract_ui / compare`。
- 因为 `ui_assert_extract` 的 fallback gate 还没被正式落地，而其后又新增了两条 `ui_extract env_transient` terminal runs，环境恢复后的最小 admissible restart point 需要先做新的 sequencing judgement，再决定是否还能复用旧 `ui_assert_extract` fresh run。

## 验证
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `curl -I -L --max-time 20 https://uat-service.yikaiye.com/`
- `curl -k -I -L --max-time 20 https://uat-service.yikaiye.com/`
- browser-level Playwright `page.goto('https://uat-service.yikaiye.com/#/order/list')`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
