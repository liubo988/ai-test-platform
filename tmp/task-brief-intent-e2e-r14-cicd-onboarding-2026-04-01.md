# Task Brief

## 标题
- R14 CI/CD 接入与多系统接入模板最小闭环

## 背景
- `R13` 已把 run queue、artifact index、retry / replay、flaky 标记收口成统一任务平台，但当前能力仍主要停留在工作台内消费。
- roadmap `R14` 明确要求补齐三件事：新系统接入 manifest、CI/CD 接口、统一报告输出。

## 本轮目标
- 新增 repo-owned 的 system onboarding manifest registry，并提供至少 1 个非当前系统样板。
- 让 `POST /api/intent-e2e` 与 `POST /api/intent-e2e/runs` 支持接收 manifest / CI profile。
- 让终态结果输出统一 CI/CD report，收口 `pass/fail`、`gate decision`、`benchmark compare`、`rollback recommendation`。

## 验收标准
- [ ] 请求体支持 `onboardingManifestId` 与 `cicdProfile`，并能按 manifest 注入最小默认上下文。
- [ ] 异步 run 终态 snapshot 与直接 run 结果都能返回统一 `ciReport`。
- [ ] 至少提供 1 个非当前系统的 onboarding manifest 样板。
- [ ] README 与 roadmap 回写完成，相关 unit / build / 文档检查通过。

## 范围
- 会改：
  - `lib/intent-e2e-system-onboarding.ts`
  - `lib/intent-e2e-cicd-report.ts`
  - `lib/ai/intent-e2e-request.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `app/api/intent-e2e/route.ts`
  - `app/api/intent-e2e/runs/route.ts`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
  - `tests/unit/**` 相关定向用例
- 不会改：
  - 数据库 schema
  - 无关工作台 UI
  - 新的下载 / 浏览工件 API

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R14`
- 对应小步：system onboarding manifest + CI/CD unified report
- 本轮完成后回写：`R14 close-out`

## 计划修改点
- 新增 system onboarding manifest registry 与默认值解析 helper。
- 新增统一 CI/CD report builder，复用 benchmark / rollout / rollback 现有能力。
- 把 manifest / CI profile 接到 sync run 与 async run 入口，并把终态 report 落入结果对象。

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-request.spec.ts tests/unit/intent-e2e-system-onboarding.spec.ts tests/unit/intent-e2e-cicd-report.spec.ts tests/unit/intent-e2e-run-registry.spec.ts tests/unit/api-intent-e2e-route.spec.ts tests/unit/api-intent-e2e-runs-route.spec.ts tests/unit/api-intent-e2e-run-route.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只补 route-level CI/CD contract，不新增独立 report 下载 API。
- `npm run test:integration` 仍可能受当前仓库既有失败影响；如执行失败需在回写里明确标注。

## 完成后动作
- 回写 roadmap
- 同步 README 的请求体 / 返回体说明
