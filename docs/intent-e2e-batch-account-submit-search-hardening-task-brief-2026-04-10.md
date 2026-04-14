# Task Brief

## 标题
- 订单批量入账提交 / 回查硬等待与弹窗前变量提取收口

## 背景
- 连续多条真实 run 证明，订单批量入账链路已经从“行选择失败 / cancel drift”迁移到更后面的执行收敛问题：
  - `intent-run-cf83851c-aa8d-4bb8-b804-83fec96ac618`：修复轮仍在弹窗前硬要求 `selectedServiceItem / selectedAmount` 非空，导致还没走到 modal fallback 就失败。
  - `intent-run-ffc3a9f2-c4f6-432d-82f8-9f4a62350d12`：Step 3/4/5 已通过，但 Step 6 仍把 `/account` POST 当成必须命中的提交证据；Step 7 / verification 仍把 `/account` GET 当成硬等待。
- 当前问题已经不是业务链完全不可执行，而是生成器 post-sanitize 还不够严，旧坏代码仍能漏进执行。

## 本轮目标
- 把 batch-account 场景里三类高频坏模式做成 deterministic sanitizer：
  - 弹窗前就硬要求 `selectedOrderNo / selectedServiceItem / selectedAmount` 全部 truthy
  - `/account` POST 提交等待是必需证据
  - `/account` GET 搜索回查必须命中新请求

## 验收标准
- [ ] Step 3 缺少 `selectedServiceItem / selectedAmount` 时不再在 modal 前直接失败
- [ ] Step 4 modal fallback 会额外做文本级字段兜底，并避免把非数字文本写进 `selectedAmount`
- [ ] Step 6 `/account` POST 等待降级为短超时弱依赖，不再阻塞 `observeSubmitState`
- [ ] Step 7 / verification `/account` GET 等待降级为短超时弱依赖
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
- 不会改：
  - 数据库 schema
  - runtime helper 签名
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`

## 风险 / 未覆盖
- 这轮仍是 batch-account 专项 deterministic hardening，不等于该场景已经完全 recipe 化。
- 真实通过率仍要等新的 `intent-run-*` 数据验证；仓库当前的 smoke 仍受既有 `next build --webpack` / `node:crypto` 问题影响。
