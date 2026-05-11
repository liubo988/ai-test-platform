# Task Brief

## 标题
- 真实预发 E2E 的 `E2E_BASE_URL` 入口

## 背景
- README 后续建议里还剩真实预发环境 E2E 接入。
- 当前 Playwright config 已支持 `E2E_BASE_URL`，但缺少独立命令和最小 smoke 入口，已有产品创建用例也没有明确 `@preprod` 分组。

## 本轮目标
- 新增只跑真实预发用例的命令。
- 增加最小预发健康检查用例。
- 让产品创建 E2E 明确归入 `@preprod`，并在缺少预发环境变量时稳定跳过。

## 验收标准
- [ ] `npm run test:e2e:preprod` 只运行 `@preprod` 用例。
- [ ] 未配置 `E2E_BASE_URL` 时预发用例跳过，不误跑本地 fallback。
- [ ] 文档说明预发 E2E 所需环境变量。

## 范围
- 会改：
  - `package.json`
  - `tests/e2e/preprod-smoke.spec.ts`
  - `tests/e2e/product-create.spec.ts`
  - `docs/testing.md`
  - `docs/runbook.md`
  - `README.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - release-readiness 报表语义
  - benchmark harness
  - 数据库 schema

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：post release readiness hardening 后续建议
- 对应小步：接入真实预发环境 E2E（通过 `E2E_BASE_URL`）
- 本轮完成后回写：第五百二十五次更新

## 验证
- `npx playwright test tests/e2e/preprod-smoke.spec.ts tests/e2e/product-create.spec.ts --grep @preprod`
- `npm run build`
- `npm run build:web`
- `npm run test:unit`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只提供预发入口和轻量 smoke，不负责账号、权限、预发数据准备。
- 产品创建真实用例仍依赖预发环境的页面结构和账号权限。

## 完成后动作
- 回写 roadmap。
- 从 README 下一步建议移除已完成的预发 E2E 项。
