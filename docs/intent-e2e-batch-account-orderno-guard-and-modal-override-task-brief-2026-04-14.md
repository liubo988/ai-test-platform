# Task Brief

## 标题
- 订单批量入账 Step 3 错主键守卫与 modal 订单号纠偏

## 背景
- fresh-path live run `intent-run-40449b10-29d1-4deb-8853-3c55d2854249` 已证明当前失败点不在 Step 7 搜索动作，而在更前面的主键提取：
  - Step 3 把 `H202600056` 这类短字母前缀码写进了 `selectedOrderNo`；
  - Step 4/5/6/7 仍能走通；
  - Step 8 最终失败为 `未找到表格目标行：hasTexts=H202600056`。
- 同一条 run 的 modal / 提交链路里已经能读到真实长数字订单号，但现有 modal fallback 只会在 `selectedOrderNo` 为空时回填，无法纠正明显错误的旧值。

## 本轮目标
- 让 batch-account Step 3 sanitizer 能拦住 `H202600056` 这类错主键，同时继续接受真实长数字订单号。
- 覆盖 fresh live run 里 `linkNo / filtered` 这类旧生成变体，不要求它必须先命中 structured slot patch。
- 让 modal fallback 在读到更可信的订单号时，能覆盖明显错误的旧值，而不是只在空值时生效。

## 验收标准
- [ ] `sanitizeGeneratedCode()` 会把 live run 里的 `linkNo / filtered` Step 3 变体重写成允许长数字订单号、拒绝短字母前缀码的守卫。
- [ ] modal fallback 生成代码里存在“当前值无效或 modal 值更强时覆盖 `selectedOrderNo`”的逻辑。
- [ ] 相关 unit tests 通过。
- [ ] `npm run build` 通过。

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - route / UI
  - `lib/test-worker.mjs` 通用 helper 语义

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：批量入账执行期收口
- 对应小步：Step 3 错主键守卫 + modal 订单号纠偏
- 本轮完成后准备回写到哪一条更新：2026-04-14 最新 roadmap 更新

## 计划修改点
- 在 `lib/test-generator.ts` 的 batch-account orderNo guard 里加入对短字母前缀码的拦截。
- 补 Step 3 live run `linkNo / filtered` 变体的 sanitizer 命中范围。
- 在 modal fallback 里加入“坏旧值被更强 modal 值覆盖”的同步逻辑，并补回归。

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 这轮只收口 batch-account 已观测到的错主键形态，不泛化到所有 scenario family。
- 目前还没有补 fresh live rerun；真实运行收益先以 unit + 现有 run 证据为主。
- 如果后续又出现其他短码形态，可能还要继续扩充 targeted sanitizer。

## 完成后动作
- 回写 roadmap
- 视用户是否继续要求 live verify，决定是否再补 fresh rerun
