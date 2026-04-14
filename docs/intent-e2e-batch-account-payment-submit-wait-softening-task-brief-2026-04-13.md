# Task Brief

## 标题
- batch-account `/payment` 提交等待改成短超时 best-effort 收口

## 背景
- 新 run `intent-run-b54cd539-8eac-49ab-bd4f-e8666334a313` 已经证明上轮 `Step 1` row-surface 无副作用修复确实生效，repair 生成代码不再在 `Step 1` 提前勾选真实订单行。
- 这条 run 的后续 repair attempt 暴露了新的 deterministic blocker：点击“批量申请入账”弹窗里的“确定”后，脚本硬等 `__e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'POST' })`，最终报 `page.waitForResponse: Timeout 15000ms exceeded while waiting for event "response"`。
- 现场日志显示真实业务已完成勾选、打开弹窗并触发提交，但生成脚本把 `/payment` POST 响应当成了强前提；一旦接口路径或请求时机与这条宽泛等待不完全匹配，就会白白耗掉 15 秒并触发 repair。

## 本轮目标
- 把 batch-account `/payment` 提交等待从 hard wait 改成短超时 best-effort，不再把“命中某个 POST 响应”当成提交成功的唯一前提。
- 保持后续 `__e2e.observeSubmitState(...)` 作为真正的提交收敛证据，避免因为接口匹配漂移再次在提交前卡死。
- 用单测直接固定这次 live 失败代码形态，防止 sanitizer 回退。

## 验收标准
- [ ] `/payment` POST 的 `waitForApiResponse(...)` 会被改写为 `timeoutMs: 2500 + expectOk: false + catch(() => null)`
- [ ] 生成代码不再因为 `/payment` POST 未命中而等待 15 秒
- [ ] 新增 generator regression 可稳定复刻并通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - route / UI
  - `lib/test-worker.mjs`
  - task-platform 总超时策略

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 后续 batch-account hardening 补漏
- 对应小步：`/payment` 提交响应 hard wait 收口
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 扩展 `sanitizeBatchAccountSubmitAndSearchWaits(...)`，让 `/payment` POST 和既有 `/account` POST 一样走短超时 soft wait
- 新增一条基于 live code 片段的 regression，锁定 `Step 4` 提交阶段的 `/payment` POST 漂移
- 回写这次真实 run 的失败证据与修复结果

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 这轮不保证 `intent-run-b54cd539-8eac-49ab-bd4f-e8666334a313` 旧代码上的 server run 会自动变成功；它需要新的 rerun 才能吃到修复。
- 这轮只收口 `/payment` POST 等待过硬，不处理后续若继续后移到 `bookedMgmt` 回查或金额字段断言的潜在 blocker。

## 完成后动作
- 回写 roadmap
- 基于这版继续观察 batch-account rerun 是否已跳过提交等待超时，继续后移到真正的结果校验阶段
