# Task Brief

## 标题
- R8 第五十刀：create flow precheck empty-state bypass

## 背景
- 真实 run `intent-run-25bb2233-cf83-4db8-9947-36167a035ce2` 在前置检查阶段被 `暂无数据` 命中 `data_missing`，UI 显示为“数据阻塞”
- 该任务本质是创建型流程，且创建入口就在商机列表页本身；当前 `looksLikeCreateFlowPrecheckBypass()` 要求 `targetUrl !== precheckUrl`，导致“同页可创建”的场景无法绕过空态 precheck

## 本轮目标
- 让“创建型 scenario + entry/precheck 同页”的空态列表页不再被 `data_missing` 直接阻断
- 保持非创建型任务、认证/权限/环境阻断规则不变

## 验收标准
- [x] 同页创建型 scenario 会对 precheck 传入 `ignoreFailureClasses: ['data_missing']`
- [x] 现有“列表页进入创建页”的 bypass 行为不回退
- [x] 相关 unit tests、build、doc/roadmap 校验通过

## 范围
- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - `page-analyzer` 的通用 block 规则
  - 无关 workbench UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：修复 create flow 在 execution precheck 上的空态误拦截
- 本轮完成后准备回写到哪一条更新：`2026-03-31 第五十五次更新`

## 计划修改点
- 放宽 `looksLikeCreateFlowPrecheckBypass()` 对 `targetUrl === precheckUrl` 的限制，允许同页创建场景绕过 `data_missing`
- 新增 `intent-e2e-service` 单测，覆盖“列表页本身可新建”的真实调用参数

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只修复同页创建场景的空态 precheck 误判，不处理更细粒度的“页面虽空但无新建权限”判定
- 未新增 e2e 回归，用 unit + 实际 run 证据驱动本轮修复

## 完成后动作
- 回写 roadmap
