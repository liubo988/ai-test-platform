# Task Brief

## 标题
- R9 repo_test_runner repo-owned manifest / registry 上提

## 背景
- 上一刀已让 `repo_test_runner` 支持最小受控 preset 执行。
- 当前 preset allowlist 仍直接 hard-code 在 `lib/intent-runner-adapter.ts`，新增或调整 preset 仍要改 adapter 本体，不符合 roadmap 里“repo-owned manifest / registry”的收口方向。

## 本轮目标
- 把 `repo_test_runner` 的 preset allowlist 从 adapter 中拆到 repo-owned manifest / registry，保持现有受控执行语义不变。

## 验收标准
- [ ] preset 定义迁移到独立 manifest / registry 文件。
- [ ] adapter 通过 registry 解析 preset、命令和 target policy。
- [ ] 现有 `repo_test_runner` 执行链与 focused artifact 留痕行为保持通过。

## 范围
- 会改：
  - `intent-e2e.repo-test-runner-presets.json`
  - `lib/repo-test-runner-preset-registry.ts`
  - `lib/intent-runner-adapter.ts`
  - `tests/unit/repo-test-runner-preset-registry.spec.ts`
  - `tests/unit/intent-runner-adapter.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - 无关 UI
  - `contract_runner` 真实执行

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：R9
- 对应小步：repo_test_runner repo-owned manifest / registry
- 本轮完成后准备回写到哪一条更新：R9 下一条增量更新

## 计划修改点
- 新增 repo-owned preset manifest 和 registry helper。
- adapter 改为通过 registry 校验 preset / targets / command。
- 补 registry unit tests，并回归 adapter 目标测试。

## 验证
- `npm run build`
- `npx vitest run tests/unit/repo-test-runner-preset-registry.spec.ts tests/unit/intent-runner-adapter.spec.ts tests/unit/test-plan-service.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run test:e2e`

## 风险 / 未覆盖
- 本轮只把 hard-coded preset 上提成 repo-owned manifest / registry，不引入运行时外部配置写入口。
- 本轮不扩展新的 preset 类型。

## 完成后动作
- 回写 roadmap
