# Task Brief

## 标题
- post-R14 success hardening close-out follow-up：浏览器 runtime 噪音 `null.forEach` 降噪

## 背景
- 最新多次真实 rerun 已反复出现：
  - 目标业务页在进入 `#/business/detail/:id` 后，会额外输出 `Cannot read properties of null (reading 'forEach')`
- 这类日志目前会以 `ERROR` 级别直接进入 worker attempt logs。
- 现场证据显示它常与以下情况并存：
  - 当前 run 已真实通过
  - 或后续已有更准确的结构化失败收口，例如 `detail surface invalid page`
- 继续把这类已知业务页 runtime 噪音作为红色执行错误展示，会误导工作台实时日志和人工判断。

## 本轮目标
- 只收口已知浏览器 runtime 噪音 `Cannot read properties of null (reading 'forEach')` 的日志归一。
- 当该噪音来自页面 `console` / `pageerror` 时：
  - 不再以前台 `ERROR` 形式展示
  - 改为可识别、可追踪的 `WARN`
  - 保留原始消息到 `meta`，避免完全丢证据

## 验收标准
- [ ] worker 对已知 `null.forEach` 页面噪音会降级成 `warn`
- [ ] 降级后日志仍保留 `noiseCode / originalMessage / originalLevel`
- [ ] 同类噪音不再以原始红色错误直接进入前台
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `lib/test-worker.mjs`
  - `tests/unit/test-executor.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - `lib/ai/intent-e2e-service.ts` 主 repair / planning 逻辑
  - `lib/test-generator.ts`
  - DB / API 契约
  - 无关 UI / 样式

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening（已 close-out，当前只做 close-out 后 follow-up）
- 对应小步：非阻塞运行时噪音最小收口
- 本轮完成后回写：
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`

## 计划修改点
- worker：
  - 给浏览器 `console` / `pageerror` 增加已知 runtime 噪音归一
  - 降级 `null.forEach` 为 `warn`
  - 用 `meta` 保留原始消息和噪音编码
- 单测：
  - 补 `console.error` 场景
  - 补 `pageerror` 场景

## 验证
- `npx vitest run tests/unit/test-executor.spec.ts -t "runtime noise"`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不处理业务页面自身 `null.forEach` 根因
- 本轮不扩到其它 console/pageerror 噪音分类
- 本轮不承诺 repair 成功率提升，只收前台误导性错误展示

## 完成后动作
- 按 roadmap 模板回写本轮 follow-up
