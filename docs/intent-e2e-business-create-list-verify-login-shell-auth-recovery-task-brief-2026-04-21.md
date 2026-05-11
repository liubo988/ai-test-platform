# Task Brief

## 标题
- `商机222` create-list-verify login-shell auth recovery

## 背景
- `intent-run-4a69cdf1-97e5-4e4c-bd54-e873b1b5c94b` 已证明前两轮 shared fix 生效：
  - 不再回退到 `business.create-order-flow`
  - 不再复用 stale `draft_first_pass`
  - fresh generate 的 `label: /.+/` 与 `/crmapi/business/createOrder` 旧骨架也已不再是当前 blocker
- 当前真实失败已经前移到统一登录 helper：
  - repair observation 明确显示页面停在登录方式选择壳页
  - 页面可见 `企业微信登录 / 管帮手登录 / 短信验证码登录`
  - 同时存在 `iframe[src*="qrConnect"]`
  - 但 `__e2e.ensureLoggedIn(...)` 把这个壳页误判成“不是登录页”，导致后续脚本直接在登录页上找商机列表锚点

## 本轮目标
- 修复 `__e2e.ensureLoggedIn(...)` 对登录方式选择壳页的识别。
- 让统一登录 helper 能从该壳页继续切到 `短信验证码登录` 表单并完成登录，而不是提前返回。

## 验收标准
- [ ] 登录方式选择壳页会被识别为 login surface，而不是业务页
- [ ] `__e2e.ensureLoggedIn(...)` 在“企业微信登录 / 管帮手登录 / 短信验证码登录 + qrConnect iframe”形态下会继续走登录流程
- [ ] 新增 worker 级回归测试覆盖该精确壳页形态
- [ ] `商机222` fresh rerun 不再停在登录壳页上找 `新建商机`

## 范围
- 会改：
  - `lib/intent-e2e-auth-shared.mjs`
  - `lib/test-worker.mjs`
  - `tests/unit/test-executor.spec.ts`
  - `docs/intent-e2e-business-create-list-verify-login-shell-auth-recovery-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-generator.ts`
  - benchmark harness
  - 数据库 schema
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：`Phase 5 / 第二刀` 并行进行中；本轮只修 shared auth helper，不改变 Phase 5 判定
- 对应小步：`商机222` fresh rerun 暴露出的 login-shell blocker recovery
- 本轮完成后准备回写：`2026-04-21` 新增一条 shared auth recovery update

## 计划修改点
- 在 shared auth 模式里补登录壳页可见锚点模式
- 在 `isLikelyLoginPage(...)` 中加入 login shell 检测
- 新增一条 worker 级 regression，模拟：
  - 首屏只有 `企业微信登录 / 管帮手登录 / 短信验证码登录`
  - 点击 `短信验证码登录` 后才展开表单

## 验证
- `npx vitest run tests/unit/test-executor.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- fresh rerun `商机222`

## 风险 / 未覆盖
- 本轮只收口登录壳页识别，不扩到登录凭证来源或 session governance 语义调整
- fresh rerun 若继续失败，必须以新 trace 为准；不预设后续一定通过

## 完成后动作
- 回写 roadmap
- 对 `商机222` 做 fresh rerun，确认真实 blocker 是否已转移或收口
