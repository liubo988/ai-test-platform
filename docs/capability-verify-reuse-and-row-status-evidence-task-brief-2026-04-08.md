# Task Brief

## 标题
- capability verify 复用指纹收口 + 列表状态单元格证据补齐

## 背景
- 当前能力验证存在两类真实问题：
- 已通过的正式任务沉淀为 capability 后，verify 本应优先复用来源 passed plan，但现网 capability meta 里的 `sourceTaskCapabilityFingerprint` 可能仍是草稿期旧值，导致 verify 回退到重新生成，初始化明显变慢。
- 回退生成后，商机列表 family 在“目标行已命中”的情况下，当前脚本仍可能忽略同一行里可见的状态列文本，继续去抓宽泛列表响应补状态，最终把已成功创建的数据误判成失败。

## 本轮目标
- 只收口 capability verify 的 source-plan reuse 命中稳定性。
- 只补“同一命中列表行的状态列文本”这条结构化可见证据，避免继续误报。

## 验收标准
- [ ] 现有 capability 即使 display copy 有轻微编辑，只要执行语义未漂移，verify 仍可命中来源 passed plan。
- [ ] capability 保存时会按最终表单值重算 `sourceTaskCapabilityFingerprint`，不再把旧草稿指纹原样落库。
- [ ] 对商机列表这类 family，若目标行已命中且状态列可读，编译脚本可直接以该列为状态证据，不必强制再抓列表响应或详情页。
- [ ] 相关 unit / integration / build 校验通过。

## 范围
- 会改：
  - `app/api/projects/[projectUid]/capabilities/route.ts`
  - `lib/intent-capability-preset.ts`
  - `lib/capability-verification-service.ts`
  - `lib/intent-execution-compiler.ts`
  - `lib/test-worker.mjs`
  - `tests/unit/api-project-capabilities-route.spec.ts`
  - `tests/unit/capability-verification-service.spec.ts`
  - `tests/unit/intent-capability-preset.spec.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
  - `tests/unit/test-executor.spec.ts`
  - `tests/integration/project-intent-api.spec.ts`
- 不会改：
  - 数据库 schema
  - capability / execution 公共 API 契约
  - 无关 UI
  - 其它 family 的 response matcher 泛化

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：
  - capability verify source plan reuse true-hit fix
  - business list visible status evidence hardening
- 本轮完成后准备回写到哪一条更新：
  - `docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条增量更新

## 计划修改点
- 在 capability save / verify 侧统一收口 source reuse fingerprint 的生成与比对。
- 在 deterministic compiler + runtime helper 里补“按表头读取当前命中行状态单元格”这条证据链。

## 验证
- `npx vitest run tests/unit/intent-capability-preset.spec.ts tests/unit/api-project-capabilities-route.spec.ts tests/unit/capability-verification-service.spec.ts tests/unit/intent-execution-compiler.spec.ts tests/unit/test-executor.spec.ts`
- `npx vitest run tests/integration/project-intent-api.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不处理更泛化的列表响应 matcher 收窄，只先给“已命中行且状态列可见”的场景补稳定收口。
- 已存在的旧 capability 如未再次保存，仍需依赖 verify 侧的兼容比对命中 source reuse。

## 完成后动作
- 回写 roadmap
- 若验证结果仍显示明显慢点，再另起 brief 单收 capability verify latency trace
