# Intent E2E Capability Verification Batch Triage View Task Brief（2026-05-07）

## 背景

`AI生成` release readiness 收口后，README 后续建议里仍有一项影响大批量治理效率：能力验证批次只显示逐条执行结果，缺少失败原因聚合，也不能一键只看已终态但还没同步回 capability `meta` 的项目。

## 目标

- 在能力验证批次面板中补充失败原因聚合，减少用户在运行页之间来回切换。
- 增加“一键只看未回写项”，快速定位已终态但目录未同步的能力。

## 范围

- 新增纯 view helper：聚合批次失败类型、过滤未回写终态项。
- 更新 `ProjectIntentWorkbench` 批次面板 UI。
- 更新 README 下一步建议与能力批次说明。
- 不改能力验证 API、执行器、release readiness、traffic-quality 或数据库 schema。

## 验收

- 批次里有失败项时，UI 展示失败原因聚合、数量和示例能力。
- 批次里有未回写终态项时，UI 出现“只看未回写项”按钮，并可切回全部。
- 聚合和过滤规则有 unit tests。

## 验证命令

- `npx vitest run tests/unit/capability-verification-batch-view.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `bash scripts/check-boundaries.sh`
- `git diff --check && git diff --cached --check`
