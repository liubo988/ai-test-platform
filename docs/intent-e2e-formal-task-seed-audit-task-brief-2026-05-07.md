# Task Brief

## 标题
- Formal task seed audit for next development planning

## 背景
- 用户确认项目工作台“正式任务”里的测试任务是已经跑通的真实测试案例，可作为后续样本采集参考。
- 当前 traffic-quality gate 仍为 `no_admissible_code_work`，不能把正式任务执行历史直接混入 `source=real_click` 分母。
- 需要一个独立报表，把正式任务中的可参考 passed case 与 traffic-quality 真实点击分母分开，避免后续继续靠人工记忆挑样本。

## 本轮目标
- 新增 formal-task seed audit 报表入口。
- 明确正式任务只作为 `formal_task_seed_only`，不能直接计入 real-click 成功率。
- 输出当前系统 scope 内、有 passed 执行证据、可作为 seed/reference 的正式任务清单，并标出 document-like 候选数量。

## 验收标准
- [x] 报表能列出 active 正式任务、当前系统 scope、passed 执行证据和推荐 seed。
- [x] 报表显式声明正式任务不能直接进入 traffic-quality `source=real_click` 分母。
- [x] 报表能标出 document-like formal task candidates；当前 `proj_default` 结果为 `0`。
- [x] `商机222` 与商机批量加入通讯录正式任务能被归到对应 priority family。

## 范围
- 会改：
  - `lib/intent-e2e-formal-task-seed-audit.ts`
  - `scripts/intent-e2e-formal-task-seed-audit.ts`
  - `package.json`
  - `lib/intent-e2e-priority-scenario-family.ts`
  - `lib/intent-e2e-traffic-quality.ts`
  - `tests/unit/intent-e2e-formal-task-seed-audit.spec.ts`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-next-development-prep-2026-05-07.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - traffic-quality real-click 分母口径
  - release-readiness 语义
  - document / OCR / verifier 主链路
  - benchmark harness

## 验证结果
- `npx vitest run tests/unit/intent-e2e-formal-task-seed-audit.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts`
  - 通过，`3` files / `17` tests。
- `npm run intent:formal-task-seeds -- --project-uid proj_default`
  - 通过，summary：`formal_tasks=24 seed_eligible=24 document_like=0 source_policy=formal_task_seed_only`。
- `npm run build`
  - 通过。
- `node scripts/check-doc-links.mjs`
  - 通过。
- `node scripts/check-roadmap-progress.mjs`
  - 通过。
- `git diff --check && git diff --cached --check`
  - 通过。

## 当前阶段状态
- 正式任务已纳入后续样本采集的 reference/seed 审计入口。
- 当前正式任务里没有 current-system document-like seed 候选，因此仍不能开启 document family / OCR / verifier 开发。

## 风险 / 未覆盖
- 正式任务 passed 执行只能证明平台任务可跑通；要进入 traffic-quality 分母，仍需通过 `launch-decision -> /api/intent-e2e/runs` 重新产生 `source=real_click` 事件。
- 当前报表只读取 active 正式任务和最近执行历史，不修改任何任务或运行记录。

## 完成后动作
- [x] 回写 roadmap。
- [x] 更新 README / runbook / next-development prep。
- [x] 运行 build、文档链接与 roadmap 检查。
