# Task Brief

## 标题
- 意图草稿前置登录态 storageState 兜底恢复

## 背景
- 真实草稿 run `intent-run-b7077050-75b7-4ace-84a4-73eb9f3f19b6` 已绕过 launch gate 与 runtime governance gate，但仍在前置检查阶段失败。
- 该 run 的 `attempts=0`，失败点为 `前置检查`，错误是目标页仍要求登录。
- 项目认证配置中账号和登录说明存在，但当前运行环境无法解开数据库内项目密码；本地已有同源 Playwright storageState 能直接打开 `https://uat-service.yikaiye.com/#/order/list`。

## 本轮目标
- 保留普通新意图的前置检查语义。
- 让显式意图草稿在统一登录密码不可用、但存在同源有效 storageState 时，不再 `attempts=0` 结束。
- 将登录壳页识别能力从 worker helper 补齐到服务端 page precheck。

## 验收标准
- [x] `page-analyzer` 能识别 `企业微信登录 / 管帮手登录 / 短信验证码登录` 登录壳页。
- [x] 显式草稿遇到 `auth_failed` precheck 时，会尝试同源 storageState seed。
- [x] storageState seed 通过后继续进入 analyze / generate / execute，执行 worker 使用同一份 storageState。
- [x] 普通新意图不因本轮改动绕过前置检查。

## 范围
- 会改：
  - `lib/page-analyzer.ts`
  - `lib/intent-e2e-precheck-storage-state.ts`
  - `lib/ai/intent-e2e-service.ts`
  - 相关 unit tests
- 不会改：
  - 数据库 schema
  - release-readiness 口径
  - benchmark harness
  - document family / OCR 主链路

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/page-analyzer.spec.ts tests/unit/intent-e2e-precheck-storage-state.spec.ts tests/unit/test-executor.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check`

## 风险 / 未覆盖
- storageState 是运行时资产，过期后仍会按正常登录态失效处理。
- 本轮只解决草稿在 precheck 阶段不进入执行的问题；业务脚本执行后的 locator、权限或数据失败仍需看新 run 的 attempt 日志。

## 完成后动作
- 回写 roadmap。
- 提交代码。
