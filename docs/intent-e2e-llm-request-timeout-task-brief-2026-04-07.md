# Task Brief

## 标题
- intent-e2e：收口 generate 阶段 LLM 请求无限挂起

## 背景
- 最新真实 run `intent-run-1455594f-0002-49b4-a2f7-0dd0e1952a74` 已进入 `generating`，并命中旧草稿骨架保护。
- 但 run 在 `generating` 长时间不再更新，`updatedAt` 停在同一时间点，说明当前 generate 阶段的 LLM 请求存在无限挂起窗口。
- 现有主链路已对 `analyzePage()` 和 repair 观察补过超时，但 LLM client 层还没有显式请求超时。

## 本轮目标
- 只为 LLM 请求补显式超时保护。
- 让 generate / repair 阶段的 LLM 请求在超时后尽快失败或进入既有降级，而不是无限挂起。
- 不调整业务策略，不改 ScenarioCard / ExecutionPlan / verifier 逻辑。

## 验收标准
- [ ] LLM 请求支持统一超时配置
- [ ] hanging request 超时后返回明确错误，不再无限挂起
- [ ] Responses API 遇到 abort/timeout 不再继续无意义重试
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `lib/llm/provider-config.ts`
  - `lib/llm-client.ts`
  - `lib/openai-responses.js`
  - `tests/unit/provider-config.spec.ts`
  - `tests/unit/llm-client-structured.spec.ts`
  - `tests/unit/openai-responses.spec.ts`
- 不会改：
  - 数据库 schema
  - route 契约
  - generate / repair prompt 语义

## 必读上下文
- `AGENTS.md`
- `docs/testing.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening follow-up
- 对应小步：执行主链路抗悬挂保护
- 本轮完成后准备回写到：真实 rerun 继续观察 generating 卡死是否退出

## 计划修改点
- 为 runtime config 增加请求超时配置
- 在 chat / responses LLM 调用上统一接入超时 signal
- 避免 Responses API 在 abort/timeout 后继续重复重试

## 验证
- `npm run build`
- `npx vitest run tests/unit/provider-config.spec.ts tests/unit/llm-client-structured.spec.ts tests/unit/openai-responses.spec.ts`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 本轮只处理 LLM 请求悬挂，不处理模型端真实慢响应的业务优化
- 旧的已挂起 run 不会自动恢复，需要新 run 验证

## 完成后动作
- 用新的真实 run 验证 generate 阶段不再无限挂起
