# Intent E2E Post Release Readiness Validation Stability Task Brief（2026-05-07）

## 背景

Post release readiness hardening 后补跑全量 unit 时发现两个稳定性问题：

- recipe 已明确命中 `business.create-to-order` 时，确定性模板仍被旧的 `looksLikeBusinessCreateOrderTask(...)` 文案判断挡住，导致回退到 LLM Prompt 构造。
- capability verification queue 的失败压力单测使用固定 `2026-04-06/07` 活动时间，随当前日期推进会滑出 14 天窗口。

## 目标

- 让 recipe-first 确定性模板真正以 recipe 命中为准，不再被旧文案启发式二次拦截。
- 让 capability verification queue 失败压力单测固定当前时间，避免因日历日期推进反复失败。

## 范围

- 更新 `lib/test-generator.ts` 的 `business.create-to-order` recipe-first template resolver。
- 更新 `tests/unit/capability-verification-service.spec.ts`，仅 mock `Date` 当前时间。
- 不调整 benchmark harness、release-readiness 口径、document family verifier 或 OCR 主链路。

## 验收

- `tests/unit/test-generator-structured.spec.ts` 中 recipe 命中短路用例不调用 LLM。
- `tests/unit/capability-verification-service.spec.ts` 中 14 天失败压力用例不再依赖真实当前日期。
- 全量 unit 可稳定通过。

## 验证命令

- `npx vitest run tests/unit/test-generator-structured.spec.ts`
- `npx vitest run tests/unit/capability-verification-service.spec.ts`
- `npm run test:unit`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
