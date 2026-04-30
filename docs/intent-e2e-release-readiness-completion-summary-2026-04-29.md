# Intent E2E Release Readiness Completion Summary

## 范围
- 本文收口 Phase 15-20 的 release readiness 开发链路。
- 范围限定在 `proj_default` 当前已纳入 release guard 的 priority families：
  - `business_create_list_verify`
  - `business_to_order`
  - `list_search_detail`
  - `business_batch_add_contacts_verify`

## 已完成链路
- CLI 汇总：
  - `npm run intent:release-status`
  - `npm run intent:release-status -- --require-current-compare --json`
  - 聚合 release guard preflight、knowledge-hit guard、最近 release compare。
- 只读 API：
  - `GET /api/intent-e2e/release-status`
  - 按项目 viewer 权限校验，只根据 `projectUid` 读取约定 tracked artifacts，不接受任意文件路径。
- Intent 工作台：
  - `/intent-e2e` 的“历史运行洞察”区展示 release readiness、checks、families 和 issue explainer。
  - 前端只读消费 API 返回值，不重新计算 ready / attention / blocked。
- 项目工作台：
  - `/projects/:projectUid` 顶部展示同一份 release readiness 摘要。
  - 支持刷新和跳转 `/intent-e2e?projectUid=...` 查看详情。
- 浏览器 smoke：
  - `tests/e2e/scenario-task-smoke.spec.ts` 覆盖项目 dashboard release status 摘要卡片 ready-path 渲染。

## 当前证据状态
- `npm run intent:release-guard:preflight -- --json`
  - `passed=true`
  - `baselineCount=4`
  - `checkedFileCount=10`
  - `errorCount=0`
  - `warningCount=0`
- `npm run intent:knowledge-hit-guard -- --json`
  - `passed=true`
  - `evidenceCount=4`
  - `passedEvidences=4`
  - `failedEvidences=0`
  - `missingRuleCount=0`
- `npm run intent:release-status -- --require-current-compare --json`
  - `status=ready`
  - `canRelease=true`
  - `passedChecks=3/3`
  - `readyFamilies=4/4`
  - `blockedFamilies=0`

## 验收结论
- Phase 15-20 release readiness 计划已完成。
- 当前默认项目 release readiness 为 `ready`。
- 当前“AI生成”可发布守护范围限定为上述 4 条已治理 family；未命中守护 family 的开放式自然语言 / 图片请求仍按真实流量实验口径统计，不作为 100% 成功承诺。
- 发布前仍应以完整 `intent:release-guard` 和 `intent:release-status -- --require-current-compare` 为准；工作台入口只读展示已有证据，不执行 live compare。

## 后续可选方向
- 扩展 smoke 到 `/intent-e2e` issue explainer 的 blocked / error 分支。
- 为新项目补一键初始化 release guard / knowledge-hit evidence 的配置向导。
- 把 release readiness 摘要接入 CI artifact 或 PR comment。
