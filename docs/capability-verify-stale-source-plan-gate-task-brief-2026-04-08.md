# Task Brief

## 标题
- capability verify 旧成功脚本复用加 compatibility gate

## 背景
- 当前 capability verify 已能命中来源 passed plan，但这次真实失败表明：被复用的成功脚本本身可能早于后续 hardening。
- 例如商机列表状态场景，旧 passed plan 没有“按命中行表头读取状态单元格”这条证据链，被 restore 后仍会沿用旧的详情/列表回退逻辑，导致 verify 明明走了 true reuse 仍然失败。

## 本轮目标
- 只给 capability verify 的 source-plan reuse 增加一层 compatibility gate。
- 对必须依赖当前 hardening 的场景，旧 plan 若缺少关键 helper，则不复用，回退当前生成链路。

## 验收标准
- [ ] 商机列表状态类 capability 在 source plan 缺少 `__e2e.readAntdTableCellByHeader(...)` 时，不再盲目复用旧 passed plan。
- [ ] 同类 capability 的 source plan 已包含该 helper 时，仍可继续复用。
- [ ] 相关 unit / build / 文档校验通过。

## 范围
- 会改：
  - `lib/capability-verification-service.ts`
  - `tests/unit/capability-verification-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - restore route 契约
  - repair 链路
  - 其它 family 的 plan upgrade 机制

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：capability verify stale passed-plan compatibility gate

## 计划修改点
- 对 `business/businesslist` 且断言涉及 `商机进展 / 新入库` 的 capability verify source reuse，加一条最小 compatibility gate。
- 旧 source plan 若缺少 `__e2e.readAntdTableCellByHeader(...)`，说明没带上当前状态列 hardening，不再 restore。

## 验证
- `npx vitest run tests/unit/capability-verification-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮只加 reuse gate，不做历史脚本自动升级。
- source task 旧 plan 被 gate 掉后，这一轮会回退生成，速度会慢于真正的命中复用；后续若要继续优化，只能另起 brief 处理 capability 自身历史 passed verify reuse。
