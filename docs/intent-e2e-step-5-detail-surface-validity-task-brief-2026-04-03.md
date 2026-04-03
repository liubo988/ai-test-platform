# Task Brief

## 标题
- post-R14 success hardening：Step 5 / Step 7 detail surface validity 单刀收口

## 背景
- `2026-04-03` forced replay `intent-run-2c467bf8-18ca-4881-9f9d-1886a7f05f50` 已确认上一刀 `titleIncludes -> detail page section` 代码链真实生效。
- 但同一 run 的 `attempt-2` 继续暴露新的头阻塞：
  - 已进入 `#/business/detail/521201`
  - 随后出现 `Cannot read properties of null (reading 'forEach')`
  - 两次 `detail field not found`
- 现场只读取证已确认当前 `detailUrl` 打开的不是有效详情 surface，而是业务错误页：
  - `抱歉！页面好像不见了, 请联系管理员!`
- 当前主链路仍把 `detailUrl` 默认当有效详情链使用，缺少“详情页是否真进入了可读 surface”的最小校验。

## 本轮目标
- 只收“detailUrl fallback 命中错误页时，如何更早识别并给出准确收口”这一条。
- 保持最小改动：
  - 不发散去猜默认 row action
  - 不改 DB / API 契约
  - 不扩到无关 family

## 验收标准
- [ ] worker 能识别“详情标题未出现且当前页是已知错误页”这类 invalid detail surface
- [ ] direct `detailUrl` fallback 在读详情字段前先做 surface validity guard
- [ ] 单测覆盖 invalid detail surface 的 worker / compiler / repair prompt 行为
- [ ] 受影响构建与脚本通过

## 范围
- 会改：
  - `lib/test-worker.mjs`
  - `lib/intent-execution-compiler.ts`
  - `lib/test-generator.ts`
  - `tests/unit/test-executor.spec.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
  - `tests/unit/test-generator.spec.ts`
- 不会改：
  - `detailEntry` 规则生成
  - DB schema / 公共 API 契约
  - 其它 family 的 verifier 语义

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`
- `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening
- 对应小步：`Step 5 / Step 7 detail surface validity`
- 本轮完成后回写：
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
  - `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`

## 计划修改点
- worker：
  - 增加最小 detail surface ready / invalid-page 识别
  - 在 `readDetailField(...)` 中复用该识别，避免在明显错误页上盲等
- compiler：
  - `detailUrl` fallback 后先校验 detail surface，再读 `商机进展 / 状态`
- repair prompt：
  - 对“detailUrl 已进入但当前页不是有效详情 surface”补定向诊断提示
- 单测：
  - 补 invalid detail surface 回归
  - 补 compiler guard 断言
  - 补 repair hint 回归

## 验证
- `npx vitest run tests/unit/test-executor.spec.ts -t "invalid detail surface"`
- `npx vitest run tests/unit/intent-execution-compiler.spec.ts -t "detail surface"`
- `npx vitest run tests/unit/test-generator.spec.ts -t "invalid detail surface"`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不解决业务侧 `null.forEach` 根因
- 本轮不保证自动切换到 row action / drawer fallback
- 本轮主要提升错误分型与 repair 指向，不承诺直接打通所有真实 run
