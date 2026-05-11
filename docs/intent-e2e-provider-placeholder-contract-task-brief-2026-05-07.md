# Task Brief

## 标题
- LLM provider 切换占位契约收口

## 背景
- README 后续建议还剩 provider 切换占位。
- 当前 UI 和服务端已经散落了 `openai` 已实现、`gemini / claude` 预留的判断，但缺少共享 provider catalog，容易让不同入口展示或保存口径漂移。

## 本轮目标
- 把 OpenAI / Claude / Gemini 的 provider 选项、实现状态和说明收口到共享配置契约。
- API 返回结构化 provider options，前端只消费这份契约。
- 保持执行层不变：运行时仍只允许 `openai` adapter。

## 验收标准
- [ ] `GET /api/llm/config` 返回 provider options，且 `openai` 为 implemented、`claude / gemini` 为 placeholder。
- [ ] 首页配置弹窗和意图工作台 provider select 使用同一份 provider options。
- [ ] `assertSupportedLLMProvider` 仍会阻止非 `openai` provider 进入执行层。

## 范围
- 会改：
  - `lib/llm/provider-config.ts`
  - `lib/llm/admin-config.ts`
  - `lib/llm-client.ts`
  - `lib/llm-config-browser.ts`
  - `components/LLMConfigDialog.tsx`
  - `components/IntentE2EWorkbench.tsx`
  - `components/ProjectIntentTaskCreateDialog.tsx`
  - `tests/unit/provider-config.spec.ts`
  - `tests/unit/api-llm-config-route.spec.ts`
  - `README.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - LLM 执行 adapter
  - benchmark / release-readiness / traffic-quality 统计口径
  - 数据库 schema

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：post release readiness hardening 后续建议
- 对应小步：完善 provider 切换占位（OpenAI / Claude / Gemini），保持执行层不变
- 本轮完成后回写：第五百二十六次更新

## 验证
- `npx vitest run tests/unit/provider-config.spec.ts tests/unit/api-llm-config-route.spec.ts tests/unit/api-llm-config-test-route.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:unit`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不实现 Claude / Gemini adapter，只把 placeholder 契约固化。
- 非 OpenAI provider 可以保存为团队共享配置，但运行前仍会被 UI 和服务端执行门禁阻止。

## 完成后动作
- 回写 roadmap。
- 从 README 下一步建议移除已完成的 provider 占位项。
