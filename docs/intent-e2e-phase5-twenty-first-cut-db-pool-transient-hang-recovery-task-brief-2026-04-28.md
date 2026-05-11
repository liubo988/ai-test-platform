# Task Brief

## 标题
- Phase 5 / 第二十一刀：DB pool transient hang recovery

## 背景
- 第二十一刀 fixed-slice posttopup 过程中，`ui_assert_extract_3` 连续两次在 benchmark CLI 层命中 MySQL `read ETIMEDOUT / EPIPE`。
- 失败发生在 snapshot persist / DB pool close / flush 收口阶段，不是业务断言失败。
- 其中一次进程在打印错误后继续挂住，说明 CLI 对 transient DB failure 的收口不够有界。

## 本轮目标
- 给 MySQL pool 增加 keep-alive / connect timeout 配置。
- 让 `closeDbPool()` 对关闭阶段 transient network error 幂等收口。
- 让 benchmark CLI 在关闭连接池前的 run persistence flush 有超时边界，避免失败后挂死。
- 不改变 benchmark 选择、compare、freeze 语义。

## 验收标准
- [ ] DB ping / 短查询探针通过
- [ ] 原失败的 `ui_assert_extract` rerun 能形成 official rerun report
- [ ] benchmark CLI 不再在 transient failure 后无限挂起
- [ ] 相关 TypeScript build 通过

## 范围
- 会改：
  - `lib/db/client.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - `docs/intent-e2e-phase5-twenty-first-cut-db-pool-transient-hang-recovery-task-brief-2026-04-28.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - benchmark case selection / compare scoring / freeze scoring
  - request corpus
  - E2E generator / worker 主逻辑

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-next-stage-first-cut-pool-is-closed-lifecycle-fix-task-brief-2026-04-17.md`
- `docs/intent-e2e-phase5-twenty-first-cut-fixed-slice-posttopup-recovery-task-brief-2026-04-28.md`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二十一刀`
- 对应小步：fixed-slice posttopup 中的 DB transient recovery
- 本轮完成后回写：
  - 触发错误
  - 代码改动
  - 验证结果

## 计划修改点
- `lib/db/client.ts`
  - 读取正数型 pool 配置。
  - 开启 `enableKeepAlive` / `keepAliveInitialDelay`。
  - 增加 `DB_CONNECT_TIMEOUT_MS` 默认值。
  - `closeDbPool()` 忽略关闭阶段的 transient network close error。
- `scripts/intent-e2e-benchmark.ts`
  - 增加 bounded flush timeout。
  - completion / persistence flush 超时只 warning，不让 finally 阶段无限等待。

## 验证
- DB ping / query probe
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run build`

## 风险 / 未覆盖
- keep-alive 和 bounded flush 只能提升 CLI 长流程稳定性；如果 DB 服务端长时间不可用，benchmark 仍应失败并暴露错误。
- 本修补不把历史 `running` stale snapshots 自动改终态，避免污染 benchmark terminal evidence。

## 完成后动作
- 回写 roadmap
- 继续完成第二十一刀 fixed-slice posttopup 与 closure freeze
