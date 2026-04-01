# Task Brief

## 标题
- R7.5 第一刀：intent-e2e 项目知识与 repair memory 的项目级路径隔离

## 背景
- 当前 `intent-e2e` 的 project knowledge 与 repair memory 仍默认读写全局单文件。
- 这会导致多项目之间资产串扰，新项目冷启动时的成功率和修复路径被旧项目污染。
- roadmap 已将 `R7.5：多项目冷启动与资产隔离` 提前到 `R8` 之前，本轮先做最小、可验证的路径隔离切片。

## 本轮目标
- 为 `projectUid` 增加 project-aware knowledge / repair memory path resolver。
- 主运行链路、repair 写回、project knowledge draft / merge / backup / restore 统一走项目级路径。
- 保持 `projectUid` 为空时的旧行为不变；运行态读知识 / repair hint 时保留 legacy fallback。

## 验收标准
- [ ] `projectUid` 存在时，主运行链路不再默认把 knowledge / repair memory 写回全局文件。
- [ ] project knowledge draft / merge / backup / restore 使用项目级知识文件路径。
- [ ] repair hint 召回在项目文件不存在时可回退 legacy 全局文件，但项目写回进入项目文件。
- [ ] 相关 unit tests 通过。

## 范围
- 会改：
  - `lib/intent-project-knowledge.ts`
  - `lib/ai/intent-repair-memory.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/intent-project-knowledge-draft.ts`
  - `lib/test-generator.ts`
  - `app/api/intent-e2e/project-knowledge/backups/route.ts`
  - `app/api/intent-e2e/project-knowledge/backups/restore/route.ts`
  - `tests/unit/intent-project-knowledge.spec.ts`
  - `tests/unit/intent-repair-memory.spec.ts`
  - 受影响的 route / service unit tests
- 不会改：
  - 数据库 schema
  - onboarding bootstrap contract
  - `asset_missing / no_hit` UI guardrail
  - blocker bucket UI / insights 分桶

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：R7.5
- 对应小步：`projectUid -> knowledge / repair memory` 路径解析与 backward-compatible fallback
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新更新

## 计划修改点
- 抽出 knowledge / repair memory 的 project-aware path resolver
- 给 planning / repair hint / repair writeback 透传 `projectUid`
- 给 draft / merge / backup / restore 透传项目级知识路径
- 补充路径隔离与 legacy fallback 单测

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-project-knowledge.spec.ts tests/unit/intent-repair-memory.spec.ts tests/unit/intent-project-knowledge-draft.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/api-intent-project-knowledge-backups-route.spec.ts tests/unit/api-intent-project-knowledge-backup-restore-route.spec.ts`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 本轮不处理 onboarding 缺失时的显式 guardrail，因此新项目首次运行仍可能先经历一次“无资产”阶段。
- 运行态保留 legacy fallback，短期内仍可能读到旧全局资产；彻底切断需要后续 onboarding / guardrail 一起收口。

## 完成后动作
- 回写 roadmap 当前轮次状态
- 如路径策略稳定，补到稳定文档入口
