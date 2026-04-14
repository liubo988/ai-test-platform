# Task Brief

## 标题
- batch-account selectedServiceItem guard 幂等化与 TDZ 自引用收口

## 背景
- 新 run `intent-run-e4be86fb-b4e4-45c9-aba9-bd0647b533b5` 已不再死在执行器语法层，也不再停在 `selectedServiceItem 为空`。
- 这条 run 的 3 次尝试全部失败于同一个新签名：`Cannot access 'selectedServiceItemCandidateText' before initialization`。
- trace 里的最终执行代码显示，`sanitizeGeneratedCode()` 在 batch-account 路径上把已经 canonical 的 `selectedServiceItem` guard 又包了一层，产出：
  - `const selectedServiceItemCandidateText = String(selectedServiceItemCandidateText && ... )`
- 这属于 sanitizer 自己制造的 TDZ，自身就能在本地 deterministic 复刻，不是页面数据波动。

## 本轮目标
- 让 batch-account 的 `selectedServiceItem` canonical guard 对同一段代码重复清洗时保持幂等，不再自嵌套。
- 兼容清理已经被旧版本 sanitizer 改坏的 self-reference block。

## 验收标准
- [ ] `sanitizeGeneratedCode()` 不再生成 `String(selectedServiceItemCandidateText && ...)` 这种自引用初始化
- [ ] 对已经包含 canonical guard 的 batch-account 代码再次 sanitize，输出仍保持单层 guard
- [ ] 新增回归测试能直接复刻 `intent-run-e4be86fb-b4e4-45c9-aba9-bd0647b533b5` 的失败模式并通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
- 不会改：
  - DB schema
  - route / UI
  - structured repair timeout 策略

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 后续 batch-account hardening 补漏
- 对应小步：service-item sanitizer 幂等化，避免 canonical guard 自嵌套
- 本轮完成后回写：roadmap 最新一条更新

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 这轮不处理 structured repair 的 `60000ms` timeout，只修 deterministic sanitizer 自身的 TDZ。
- 若后续还有其它字段 guard 出现同类自嵌套，需要按同样方式补幂等化回归。

## 完成后动作
- 回写 roadmap
- 用新的真实 run 观察 blocker 是否继续后移
