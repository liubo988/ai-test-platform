# Task Brief

## 标题
- post-R14 success hardening：Step 5 / Step 7 detail-status closure 单刀收口

## 背景
- `2026-04-03` 最新真实 rerun `intent-run-e3d72ab5-d7d4-4814-b2a5-614e8ac8c48f` 已确认：
  - `statusEvidenceRecordCheck`
  - `derivedBusinessId`
  - `matchedRecordByDerivedBusinessId`
  - `page.goto(#/business/detail/:id)`
  这些链路都已经真实生效。
- 当前新的真实头部失败已收敛为：
  - `状态证据缺失：列表行已命中，但列表响应与详情页均未返回状态`
- 日志证据显示：
  - 已进入 `#/business/detail/521197`
  - 随后连续出现 `detail field not found`
  - `readDetailField(...)` 当前在 page-detail 场景没有吃到 `titleIncludes` 的 page-scope，只能在 modal/drawer 场景利用标题缩小作用域

## 本轮目标
- 只收“已进入 detail route 后，如何稳定读到 `商机进展 / 状态`”这一条真实 top failure。
- 保持最小改动：
  - 不扩散到 runtime 其它链路
  - 不改 DB / API 契约
  - 不回退去重做旧的列表响应缺口

## 验收标准
- [ ] `readDetailField(...)` 在有 `titleIncludes` 且当前是详情页场景时，能先缩到标题对应的 page-detail 容器
- [ ] repair hint 明确要求：已知详情标题时，detail route fallback 保留 `titleIncludes`
- [ ] `tests/unit/test-executor.spec.ts`
- [ ] `tests/unit/test-generator.spec.ts`
- [ ] 受影响构建与脚本通过

## 范围
- 会改：
  - `lib/test-worker.mjs`
  - `lib/test-generator.ts`
  - `tests/unit/test-executor.spec.ts`
  - `tests/unit/test-generator.spec.ts`
- 视情况保持不改：
  - `lib/intent-execution-compiler.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
- 不会改：
  - DB schema / 公共 API 契约
  - 无关 family

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`
- `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening
- 对应小步：`Step 5 / Step 7 detail-status closure`
- 本轮完成后回写：
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
  - `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`

## 计划修改点
- helper：
  - 给 `readDetailField(...)` 增加 `titleIncludes -> detail page section` 的 page-scope fallback
- repair prompt：
  - 当脚本已进入 `#/business/detail/:id` 且当前链路已有详情标题（如 `商机详情`）时，要求继续保留 `titleIncludes`
- 单测：
  - 补 page-detail `titleIncludes` 回归
  - 补 repair hint 回归

## 验证
- `npx vitest run tests/unit/test-executor.spec.ts tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不处理状态码到业务文案映射
- 本轮不处理详情页自身 `null.forEach` 的页面运行时异常
- 本轮不做新的真实 rerun 自动化封装
