# Task Brief

## 标题
- Phase 5 / 第九刀：benchmark replay / compare read-path blocker recovery

## 背景
- `Phase 5 / 第九刀：admissibility judgement` 已放行，target 仍是 `ui_extract`。
- 但正式推进第九刀 benchmark 链路时，official replay / compare 在读取最近 benchmark window 时出现 read-path 阻塞，不是 generator / worker / corpus 的新业务 blocker。
- 当前真正需要修的是 benchmark 读 DB 时对 `intent_e2e_runs.state_json` 的过度读取，而不是改意图主链逻辑。

## 本轮目标
- 只修 benchmark replay / compare / freeze 的读路径性能阻塞。
- 保持 benchmark 语义、current-slice 语义、generator/worker 行为不变。
- 用最小 repo-native patch 恢复 official replay / compare 的可执行性。

## 验收标准
- [ ] official replay / compare 不再因 benchmark run snapshot 读取而卡住
- [ ] `listIntentE2ERunSnapshots(...)` 支持 benchmark projection
- [ ] replay / compare / freeze 显式消费 `projection: 'benchmark'`
- [ ] current-slice 行为与 legacy replay 行为保持兼容
- [ ] 不改 `lib/test-generator.ts`、`lib/test-worker.mjs`、`lib/ai/intent-e2e-service.ts`、corpus

## 范围
- 会改：
  - `lib/db/repository.ts`
  - `lib/intent-e2e-benchmark.ts`
  - `tests/unit/intent-e2e-benchmark.spec.ts`
  - `docs/intent-e2e-phase5-ninth-cut-benchmark-replay-compare-read-path-recovery-task-brief-2026-04-27.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-generator.ts`
  - `lib/test-worker.mjs`
  - `lib/ai/intent-e2e-service.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - benchmark corpus / project recipes

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-ninth-cut-admissibility-judgement-task-brief-2026-04-27.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第九刀`
- 对应小步：benchmark replay / compare read-path recovery
- 本轮完成后回写：
  - code-recovery 实现
  - 本地验证结果
  - 对第九刀 first admissible sample 的放行结论

## 计划修改点
- 给 `listIntentE2ERunSnapshots(...)` 增加 `projection?: 'full' | 'benchmark'`。
- 当 `projection='benchmark'` 时，在 SQL 层用 `JSON_REMOVE(...)` 去掉 benchmark replay / compare 不需要的大型 JSON 分支，降低单条 run snapshot 体积。
- 让 `freeze / replay / compare` 统一走 benchmark projection。
- 在 `tests/unit/intent-e2e-benchmark.spec.ts` 固定：
  - benchmark projection 被显式请求
  - current-slice compare / replay 仍可正常消费

## 验证
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts`
- `npm run build`

## 风险 / 未覆盖
- 本轮只恢复 benchmark 读路径，不承诺第九刀 compare 已 clean。
- 若读路径修复后 compare 仍 stop，下一步应回到第九刀 execution evidence 判断，而不是默认继续修 benchmark harness。

## 完成后动作
- 回写 roadmap
- 继续进入 `Phase 5 / 第九刀：ui_extract first admissible sample`
