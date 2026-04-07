# Task Brief

## 标题
- intent-e2e：项目凭证默认 shared-session key 与 precheck 耗时透出

## 背景
- 当前从项目内发起的意图 run，即使走的是项目统一账号，也常常没有 `credential.accountRef` / `sessionMode`。
- shared session 复用依赖这两个字段；缺失时会退化成每次都重走登录前置检查，导致“实时画面”出现偏晚。
- 现有实时日志只展示“正在前置检查 / 正在分析”，没有把 precheck 实际耗时透出，慢点不够可见。

## 本轮目标
- 让项目统一账号 run 默认具备 shared session cache key。
- 保持 legacy 项目 run 不会因为这两个默认字段而误触发 runtime governance 拦截。
- 在实时日志里补最小 precheck 耗时与复用模式提示。

## 验收标准
- [ ] 项目统一账号 run 会默认带出 `credential.accountRef` 与 `sessionMode=shared`
- [ ] 上述默认字段不会把 legacy 项目 run 提升成强治理拦截
- [ ] precheck 完成后，实时日志会带出复用模式与耗时
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `lib/server/intent-e2e-project-auth.ts`
  - `lib/intent-e2e-runtime-governance.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-project-auth.spec.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
- 不会改：
  - 数据库 schema
  - launch decision 主规则
  - 浏览器实时画面协议

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening follow-up
- 对应小步：补齐项目统一账号 run 的 shared session 默认命中条件
- 本轮完成后准备回写到：如需要，再补到后续 hardening 更新

## 计划修改点
- project auth merge 时补齐项目账号的 shared-session 默认字段
- runtime governance 判定把“仅项目凭证会话元数据”视为非强治理
- precheck 成功日志补 `reuse mode + duration`

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-project-auth.spec.ts tests/unit/intent-e2e-service.spec.ts`

## 风险 / 未覆盖
- 本轮仍不处理首次 run 的浏览器冷启动成本
- shared session 仍只在当前 Node 进程内生效

## 完成后动作
- 如这刀被真实 rerun 验证有效，再决定是否回写 hardening 主文档
