# Task Brief

## 标题
- post-R14 success hardening：Step 7 row-action detail surface propagation

## 背景
- `Step 7 row-action detail surface title/ready relaxation` 的 helper / compiler 已经落地：
  - `waitForVisibleAntdModal(... required: false)`
  - modal miss 后回退 `waitForVisibleDetailSurface(... required: false)`
  - 两者都 miss 时抛：
    - `状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页`
- 但最新真实 rerun `intent-run-743a617b-8e31-48e6-a471-7309cdd7a84d` 的首轮 slot patch 仍继续生成旧链：
  - `const detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000 });`
- 这说明当前阻塞不在 worker / compiler 能力本身，而在生成提示、能力示例和定向修复提示仍残留旧骨架，模型继续抄旧链。

## 本轮目标
- 只收 `Step 7 row-action detail surface` 的生成传播问题。
- 把 prompt / capability example / compiler 指令里的旧示例统一收口为新链：
  - `waitForVisibleAntdModal(... required: false)`
  - modal miss 后 `waitForVisibleDetailSurface(... required: false)`
  - 两者都 miss 时抛显式详情面缺失错误
- 保持最小改动：
  - 不扩新 helper
  - 不改 DB / route / UI 契约
  - 不并行处理 `抖音` 下拉或其它 family

## 验收标准
- [ ] `lib/test-generator.ts` 不再保留 `商机详情 -> waitForVisibleAntdModal(required=true)` 旧骨架示例
- [ ] `lib/intent-action-library.ts` 的主记录回查 capability 示例与说明对齐新链
- [ ] `lib/intent-execution-compiler.ts` 的指令文本不再示例旧链
- [ ] 单测锁住 prompt / capability / compiler 里的新骨架
- [ ] 真实 rerun 至少确认首轮生成链已切到新骨架，不再停在旧的 strict modal wait

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `lib/intent-action-library.ts`
  - `lib/intent-execution-compiler.ts`
  - `tests/unit/test-generator.spec.ts`
  - `tests/unit/intent-action-library.spec.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
- 不会改：
  - `lib/test-worker.mjs`
  - `DB / API 契约`
  - `商机来源=抖音` 相关链路

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts tests/unit/intent-action-library.spec.ts tests/unit/intent-execution-compiler.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- 若代码验证通过，再做同场景 forced rerun，确认首轮生成链已切到新骨架
