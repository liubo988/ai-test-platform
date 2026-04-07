# Task Brief

## 标题
- intent-e2e 首轮提速：无 fixture 场景复用 precheck snapshot

## 背景
- 当前 `/intent-e2e` 在首轮生成前会串行执行 `precheckPageAccess()` 和 `analyzePage()`。
- 两段逻辑都会单独启动浏览器、进入目标页面并等待稳定，导致“实时日志”链路变长，也推迟了后续代码生成与执行会话启动。

## 本轮目标
- 只在无 fixture setup 的场景下复用 precheck 阶段采集的页面 snapshot。
- 跳过后续重复的 `analyzePage()` 二次进页，缩短首轮生成前等待。

## 验收标准
- [ ] 无 fixture setup 时，service 复用 precheck snapshot，`analyzePage()` 不再调用。
- [ ] 有 fixture setup 时，仍保持现有行为，继续在 setup 后单独 `analyzePage()`。
- [ ] `tests/unit/intent-e2e-service.spec.ts` 覆盖复用与不复用两条分支。

## 范围
- 会改：
  - `lib/page-analyzer.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
- 不会改：
  - compiler / verifier / worker
  - 公共 API route 契约
  - DB schema

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening
- 对应小步：运行前链路减时
- 本轮完成后：不单独回写 roadmap，只作为当前 bugfix / latency 优化收口

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts`
- `npm run build`

## 风险 / 未覆盖
- 本轮不提前创建执行 session；只缩短前置串行耗时，不改变实时画面启动时机定义。
- 有 fixture setup 的场景继续保守走原链路，不做 snapshot 复用。
