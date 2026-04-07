# Task Brief

## 标题
- intent-e2e 生成流 partial code fail-fast

## 背景
- 真实 run `intent-run-7522e5ee-c4e5-4f55-970f-0f24e82ff995` 暴露出一类主链问题：
  - 生成 / repair 阶段已经出现 `LLM 调用失败: LLM 请求超时 (60000ms)`
  - 运行时仍继续把未完成的流式代码残片交给 worker 执行
  - 最终表现成 worker 模块加载期 `SyntaxError`，掩盖了真正的 LLM 超时原因
- 这会误导 triage，也会让“原本可一次通过”的草稿看起来像执行逻辑回归。

## 本轮目标
- 阻断 `error without complete` 时继续执行 partial code 的 fail-open 分支。
- 保留已有的“error 后 fallback，最终仍有 complete”这类正常链路。

## 验收标准
- [x] 生成流出现 `error` 且没有 `complete` 时，直接失败，不再执行残片代码。
- [x] 生成流若最终有 `complete`，仍保持现有成功路径。
- [x] 至少有一条单测覆盖 `LLM timeout -> partial code` 的回归场景。

## 范围
- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/intent-runner-adapter.spec.ts`
- 不会改：
  - 数据库 schema
  - 草稿入口跳转逻辑
  - worker 模板 helper 语义

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：LLM partial-code fail-fast
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- `collectGeneratedCode()` 在 `lastError && !complete` 时直接抛错。
- 为流式 partial code 场景补单测，确保不会再进入 `executeTest()`。
- 顺手修正 `intent-runner-adapter` 单测里对 `executeTest(..., options)` 的旧签名预期。

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `npm run test:e2e`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮只阻断 partial code 执行，不重做 generation error 的 attempt 归档模型。
- `npm run test:unit` 仍存在与本轮无关的既有失败，不在本轮收口。

## 完成后动作
- 回写 roadmap
