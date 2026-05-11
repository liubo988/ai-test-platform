# Task Brief

## 标题
- Real-click sample collection and stability closure

## 背景
- 后续开发准入已由 `intent:next-dev:check` 控制，当前门禁要求先采集真实 `real_click` 证据，不能在缺少 document-like 样本时直接进入 document / OCR / verifier 开发。
- 本轮合法样本只能来自当前系统 `uat-service.yikaiye.com`；跨系统 `docs.qq.com` 历史样本不能进入当前系统真实流量分母。
- 采样过程中暴露两类真实流量稳定性问题：
  - `business_create_list_verify` 复用成功脚本时，页面已自动返回商机列表却仍因找不到末页提交按钮误失败。
  - `business_batch_add_contacts_verify` 在商机列表残留筛选为空时，确定性模板未先清空筛选，导致无法选中带手机号商机行。

## 本轮目标
- 完成当前系统合法 real-click 样本采集。
- 修复采样暴露的最小稳定性问题，保证现有 ready family 的真实点击样本可一次性通过。
- 刷新 traffic-quality / next-development plan，并按门禁结果决定是否允许继续开发。

## 验收标准
- [x] 当前系统 `mixed` 样本采集通过，且不引入跨系统样本。
- [x] 当前系统 `with_image` 样本采集通过，附件维度不与 benchmark / replay 混统。
- [x] `business_create_list_verify` 复用 submit 槽位能接受“已自动返回商机列表”的收敛状态。
- [x] `business_batch_add_contacts_verify` 模板会先清空列表残留筛选，再采集可勾选商机行。
- [x] next-development plan 明确输出当前仍无 admissible code work，不扩到 document / OCR。

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - 本 task brief
- 会生成 / 刷新：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.real-click-seed-report.*`
  - `reports/intent-e2e/projects/proj_default/intent-e2e.traffic-quality-report.latest.*`
  - `reports/intent-e2e/projects/proj_default/intent-e2e.next-development-plan.latest.*`
- 不会改：
  - document family recipe / verifier / fixture 主链路
  - OCR route / verifier
  - benchmark harness
  - release-readiness 既有报表语义
  - 数据库 schema

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-next-development-prep-2026-05-07.md`

## Roadmap 对齐
- 当前阶段：Traffic Quality 后续开发准入。
- 对应小步：合法 real-click 样本采集与 ready family 采样稳定性收口。
- 本轮完成后回写：第五百三十六次 roadmap 更新。

## 验证结果
- `npx vitest run tests/unit/test-generator.spec.ts`
  - 通过，`1` file / `210` tests。
- `npm run build`
  - 通过。
- `npm run build:web`
  - 通过。
- `bash scripts/check-boundaries.sh`
  - 通过。
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30`
  - 通过，summary：`ready=no gate=no_admissible_code_work decision=stop_no_admissible_code_work eligible=-`。
- `npm run intent:next-dev:check -- --project-uid proj_default --window-days 30`
  - 预期失败，退出码 `1`；原因是最近窗口没有 document-like `real_click`，且真实流量 top priority families 已经 ready。
- `npm run intent:release-status -- --require-current-compare --json`
  - 通过，`status=ready`、`canRelease=true`、`families=4/4`。
- `node scripts/check-doc-links.mjs`
  - 通过。
- `node scripts/check-roadmap-progress.mjs`
  - 通过。
- `git diff --check && git diff --cached --check`
  - 通过。
- real-click seed：
  - `mixed`：`4/4` 通过，报告 `reports/intent-e2e/projects/proj_default/intent-e2e.real-click-seed-report.2026-05-07T07-58-56-388Z.json`。
  - `with_image`：`1/1` 通过，报告 `reports/intent-e2e/projects/proj_default/intent-e2e.real-click-seed-report.2026-05-07T07-59-46-431Z.json`。

## 当前阶段状态
- 样本采集和采样稳定性修复已完成。
- 最新 traffic-quality：`real_click=60/72 (83.3%)`，`benchmark_rerun=455/627 (72.6%)`，`document_selection=no_document_candidates`。
- 最新 next-development gate：`no_admissible_code_work`。

## 风险 / 未覆盖
- `no_admissible_code_work` 仍是当前窗口事实；本轮采集增加了当前系统真实样本，但没有制造 document-like 流量。
- 后续只有出现 document-like `real_click`，或出现未治理 top priority family，才允许另起代码治理切片。

## 完成后动作
- [x] 回写 roadmap。
- [x] 运行 `node scripts/check-doc-links.mjs`。
- [x] 运行 `node scripts/check-roadmap-progress.mjs`。
