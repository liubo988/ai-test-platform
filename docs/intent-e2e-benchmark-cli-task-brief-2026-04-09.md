# Task Brief

## 标题
- benchmark holdout 冻结 / compare 最小 CLI

## 背景
- 现有 `lib/intent-e2e-benchmark.ts` 已有 `freeze / replay / compare` 能力，但仓库没有稳定入口，只能手写调用。
- 上一刀已补齐 `E1/E2/E3` 的 benchmark 固定指标，下一步按开发文档应冻结真实 `AI生成` holdout 并跑 compare；如果没有 repo-owned 入口，这一步很难重复执行。

## 本轮目标
- 补一个零依赖、repo-owned 的 benchmark CLI，支持：
  - 查看候选 holdout clusters
  - 冻结 benchmark
  - 回放 benchmark
  - 生成 compare report

## 验收标准
- [ ] 能用命令列出当前 scope 下的 benchmark candidates
- [ ] 能用命令冻结项目 benchmark，并输出产物路径与关键摘要
- [ ] 能用命令 replay / compare 当前 benchmark，并输出关键指标摘要
- [ ] README / runbook 有稳定命令入口
- [ ] build、定向单测、文档校验通过

## 范围
- 会改：
  - `scripts/intent-e2e-benchmark.ts`
  - `scripts/ts-alias-loader.mjs`
  - `package.json`
  - `README.md`
  - `docs/runbook.md`
- 不会改：
  - DB schema
  - 新增 HTTP route / workbench 入口
  - `intent-e2e` 主运行链路

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-experience-recall-playbook-plan-2026-04-09.md`

## Roadmap 对齐
- 当前阶段：后续专项 `E1/E2/E3` 之后的真实 holdout 执行入口
- 对应小步：冻结 `AI生成 holdout` 并跑 compare 的可重复入口
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 补 Node loader，允许零依赖执行使用 `@/` alias 的 TS CLI
- 实现 `candidates / freeze / replay / compare` 四个子命令
- 更新 README / runbook 的稳定命令入口

## 验证
- `npm run intent:benchmark:candidates -- --help`
- `npm run intent:benchmark:freeze -- --help`
- `npm run intent:benchmark:compare -- --help`
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-insights.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只补 CLI，不直接跑线上真实 holdout
- CLI 仍依赖本地 `.env` 与 MySQL，可重复但不是无状态脚本

## 完成后动作
- 回写专项文档和 roadmap
- 给出冻结真实 holdout 的推荐命令模板
