# Task Brief

## 标题
- test-executor TS fallback 避免误伤 batch-account repair 三元表达式

## 背景
- `intent-run-bbc7ea9e-3119-4841-9f8e-b87785385cd5` 的 attempt 2 repair patch 在 DB / trace 中仍是合法 JS。
- 真正落到 `tests/e2e/generated/worker-*.mjs` 时，`const part = (await (rowKey ? rowSources.nth(i) : row).innerText().catch(() => '')).replace(...)` 被改坏成 `rowSources.nth(i)=> ''`，在 worker import 前直接 SyntaxError。
- 根因不在 batch-account 业务 slot 本身，而在 `lib/test-executor.ts` 的 TypeScript fallback 正则把三元表达式 `?:` 误判成箭头函数返回类型。

## 本轮目标
- 只修 `prepareTestCodeForExecution()` / `tsToJs()` 对 JS 三元表达式的误伤。
- 补一条直接复刻 `rowKey ? rowSources.nth(i) : row` 的回归测试，确保今后 repair code 不会在落 worker 前再次损坏。

## 验收标准
- [ ] 含 TS fallback 的代码在出现 `rowKey ? rowSources.nth(i) : row` + `.catch(() => '')` 时，不再被改写成 `=> ''`
- [ ] `getTestCodeSyntaxError()` 对该回归样例返回空串
- [ ] 受影响 unit tests 与 `npm run build` 通过

## 范围
- 会改：
  - `lib/test-executor.ts`
  - `tests/unit/test-executor.spec.ts`
- 不会改：
  - 数据库 schema
  - batch-account 业务 verifier / sanitizer
  - UI / route

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 后续 batch-account hardening 补漏
- 对应小步：执行器兼容层不再破坏 repair 生成的合法 JS
- 本轮完成后回写：roadmap 最新一条更新

## 验证
- `npx vitest run tests/unit/test-executor.spec.ts`
- `npm run build`

## 风险 / 未覆盖
- 这轮不扩展为完整 parser，只收窄当前正则误判范围。
- 如果后续还存在其他 TS fallback 误伤模式，需要再补更细的回归样例。

## 完成后动作
- 回写 roadmap
- 复核最新真实 run 是否仍停在同类执行面语法错误
