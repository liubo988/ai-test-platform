# Task Brief

## 标题
- 下一阶段第五刀：compare 污染治理 official harness 实现

## 背景
- 当前阶段仍是“下一阶段 / 后续阶段”的第五刀，不是第六刀，也不是 Phase 5。
- 当前 baseline 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T04-10-15-632Z-bench_32c071e12a66.json`
- 当前 benchmark 指针仍在 `bench_32c071e12a66`。
- 第五刀 latest same-baseline compare 仍是 `regressed`：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T06-14-37-883Z-bench_32c071e12a66-next-stage-fifth-cut-compare-recovery-current-2026-04-18.json`
- shared-path clean proof 已恢复，但 compare 仍被旧失败 run 污染，因此当前不能 freeze，更不能开第六刀或进入 Phase 5。
- 前一轮任务定义已经收敛唯一推荐方向：
  - official current-slice boundary harness
  - 主锚点使用 terminal run lower boundary

## 本轮目标
- 只做“第五刀 compare 污染治理 official harness 实现”。
- 只做：
  - brief
  - benchmark harness 实现
  - unit tests
  - 必要文档回写
  - roadmap 回写
  - 本地验证
- 不做新的 rerun / replay / compare 生产 evidence。
- 不做 freeze。
- 不开第六刀。
- 不进入 Phase 5。

## 验收标准
- [ ] official current-slice 资产可 repo-native 落盘并读回
- [ ] benchmark CLI 有正式 slice 声明入口，且能做最小一致性校验
- [ ] replay / compare 可显式消费 current-slice path
- [ ] current side 只纳入严格晚于 boundary 的 terminal runs
- [ ] 不传 slice 时旧 replay / compare 行为不变
- [ ] replay / compare 报告显式带上 current-slice metadata
- [ ] current-slice 模式下样本不足时 family-level conclusion 会落成 `insufficient_evidence`
- [ ] 相关单测、build、boundaries、文档校验、roadmap 校验通过

## 范围
- 会改：
  - `lib/intent-e2e-benchmark.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - `tests/unit/intent-e2e-benchmark.spec.ts`
  - `package.json`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `docs/intent-e2e-next-stage-fifth-cut-compare-pollution-official-harness-implementation-task-brief-2026-04-18.md`
- 不会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `app/**`
  - `components/**`
  - 数据库 schema
  - run registry 主流程
  - baseline / proof-window 既有语义

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-next-stage-fifth-cut-compare-pollution-official-harness-task-definition-2026-04-18.md`

## Roadmap 对齐
- 当前阶段：后续阶段 / 下一阶段第五刀 compare 污染治理
- 对应小步：official harness implementation
- 本轮完成后准备回写：roadmap 最新一条进度更新

## 计划修改点
- 新增 current-slice 资产类型与读写能力。
- 新增 benchmark CLI 官方 slice 声明命令。
- 给 replay / compare 增加显式 `currentSlicePath` 输入，并在 current side 聚合前做 boundary 过滤。
- 给 replay / compare 报告补齐 current-slice 审计字段。
- 用单测锁住：
  - legacy 行为不变
  - slice 过滤生效
  - slice 资产可声明可读回
  - 非法 slice / benchmark mismatch / boundary 缺失会报错
  - slice 后样本不足时 family conclusion 为 `insufficient_evidence`

## 验证
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-cicd-report.spec.ts`
- `npm run build`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只实现 harness，不会直接改变第五刀当前 `regressedCases=2` 的事实。
- 本轮不会执行真实 benchmark rerun / replay / compare，因此不会直接判断第五刀是否已恢复。
- `current-slice` 只能治理 current-side 污染，不能替代 baseline、proof-window 或 family clean proof。

## 完成后动作
- 回写 roadmap
- 明确本轮有 benchmark harness 改动，但没有第五刀 recovery 执行
- 明确当前仍停留在第五刀，下一轮才有资格用新 harness 判断 recovery / freeze
