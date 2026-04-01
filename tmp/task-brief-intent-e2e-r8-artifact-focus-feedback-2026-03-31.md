# Task Brief

## 标题
- R8 第三十一刀：execution artifact focus feedback

## 背景
- `R8` 第三十刀已经让 conversation 上的 `executionArtifactContext` 可以“查看关联产物 / 下载关联脚本”。
- 但当前“查看关联产物”仍只是普通 anchor 跳转；落到 artifact 区后没有额外的聚焦反馈，列表较长时不够稳。
- roadmap 下一步已经收敛到：围绕 `executionArtifactContext` 增加更强的聚焦反馈，而不是继续扩 server-side contract。

## 本轮目标
- 给执行页 artifact 区补最小聚焦反馈。
- 让 conversation 点击关联产物后，artifact 卡片能稳定进入 focused 状态，并兼容直接打开带 hash 的 URL。

## 验收标准
- [ ] shared helper 能从 location hash 读取 artifact anchor，并判断某条 artifact 是否处于 focused 状态。
- [ ] `ExecutionWorkbench` 的 artifact 卡片在命中 hash / 点击关联产物后有明确 focused 样式。
- [ ] `ExecutionConsole` 同样支持上述聚焦反馈。
- [ ] 相关 unit / build / build:web / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/execution-workspace-link-contract.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/test-plan-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - artifact 持久化结构
  - 复杂高亮动画或新面板

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第三十一刀，围绕 `executionArtifactContext` 增加更强的聚焦反馈
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 shared helper 增加 artifact hash/focus 解析 helper
- 在两处执行页读取 URL hash，并把命中的 artifact 卡片渲染成 focused 状态
- 补 helper 级最小单测

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只提供 focused 样式反馈，不做复杂动画或临时 toast
- 仍依赖现有 anchor 机制，不增加新的 artifact query / filter 状态

## 完成后动作
- 回写 roadmap
