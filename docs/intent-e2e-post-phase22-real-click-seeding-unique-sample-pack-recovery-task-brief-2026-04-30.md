# Task Brief

## 标题
- Post Phase 22：real-click seeding unique sample pack recovery

## 背景
- 上一轮已经修复了 current-system scope guard，并清除了跨系统 `docs.qq.com` 误播种。
- 但内置 seeding sample catalog 仍保留了同一流程的多种改写版，例如 `01 / 02 / 03`、`Round 1 / 2`。
- 即使 exact semantic dedupe 已经生效，这种 catalog 设计本身仍会制造“标题不同、内容近似”的 `[AI测试样本]` 草稿噪音，不符合当前项目只保留高价值 real-click 样本的目标。

## 本轮目标
- 把内置 real-click seeding catalog 收敛为当前系统内的唯一任务集。
- 默认 profile 不再使用同一流程的 01/02/03 改写来凑样本数。
- 对现存 exact duplicate active drafts 做一次安全归档，只保留每组最新一条。
- 跑一次无副作用 seeding 复验，证明新的 catalog 在现有 active drafts 上只会 `skipped_duplicate`。

## 验收标准
- [ ] 默认 built-in sample pack 只包含当前系统唯一任务
- [ ] `mixed` profile 内不再存在同语义/近同语义的编号变体
- [ ] 现存 exact duplicate active drafts 已归档，active 列表不再存在 exact duplicate group
- [ ] seeding 脚本复跑时不会新增重复草稿，而是返回 `skipped_duplicate`
- [ ] 相关单测、文档检查、roadmap 检查通过

## 范围
- 会改：
  - `scripts/intent-e2e-seed-real-click-samples.mjs`
  - `tests/unit/intent-e2e-seed-real-click-samples.spec.ts`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 只做运行态清理，不改：
  - `traffic-quality` 统计语义
  - benchmark / release-guard / verifier 主链路
  - 当前系统以外的任何 document/document-like 样本

## 新 catalog 原则
- 只保留当前系统 `uat-service.yikaiye.com` 范围内的任务
- 只保留真正不同的业务语义，不保留改写版编号样本
- 当前默认 catalog：
  - 手册批量加入通讯录验收
  - 商机转订单主链路
  - 新建商机后列表验收
  - 订单列表详情校验

## 验证
- `node --env-file-if-exists=.env scripts/intent-e2e-seed-real-click-samples.mjs --help`
- `npx vitest run tests/unit/intent-e2e-seed-real-click-samples.spec.ts`
- `node --env-file-if-exists=.env scripts/intent-e2e-seed-real-click-samples.mjs --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --actor-user-uid usr_default_owner --base-url http://127.0.0.1:3666 --profile mixed`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check`

## 风险 / 未覆盖
- 这轮只收紧 sample catalog 和清理历史重复草稿，不扩充新的 scenario family。
- `list_search_detail` 仍可能因为真实页面数据不足而波动，因此它在 sample pack 中依旧只作为观察样本，不代表稳定主力。
