# Task Brief

## 标题
- S6+ 更强 repair 运行时证据：列表 JSON / 详情字段结构化证据

## 背景
- `S6+ DOM delta` 已完成，但 repair 仍缺一类更直接的业务证据：上一轮其实已经拿到的列表 JSON / 详情字段结构化信号。
- `test-worker` 现有 helper 已经把 `json record extracted / json value extracted / detail field resolved` 通过 `log.meta` 打出来了，当前只是 service 没有接住。

## 本轮目标
- 只复用现有 `log.meta` 通道，把列表 JSON / 详情字段结构化证据接进 repair observation report 和 repair prompt。
- 不改 worker 协议，不新增 artifact 类型，不扩成新的执行链。

## 验收标准
- [ ] repair observation report 能产出 `list_json_evidence`
- [ ] repair observation report 能产出 `detail_field_evidence`
- [ ] repair prompt 能显式消费这两类证据，相关 unit tests 通过

## 范围
- 会改：
  - `docs/intent-e2e-s6plus-structured-data-evidence-task-brief-2026-04-02.md`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/test-generator.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/test-generator.spec.ts`
- 不会改：
  - `lib/test-worker.mjs`
  - 新 artifact / runner 协议
  - 会话复用 / auth session 语义

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening `S6+` 候选
- 对应小步：更强 repair 运行时证据
- 本轮完成后准备回写到哪一条更新：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条进度更新

## 计划修改点
- 在 `intent-e2e-service` 中保留 helper log 的 `meta`
- 把列表 JSON / 详情字段证据归纳成 repair observation probes
- 在 `test-generator` 的 repair prompt 中增加这两类 probe 的使用边界

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/test-generator.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮只复用上一轮 helper log 的元数据，不补失败瞬间 DOM dump
- 本轮不补新的列表响应 artifact 文件；证据只进入 repair prompt 和 run result

## 完成后动作
- 回写 `docs/intent-e2e-success-hardening-plan-2026-04-01.md`
- 回写 `docs/intent-e2e-production-roadmap-2026-03-29.md`
