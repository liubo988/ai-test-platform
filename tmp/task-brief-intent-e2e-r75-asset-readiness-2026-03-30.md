# Task Brief

## 标题
- R7.5 第二刀：intent-e2e 冷启动资产信号与最小 onboarding contract

## 背景
- `R7.5` 第一刀已经把 project knowledge / repair memory 从全局默认路径切到 `projectUid` 维度隔离。
- 但新项目首次运行时，系统仍缺少显式的“当前项目资产是否准备好”的口径；`knowledge hit = 0`、项目 onboarding 缺失、项目知识资产为空，都会混进普通失败里。
- 生产 roadmap 已明确下一步应先补 `asset_missing / no_hit` 信号和最小 onboarding contract，而不是直接跳去 `R8`。

## 本轮目标
- 增加最小 project onboarding manifest helper，并复用现有 project asset root。
- 在 `intent-e2e` 主运行链路里计算 asset readiness，至少显式区分 `ready / asset_missing / no_hit`。
- 把该信号透传到 run result / snapshot / insights / workbench，避免冷启动问题继续伪装成纯模型失败。

## 验收标准
- [ ] `projectUid` 存在时，运行结果会返回当前项目的 asset readiness。
- [ ] onboarding / knowledge / repair memory 缺失时，结果能显式标成 `asset_missing`，而不是只剩 `knowledge hit = 0`。
- [ ] 项目资产存在但本次未命中 knowledge 规则时，结果能显式标成 `no_hit`。
- [ ] insights summary / recent traces / workbench 能看到相同 readiness 信号。
- [ ] 相关 unit tests 通过。

## 范围
- 会改：
  - `lib/intent-project-onboarding.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `lib/ai/intent-e2e-insights.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/intent-e2e-run-registry.spec.ts`
  - `tests/unit/intent-e2e-insights.spec.ts`
  - `tests/unit/api-intent-e2e-insights-route.spec.ts`
- 不会改：
  - 数据库 schema
  - 完整 onboarding 编辑流
  - `env/auth/data blocked` 的完整分桶治理
  - `R8` 多测试类型抽象

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：R7.5
- 对应小步：冷启动 guardrail 的最小显式信号与 onboarding contract
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新更新

## 计划修改点
- 新增 project onboarding manifest path / read / readiness helper
- 在 service 中计算 `asset_missing / no_hit / ready`
- 让 run registry / insights / workbench 共享同一份 readiness 结构
- 补充 service / registry / insights / route 单测

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-run-registry.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/api-intent-e2e-insights-route.spec.ts`
- 如改前端类型：`npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只做显式信号，不做 hard block；运行仍会继续执行。
- onboarding manifest 先只做读取与 readiness 判断，不引入完整编辑与校验 API。
- `asset_missing` 与 `blocked run split` 仍是两件事，环境/权限/数据分桶留到后续切片。

## 完成后动作
- 回写 production roadmap 当前轮次状态
- 如字段进入稳定入口，同步更新 README 或相关文档
