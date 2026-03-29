# Task Brief Template

用于非 trivial 开发任务的起始 brief。目标是让每次任务在开工前就固定：

- 目标
- 边界
- 验收标准
- 验证命令
- 与 roadmap 的关系

简单的一行修复或纯文案微调可以不单独写；跨多文件、跨层级、涉及 `intent-e2e` 主链路的任务，建议先写。

## 模板

```md
# Task Brief

## 标题
- 一句话标题

## 背景
- 这次为什么做
- 当前问题或观察到的失败模式

## 本轮目标
- 本次只解决什么

## 验收标准
- [ ] 条件 1
- [ ] 条件 2
- [ ] 条件 3

## 范围
- 会改：
  - `path/to/file`
  - `path/to/file`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- 如涉及 `intent-e2e`：`docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：
- 对应小步：
- 本轮完成后准备回写到哪一条更新：

## 计划修改点
- 修改点 1
- 修改点 2

## 验证
- `npm run build`
- `npm run test:unit -- ...`
- `npm run build:web`
- `npm run test:integration`
- `npm run test:e2e`
- 如改 roadmap：`node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 风险 1
- 风险 2

## 完成后动作
- 回写 roadmap
- 如长期规则变化，同步更新稳定文档
```

## Intent E2E 简版示例

```md
# Task Brief

## 标题
- R3 verifier 补 detail fallback 的稳定字段校验

## 背景
- 当前列表主键回查失败后，详情 fallback 仍偏骨架化，缺少稳定字段验收

## 本轮目标
- 把 `detail fallback` 的字段校验从泛化 TODO 收口成统一 helper + compiler 输出

## 验收标准
- [ ] verification plan 能稳定带出 detail field specs
- [ ] compiler 会生成固定 helper 骨架
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `lib/intent-execution-plan.ts`
  - `lib/intent-execution-compiler.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
- 不会改：
  - DB schema
  - 非 detail fallback UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R3.2
- 对应小步：detail fallback verifier 收口
- 本轮完成后回写：最新一条 roadmap 更新

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-execution-plan.spec.ts tests/unit/intent-execution-compiler.spec.ts`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 暂不处理新的 detailEntry trigger 类型

## 完成后动作
- 按 roadmap 模板回写“已完成 / 验证 / 风险 / 下一步”
```
