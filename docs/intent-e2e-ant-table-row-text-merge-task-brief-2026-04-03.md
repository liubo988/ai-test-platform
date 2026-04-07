# Task Brief

## 标题
- intent-e2e：Antd 列表固定列 row clone 文本合并

## 背景
- 真实商机列表场景里，`findAntdTableRow()` 已经命中了正确记录，但后续 `row.innerText()` 仍可能只读到固定列分片。
- 当“商机进展”列落在其它 clone 上时，脚本会误判“列表行未直出状态”，继续退化去点“查看”，造成误报失败。

## 本轮目标
- 只修运行时 row 文本读取，不改 compiler / prompt。
- 让 `__e2e.findAntdTableRow()` 返回的 row 在读取 `innerText()` 时，自动合并同 `data-row-key` / `id` 的可见 clone 文本。

## 验收标准
- [ ] 同一条 Antd 记录被拆成 fixed-left / body / fixed-right clone 时，`row.innerText()` 可拿到合并后的文本。
- [ ] 现有 `expect(row).toHaveAttribute(...)`、`clickAntdRowAction(...)` 等行为不被破坏。
- [ ] `tests/unit/test-executor.spec.ts` 覆盖 fixed-column 文本合并场景。

## 范围
- 会改：
  - `lib/test-worker.mjs`
  - `tests/unit/test-executor.spec.ts`
- 不会改：
  - compiler / verifier / prompt 生成逻辑
  - API / DB schema

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## 验证
- `npx vitest run tests/unit/test-executor.spec.ts`
- `npm run build`

## 风险 / 未覆盖
- 本轮只收口 `innerText()`，不额外扩到 `textContent()` / 自定义列值提取器。
