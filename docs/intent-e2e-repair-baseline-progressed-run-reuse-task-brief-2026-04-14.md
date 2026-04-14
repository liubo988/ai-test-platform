# Task Brief

## 标题
- intent-e2e repair 默认复用最近更远历史脚本作为基线

## 背景
- 当前系统虽然已经支持 generate 首轮复用 `recent_progressed_run`，但一旦进入 repair，基线仍只取上一轮 `currentCode`。
- 这会让 repair 在上一轮脚本已经退化、或只是新引入局部变量错误时，继续基于较差脚本修，浪费前面已验证通过的步骤资产。
- 用户明确要求系统表现出“自动学习、自动迭代升级”，而不是每次都重新乱修。

## 本轮目标
- 仅收口 repair 阶段的“基线脚本选择”。
- 当存在最近一次推进更远的历史失败 run，且它比当前上一轮脚本推进更远时，repair 优先基于这份历史脚本继续修，而不是死守当前上一轮脚本。
- 这轮不做 runtime 级跳过已成功步骤，不改执行器 checkpoint。

## 验收标准
- [ ] repair 可以自动识别并复用最近一次推进更远的历史脚本作为 `previousCode`
- [ ] 如果当前上一轮脚本并未退化，repair 仍保持现有行为，不盲目回退历史脚本
- [ ] 单测覆盖“repair 基线切换到 progressed history”与“当前脚本不退化时不切换”

## 范围
- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - route / UI
  - `lib/test-worker.mjs`
  - 执行器断点续跑

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-progressed-run-code-reuse-task-brief-2026-04-13.md`

## Roadmap 对齐
- 当前阶段：R7 后续学习闭环补漏
- 对应小步：repair 基线优先复用最近更远历史脚本
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 给 repair 新增历史 progressed-run 基线决策 helper
- 只在“历史脚本推进更远于上一轮当前脚本”时切换 `previousCode`
- 补 repair attempt log / telemetry，明确说明是否命中了历史脚本基线

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 这轮只解决 repair 输入基线，不保证 repair 一定成功；LLM 仍可能在此基线上生成新错误。
- 不做跨意图宽泛相似匹配，仍限定同草稿 / 同输入 / 同目标 URL。

## 完成后动作
- 回写 roadmap
- 后续评估是否需要把 repair 基线选择结果显式透出到 run review / insights
