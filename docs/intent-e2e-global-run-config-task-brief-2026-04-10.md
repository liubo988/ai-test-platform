# Task Brief

## 标题
- workspace 级意图任务全局配置：并发上限与失败重试默认值

## 背景
- 当前意图任务平台的并发上限主要由环境变量 `INTENT_E2E_MAX_CONCURRENT_RUNS` 控制，失败整轮重试则依赖每次请求显式传 `runControl.retryLimit`。
- 首页已经有“团队共享 LLM 配置”，但没有同级入口来管理 intent 运行平台的共享默认值。
- 用户希望把“控制台意图任务并发控制”和“意图失败任务重试次数”做成全局配置，并把入口放到首页 `LLM 配置` 旁边。

## 本轮目标
- 新增 workspace 级 intent 运行全局配置，支持保存：
  - 最大并发运行数
  - 默认失败重试次数
- 首页新增“全局配置”按钮和表单。
- 异步 intent run 主链路实际读取这份配置：
  - run registry 的全局并发配额
  - run registry 的默认 retryLimit

## 验收标准
- [ ] 首页 `LLM 配置` 旁新增“全局配置”入口，能查看和保存 workspace 级共享默认值
- [ ] 未显式传 `runControl.retryLimit` 的异步 intent run，会使用全局配置里的默认失败重试次数
- [ ] 异步 intent run 的全局并发配额会读取全局配置，而不是只读环境变量默认值
- [ ] 相关 route / runtime 单测通过，首页构建通过

## 范围
- 会改：
  - `app/page.tsx`
  - `components/GlobalConfigDialog.tsx`
  - `app/api/intent-e2e/global-config/route.ts`
  - `lib/db/repository.ts`
  - `lib/server/intent-e2e-request-preparation.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `scripts/e2e-platform-schema.sql`
  - `scripts/init-e2e-db.mjs`
  - `tests/unit/**` 受影响用例
  - `README.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 项目级配置模型
  - 非 intent 任务执行器
  - 现有 LLM 配置语义

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：R7 后续生产化收口，run registry / 工作台运维可控性补齐
- 对应小步：把运行平台关键治理参数从环境默认外显成 workspace 级共享配置
- 本轮完成后准备回写到哪一条更新：roadmap 最新一条进度更新后追加一条 2026-04-10 新更新

## 计划修改点
- 新增 workspace 级 intent run settings 表、repository 方法和运行时缓存
- 新增全局配置 route 与首页弹窗
- 将配置接到 request preparation 与 run registry
- 补 route / run registry 单测，更新 README 和 roadmap

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/api-intent-e2e-global-config-route.spec.ts tests/unit/api-intent-e2e-runs-route.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts tests/unit/intent-e2e-run-registry.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 当前仅把“全局并发上限”外显到 workspace 级表单，单项目并发上限仍保留服务端兜底逻辑。
- 运行时缓存默认依赖配置保存接口或异步运行入口预热；多实例部署下暂不做跨实例实时同步。

## 完成后动作
- 回写 roadmap
- 更新 README 的首页入口与 run platform 配置说明
