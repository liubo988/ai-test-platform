# Task Brief

## 标题
- AI 生成 with-image 批量加入通讯录 toast 非阻断与旧脚本复用防线

## 背景
- `with_image` real-click 样本扩到 10 条后，失败集中在同一个旧骨架：点击“批量加入通讯录”后强制等待 `.ant-message-notice / .ant-notification-notice` toast。
- 该流程的真实终态成功标准是“我的通讯录按同一手机号检索命中”，toast 只能作为可选日志。
- 修复模板后，复用旧 active draft / 历史 successful / progressed run code 仍可能把旧硬断言带回生成链路。

## 本轮目标
- 把 `business_batch_add_contacts_verify` 的 toast 非阻断约束落到生成模板、seed 输入和历史脚本复用 guard。
- 防止 draft first-pass、recent successful run、recent progressed run 复用旧的“加入通讯录 toast 必须可见”脚本。
- 用真实 `AI生成 + 图片` with-image 样本验证修复后窗口。

## 验收标准
- [x] 生成模板不再包含 `await expect(feedback).toBeVisible(...)` 这类 toast 硬断言。
- [x] with-image seed 输入显式要求“不要等待 toast 作为必经断言”。
- [x] intent-e2e service 会跳过命中旧 toast 硬断言的 draft / historical reuse code。
- [x] draft first-pass toast 旧骨架跳过逻辑只在当前 ScenarioCard 也属于批量加入通讯录场景时触发，避免误杀其他 family 的草稿复用。
- [x] 新 fresh with-image 样本通过，且 trace 显示 `[BATCH-CONTACTS-FEEDBACK] no visible feedback; continue...` 后继续终态验收。
- [x] 修复后的新 with-image 窗口达到 `10/10` terminal pass。
- [x] `business_batch_add_contacts_verify` 的 release-guard current slice 指向修复后窗口，并通过 cross-family release guard。

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `lib/intent-recipe-registry.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `scripts/intent-e2e-seed-real-click-samples.mjs`
  - 相关单测、runbook、roadmap 和项目 recipe 资产
- 不会改：
  - 数据库 schema
  - OCR 模型调用策略
  - 通用文档类 verifier
  - release benchmark 的冻结历史样本定义

## 验证
- `node --env-file-if-exists=.env scripts/intent-e2e-seed-real-click-samples.mjs --help`
  - 通过。
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/test-generator.spec.ts tests/unit/intent-e2e-seed-real-click-samples.spec.ts tests/unit/intent-recipe-registry.spec.ts`
  - 通过，`4` files / `281` tests。
  - 覆盖正向跳过旧 toast 硬断言，以及无关 ScenarioCard 不误跳过 toast-shaped draft code。
- `node --env-file-if-exists=.env scripts/intent-e2e-seed-real-click-samples.mjs --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --actor-user-uid usr_default_owner --base-url http://127.0.0.1:3667 --profile with_image --max-samples 1`
  - 通过，fresh draft：`idraft_1777531337010_1ad9422f`，run：`intent-run-2a6b469a-9d1a-4398-9485-f33970a91612`，`passed=1/1`。
- `node --env-file-if-exists=.env scripts/intent-e2e-seed-real-click-samples.mjs --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --actor-user-uid usr_default_owner --base-url http://127.0.0.1:3667 --profile with_image --repeat 9 --max-samples 9 --reuse-existing-drafts`
  - 通过，复用新 draft，`terminalRuns=9`、`passedRuns=9`。
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30 --json`
  - 通过，刷新报表；30 天全量 `real_click.with_image=19/25`，其中包含修复前失败样本。
- `npm run intent:release-guard:preflight`
  - 通过，`baselines=4`、`files=10`、`errors=0`、`warnings=0`。
- `npm run intent:release-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json`
  - 通过，report：`reports/intent-e2e/projects/proj_default/intent-e2e.release-guard-reports/2026-04-30T06-58-04-696Z-phase11-cross-family-release-guard.json`。
  - `business_batch_add_contacts_verify` current slice：`artifacts/intent-e2e-family-evidence/proj_default.release-guard/current-slices/2026-04-30T06-55-55-522Z-slice_d5c7de05f7e1.json`。
  - 新 family compare：`terminal=87.5->100`、`firstPass=87.5->100`、`blocked=6.3->0`。
- `npm run intent:release-status -- --require-current-compare --json`
  - 通过，`status=ready`、`canRelease=true`、`readyFamilies=4/4`。

## 风险 / 未覆盖
- 修复后窗口 `10/10` 是这条已治理 family 的当前小窗口，不代表任意自然语言 + 图片请求都能 100%。
- 30 天全量 with-image 成功率仍包含旧失败，因此当前全量口径是 `76.0%`。
- release-guard 现在使用修复后 current slice 评估新 family；历史 pre-fix 失败仍保留在 30 天真实流量口径里，不做数据清洗式删除。
- 文档类 family 仍没有真实流量候选；后续仍要按“先分母和 top family，再 recipe / fixture / verifier / guard”的顺序推进。
