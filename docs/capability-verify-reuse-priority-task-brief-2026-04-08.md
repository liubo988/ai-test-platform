# Task Brief

## 标题
- capability verify 优先复用最近一次通过计划，并收窄 source-plan gate

## 背景
- 当前能力验证虽然已经支持从来源正式任务 restore passed plan，但实际链路仍有两类偏差：
- 已经通过过一次的能力，后续再次验证没有优先复用“能力自己最近一次通过的 verify 计划”，导致又走生成链路，响应慢且结果漂移。
- source-plan compatibility gate 目前把“是否含 `__e2e.readAntdTableCellByHeader(...)`”当成唯一门槛，过于写死，会误杀已经具备完整状态证据链的商机列表成功计划。

## 本轮目标
- 让 capability verify 在标准验证下优先复用最近一次通过的能力验证计划。
- 对 source-task passed plan 的复用门槛改成“状态证据链完整”，不再绑定单一 helper 名字。

## 验收标准
- [ ] 能力 `execution_verified + last verify passed` 后，再次 verify 优先 restore 最近一次通过的能力计划。
- [ ] 商机列表状态类 source passed plan 只要具备结构化状态证据链或详情回退链，就允许继续复用。
- [ ] 明显只有裸 `rowText` 状态断言、缺少结构化证据链的旧 plan 仍会回退生成。
- [ ] 相关 unit / build / 文档校验通过。

## 范围
- 会改：
  - `lib/capability-verification-service.ts`
  - `app/api/projects/[projectUid]/capabilities/[capabilityUid]/verify/route.ts`
  - `tests/unit/capability-verification-service.spec.ts`
  - `tests/unit/api-project-capability-verify-route.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - repair 主链路
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：capability verify passed-plan reuse priority / source-plan gate 收窄

## 计划修改点
- 给 capability meta 增加“最近一次通过 verify 计划的复用指纹”，后续 verify 命中时优先 restore 该计划。
- source-task reuse gate 从单 helper 判断改成业务状态证据链判断。
- route 按复用来源写不同 activity actionType，避免把“复用上次 verify 计划”误记成“来源正式任务 restore”。

## 验证
- `npx vitest run tests/unit/capability-verification-service.spec.ts tests/unit/api-project-capability-verify-route.spec.ts`
- `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/test-executor.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不做历史 plan 自动升级，只调整“优先复用谁”和“允许哪些旧成功计划继续复用”。
- 真实环境首轮 verify 若来源 plan 本身就有环境级波动，本轮只能减少不必要的重新生成，不能替代业务页面稳定性治理。

## 完成后动作
- 回写 roadmap
- 若真实复跑结果改变，记录新的 run id 与根因
