# Task Brief

## 标题
- post-R14 detail field 串读收口：商机详情状态字段避免跨字段误读

## 背景
- 真实 run `intent-run-90ec89ca-99a2-4d32-b65c-722735b1f46c` 首轮里，商机已经创建成功，列表行也已命中。
- 首轮失败不在“目标记录未命中”，而在 `__e2e.readDetailField(page, { label: '商机进展' })` 误读到了 `最后跟进时间: 下次跟进时间:`，导致业务已成功却被判失败。
- 当前缺口在 `lib/test-worker.mjs` 的 detail field helper，属于详情面 label/value 关联过松，不需要重做主链策略。

## 本轮目标
- 只收口一类假阴性：
  - 详情抽屉 / 详情页里目标 label 已命中
  - 但 helper 把后续字段 label 串读成当前字段 value
- 优先保留现有主链，修复 `readDetailField(...)` 的字段边界与值裁剪逻辑。

## 验收标准
- [ ] `readDetailField('商机进展')` 不再把 `最后跟进时间: 下次跟进时间:` 这类后续字段 label 误当成值
- [ ] 真实结构相近的 DOM 下，helper 能优先返回 `新入库`
- [ ] `tests/unit/test-executor.spec.ts` 定向回归通过

## 范围
- 会改：
  - `lib/test-worker.mjs`
  - `tests/unit/test-executor.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - 无关 UI
  - `intent-e2e` planner / generator / compiler 主链策略

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：detail field helper false negative 收口
- 本轮完成后准备回写到哪一条更新：最新一条 roadmap 更新

## 计划修改点
- 在 `readDetailField(...)` 内增加“字段标签串读”识别与裁剪，拒绝纯 label 序列值。
- 补一个贴近真实商机详情 DOM 的 worker 级回归，锁住 `商机进展 -> 新入库` 读取。

## 验证
- `npx vitest run tests/unit/test-executor.spec.ts -t "detail field"`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮只处理 detail field helper 的字段边界，不补新的同一行状态单元格 helper。
- 若真实页面把状态完全渲染在不可读文本层，本轮最多把误读收口成“未读到字段”，不保证所有页面都直接拿到状态。

## 完成后动作
- 回写 roadmap
