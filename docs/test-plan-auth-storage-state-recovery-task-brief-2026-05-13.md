# Task Brief

## 标题
- 正式任务生成测试计划登录态 storageState 兜底恢复

## 背景
- 正式任务“登录商机订单入账流程一”生成测试计划时报错：
  - `页面分析失败: 登录后再次访问目标页面仍停留在登录页`
- 生成测试计划链路使用 `test-plan-service -> analyzePage(...)` 先分析目标页，再调用 LLM 生成计划。
- 意图草稿链路已有同源 storageState 兜底，但正式任务生成计划链路尚未接入。

## 本轮目标
- 保留非登录类页面分析错误的原始失败语义。
- 当正式任务页面分析失败且判定为登录态失效时，尝试同源 Playwright storageState 后再分析页面。
- 让本地已有登录态能用于正式任务生成计划，不再卡在登录页。

## 验收标准
- [x] 只有登录态类 `页面分析失败` 会触发 storageState retry。
- [x] retry 使用与目标 URL 同源的 storageState。
- [x] retry 成功后继续生成测试计划。
- [x] 单测覆盖正式任务生成计划 auth failure recovery。

## 范围
- 会改：
  - `lib/services/test-plan-service.ts`
  - `tests/unit/test-plan-service.spec.ts`
- 不会改：
  - 数据库 schema
  - release-readiness / benchmark 口径
  - 意图草稿启动 gate

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/intent-e2e-precheck-storage-state.spec.ts tests/unit/page-analyzer.spec.ts`
- `node --env-file-if-exists=.env --experimental-strip-types --import ./scripts/register-ts-alias-loader.mjs -e "<storageState analyzePage smoke>"`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `git diff --check`

## 风险 / 未覆盖
- storageState 是运行态资产，失效后仍需要刷新。
- 本轮只修“无法生成测试计划”的页面分析阶段；计划生成后执行失败需要看执行日志另行定位。
