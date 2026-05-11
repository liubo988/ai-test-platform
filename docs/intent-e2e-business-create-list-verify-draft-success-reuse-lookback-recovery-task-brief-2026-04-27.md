# Task Brief

## 标题
- intent-e2e：商机222 草稿成功脚本复用窗口恢复

## 背景
- `商机222` 在 2026-04-22 已有真实 first-pass passed run：`intent-run-83a498d1-086e-4dd8-9ce0-2c707a4b1f17`。
- 2026-04-27 同一草稿再次运行时，最近 12 条同 module passed run 已被其他订单 / 入账样本占满，导致该 passed run 未被候选复用。
- 服务端转而复用最近 failed progressed run，脚本持续卡在 Step 2 的“关联产品意向信息 / 企业名称”锚点。

## 本轮目标
- 让带 `intentDraftUid` 的草稿启动和正式任务导入，都能在同草稿精确匹配下找回较早的成功脚本。
- 保持 request-only 复用窗口不扩大，避免无草稿场景误吃过旧脚本。

## 验收标准
- [ ] `intentDraftUid + input + targetUrl` 精确匹配时，成功脚本复用窗口覆盖 120 条 snapshots。
- [ ] 当窗口内存在匹配 passed run 时，不再回落到 failed progressed run。
- [ ] 意图草稿导入正式任务时同样优先复用较早的匹配 passed run。
- [ ] 相关 unit / build / roadmap 校验通过。

## 范围
- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `lib/services/project-intent-draft-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/project-intent-task-service.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - DB schema
  - benchmark harness
  - 执行器底层点击逻辑

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/project-intent-task-service.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 这次修复的是成功脚本候选窗口过窄，不直接改 Step 2 点击 / 表单切换逻辑。
- 若同草稿输入或附件数量发生实质变化，仍应以新的 fresh run 为准。
