# Task Brief

## 标题
- R13 调度、可靠性与工件平台最小闭环

## 背景
- 当前 `intent-e2e` 异步运行链已经能创建 / 执行 / 恢复单个 run，但 `run-registry` 仍以单机内存直跑为主。
- 现状缺少显式并发配额、排队优先级、run-level timeout / replay / flaky 标记，以及统一 artifact archive/index，无法把它当长期稳定运营的平台能力来用。

## 本轮目标
- 仅把 `R13` 收口成一条最小但完整的任务平台闭环：
  - `runControl` 契约
  - 队列 / 并发配额 / 优先级 / 取消
  - run-level timeout / explicit replay linkage / flaky 标记
  - artifact archive/index

## 验收标准
- [ ] 并发配额命中时，run 会进入稳定 `queued` 阶段，并在配额释放后自动启动
- [ ] queued / running run 都可取消；run metadata 会保留 priority / timeout / replay / flaky 信息
- [ ] 最终 run result 会带 artifact index，至少覆盖 `trace / log / screenshot / response_summary / runner_artifact`
- [ ] 相关 unit tests、build、文档检查与 roadmap 回写通过

## 范围
- 会改：
  - `lib/ai/intent-e2e-request.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `app/api/intent-e2e/runs/route.ts`
  - `app/api/intent-e2e/runs/[runId]/route.ts`
  - `app/api/intent-e2e/runs/[runId]/stream/route.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/intent-e2e-request.spec.ts`
  - `tests/unit/intent-e2e-run-registry.spec.ts`
  - `tests/unit/api-intent-e2e-runs-route.spec.ts`
  - `tests/unit/api-intent-e2e-run-route.spec.ts`
  - `tests/unit/api-intent-e2e-run-stream-get-route.spec.ts`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 无关 UI 结构
  - 独立 artifact 下载 API

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：R13
- 对应小步：并发配额、取消 / replay、artifact index、flaky 标记
- 本轮完成后准备回写到哪一条更新：`R13 close-out`

## 计划修改点
- 增加 `runControl` 归一化 helper，并把 priority / timeout / retryLimit / replayOfRunId 接到 run request summary
- 在 `run-registry` 内补 queued 调度、priority 排队、project/global concurrency quota、timeout guard、queued cancel 与 replay/flaky tracking
- 在 `intent-e2e-service` 内补 artifact archive/index，并把索引回填到最终 run result

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-request.spec.ts tests/unit/intent-e2e-run-registry.spec.ts tests/unit/api-intent-e2e-runs-route.spec.ts tests/unit/api-intent-e2e-run-route.spec.ts tests/unit/api-intent-e2e-run-stream-get-route.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不新增 artifact 下载 / 浏览 API；先以稳定 archive path + index 收口
- replay 先做“显式 linkage + flaky tracking”，不做跨重启自动克隆旧请求

## 完成后动作
- 回写 roadmap
- 同步更新 README 的 `runs` / `artifact index` / `runControl` 说明
