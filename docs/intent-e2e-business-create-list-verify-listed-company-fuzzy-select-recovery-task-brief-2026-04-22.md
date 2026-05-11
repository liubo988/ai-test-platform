# Task Brief

## 标题
- intent-e2e：商机222 企业名称改为上市公司关键词模糊匹配

## 背景
- `商机222` 当前已经能 first-pass 成功，但企业名称步骤仍不符合提示词要求。
- 真实成功 run 仍把企业名称固定为 `中铁上海工程局集团有限公司`，而需求是“输入任意上市公司关键词并选择下拉模糊匹配项”。

## 本轮目标
- 让商机创建第二页的企业名称步骤回到“上市公司关键词 + 首个模糊匹配项”路径。
- 同时兼容两类现有来源：
  - fresh generate 的 `label: /.+/`
  - historical reuse / sanitizer 已固化的固定公司全名

## 验收标准
- [ ] `selectAntdOption` 支持仅凭 `searchText` 选择首个可见模糊匹配项
- [ ] `business_create_list_verify` 的 Step 3 sanitizer 不再写死 `中铁上海工程局集团有限公司`
- [ ] 相关 unit/build/doc 校验通过
- [ ] 可对 `商机222` 发起 fresh run 并确认最终执行代码不再固定旧公司名

## 范围
- 会改：
  - `lib/test-worker.mjs`
  - `lib/test-generator.ts`
  - `lib/intent-action-library.ts`
  - `tests/unit/test-executor.spec.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - DB schema
  - benchmark harness
  - 无关业务流程

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：`商机222` 支线问题修复，不改变 `Phase 5 / 第二刀`
- 对应小步：business create-list-verify 企业名称模糊匹配收口
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 给 `__e2e.selectAntdOption(...)` 增加 search-only fuzzy select 能力
- 把商机第二页旧 company select 骨架统一 rewrite 成上市公司关键词模糊匹配
- 补充 worker / generator regression

## 验证
- `npx vitest run tests/unit/test-executor.spec.ts tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- “上市公司关键词”仍依赖线上候选返回；若某个关键词无结果，需要通过关键词回退列表兜底
- fresh run 仍以真实服务端结果为准

## 完成后动作
- 回写 roadmap
- 如 fresh run clean，给出对应 run id 与 trace 证据
