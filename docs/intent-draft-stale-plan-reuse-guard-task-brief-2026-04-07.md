# Task Brief

## 标题
- intent-e2e：草稿首版脚本旧骨架最小失效保护

## 背景
- 当前从意图草稿启动 run 时会优先复用 `prefilledPlanCode`。
- 真实 rerun 已证明，部分历史草稿里还保留旧的 `create_final_submit` 骨架，即使 compiler / prompt 已更新，首轮依然会继续命中旧错误。
- 这类问题不是当前生成链路失效，而是“老草稿脚本被无条件复用”。

## 本轮目标
- 只对已在真实 run 中确认过的旧 final-submit 骨架加最小失效保护。
- 命中旧骨架时，不复用草稿 `planCode`，直接回退到当前生成链路。
- 正常草稿 `planCode` 仍继续复用，不扩大影响面。

## 验收标准
- [ ] 命中已知旧 final-submit 骨架的草稿 `planCode` 不再直接复用
- [ ] 命中保护时，实时日志会明确提示“已回退到当前生成链路”
- [ ] 正常草稿 `planCode` 仍继续复用
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
- 不会改：
  - 数据库 schema
  - 草稿存储结构
  - launch decision 规则

## 必读上下文
- `AGENTS.md`
- `docs/testing.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening follow-up
- 对应小步：草稿旧脚本复用保护
- 本轮完成后准备回写到：如真实 rerun 继续验证稳定，再决定是否回写主 roadmap

## 计划修改点
- 在服务端 prefilled plan reuse 前增加最小旧骨架识别
- 命中时改走当前 `generateTest()` 链路
- 补充“正常复用 / 旧骨架跳过复用”两类单测

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-service.spec.ts`

## 风险 / 未覆盖
- 本轮只识别已经有真实 run 证据的一类旧骨架
- 不处理任意历史草稿兼容性升级

## 完成后动作
- 继续用真实 draft rerun 观察首轮是否还会掉进旧 final-submit family
