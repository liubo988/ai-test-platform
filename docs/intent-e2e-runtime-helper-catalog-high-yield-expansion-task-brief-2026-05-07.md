# Intent E2E Runtime Helper Catalog High-Yield Expansion Task Brief（2026-05-07）

## 背景

能力验证批次 triage 收口后，README 后续建议指向 runtime helper catalog 扩充。当前执行层和动作库里已经稳定存在多条高收益 helper，但 starter asset catalog 只覆盖其中一部分，导致洞察里推荐的 helper 不能稳定落回 DSL `preferredHelpers` 与高频动作库证据。

## 目标

- 扩充 runtime helper catalog 白名单，让已验证的高收益 helper 能进入 starter asset 闭环。
- 补齐表格行勾选 DSL 语义，使批量行选择类任务能首轮优先复用 `__e2e.clickAntdRowCheckbox(...)`。

## 范围

- 更新 `intent-action-dsl` 的表格行勾选识别、helper、原语和 forbidden pattern。
- 更新 `intent-starter-assets` catalog，新增表格行定位、行勾选、提交收敛、响应 JSON 提取、稳定标识回查和详情字段读取等 helper 映射。
- 补充 unit tests 和 README / roadmap 记录。
- 不改执行器 helper 实现、不改 benchmark harness、不改 release-readiness / traffic-quality 口径。

## 验收

- 表格批量勾选类步骤会生成 `click_row_checkbox` 和 `__e2e.clickAntdRowCheckbox`。
- starter asset catalog 能解析新增 helper 并回写到匹配步骤。
- 新增 helper 对应 capability slug 能进入高频动作库选择链路。

## 验证命令

- `npx vitest run tests/unit/intent-action-dsl.spec.ts tests/unit/intent-starter-assets.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:unit`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`
