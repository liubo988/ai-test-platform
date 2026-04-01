# Task Brief

## 标题
- R10 版本化 benchmark 冻结 / 回放 / 对比最小闭环

## 背景
- `R9` 已把多 runner 执行链路接入统一 `run registry / insights`，但当前签收仍主要依赖近期自然流量 run 的 `evaluationBaseline`。
- `R10` 需要把这个临时 baseline 升级成可冻结、可回放、可比较、可绑定 release candidate 的项目级 benchmark 资产。

## 本轮目标
- 复用现有 `evaluationBaseline` 作为 benchmark 冻结源，落一份项目级 benchmark suite 资产。
- 提供冻结、回放、比较与报告输出能力，避免引入新的数据库 schema 或 UI/route 入口。
- 让 benchmark scope 至少支持 `project / module / testType` 维度管理。

## 验收标准
- [ ] 能从现有 run snapshots 生成版本化 benchmark suite，并写入项目级资产文件
- [ ] 能基于冻结 suite 回放当前 run snapshots，并输出 case 级当前指标
- [ ] 能生成冻结前后 benchmark compare report，包含 scope、summary、delta 与 case 级结论
- [ ] 相关 unit tests、build 与 roadmap/doc 校验通过

## 范围
- 会改：
  - `lib/ai/intent-e2e-insights.ts`
  - `lib/intent-e2e-benchmark.ts`
  - `tests/unit/intent-e2e-insights.spec.ts`
  - `tests/unit/intent-e2e-benchmark.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 新公共 API route
  - 无关 UI / workbench

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：R10
- 对应小步：版本化 benchmark schema + freeze / replay / compare
- 本轮完成后准备回写到哪一条更新：新增一条 `R10 close-out`

## 计划修改点
- 在 `intent-e2e-insights` 暴露 benchmark 需要的最小 canonical helper，避免复制 baseline 聚合逻辑
- 新增 benchmark service，负责 suite 冻结、资产持久化、回放、比较与报告写入
- 补 benchmark 相关 unit tests，并回写 roadmap 阶段状态

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-e2e-benchmark.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 当前 replay / compare 基于已有 run snapshots，不包含“重新执行 frozen case”的调度能力
- 暂不提供 workbench UI 或 HTTP 管理入口，后续如需暴露再单独收口为服务端入口

## 完成后动作
- 回写 roadmap
- 如 benchmark 资产契约稳定，后续阶段直接复用这份项目级 suite / report
