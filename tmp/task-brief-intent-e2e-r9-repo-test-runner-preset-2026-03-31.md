# Task Brief

## 标题
- R9 repo_test_runner 最小受控 preset 执行骨架

## 背景
- `R9` 已经完成统一 runner adapter、`http_runner` 执行链和 repair / restore 平台 tag 继承。
- roadmap 明确要求 `repo_test_runner` 必须是受控执行，不允许任意 shell，自由命令需要收口到 allowlist / manifest / repo-owned preset。
- 当前 `repo_test_runner` 仍是显式未实现占位，无法进入真实执行链。

## 本轮目标
- 只落一个最小可执行的 `repo_test_runner` preset contract，让 tagged `repo_test` plan 能以 allowlist 方式执行 repo 内已有检查。

## 验收标准
- [ ] `repo_test_runner` 支持 JSON contract + allowlisted preset，不接自由命令。
- [ ] 至少一条 `repo_test` 执行链能通过 `executePlan` 跑通并进入现有 artifact / event 链。
- [ ] 非 allowlisted preset 或非法 target 会明确失败。

## 范围
- 会改：
  - `lib/intent-runner-adapter.ts`
  - `tests/unit/intent-runner-adapter.spec.ts`
  - `tests/unit/test-plan-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - 无关 UI
  - 生成侧 planner / import 入口

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：R9
- 对应小步：repo_test_runner 最小受控 preset 执行骨架
- 本轮完成后准备回写到哪一条更新：R9 下一条增量更新

## 计划修改点
- 为 `repo_test_runner` 定义最小 preset allowlist contract。
- 在 adapter 内实现受控子进程执行、trace / report artifact 输出。
- 补 adapter 与 `executePlan` 的 focused 覆盖。

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-runner-adapter.spec.ts tests/unit/test-plan-service.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run test:e2e`

## 风险 / 未覆盖
- 本轮不做完整 manifest 文件和多仓库接入，只做 repo 内 hard-coded preset allowlist。
- 本轮不扩到 `contract_runner`。

## 完成后动作
- 回写 roadmap
