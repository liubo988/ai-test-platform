# Intent E2E Document Real Click Seed And Admissibility Guard Task Brief

## 背景

- 当前 `proj_default` 的正式任务没有外部文档页面目标，但项目工作台本身存在真实知识文档 UI。
- 需要执行一次真正操作文档对象的 document-like `real_click` 采集，同时继续防止把“参考知识文档执行业务流”误算成 document family 治理证据。

## 目标

- 新增独立 document real-click seed 入口，通过 `launch-decision -> /api/intent-e2e/runs` 发起，不携带 `intentDraftUid`。
- 默认第一样本固定为当前平台 `/projects/:projectUid?intentView=knowledge` 的真实知识文档 UI：导入知识文档、预览并校验文档块正文锚点。
- 收紧 traffic-quality document classifier：只有真实文档页面或对文档对象的操作才进入 document family selection。
- 产出 seed JSON / Markdown 报表，明确样本 provenance 与 admissibility。

## 范围

- 新增 `intent:document-real-click:seed` 脚本和最小纯逻辑 helper。
- 新增项目知识文档导入/预览确定性模板，供 seed 预填脚本与生成器复用。
- 补充 launch-decision 对稳定 document 场景的 auto-run 识别，避免真实文档导入样本因 `untracked` priority family 被误导入草稿。
- 更新 traffic-quality classifier 与单测。
- 不做 document recipe / verifier / OCR 主链路改造。
- 不改变 release-readiness 既有口径。

## 验收

- `npm run intent:document-real-click:seed -- --project-uid proj_default --max-samples 1` 能执行并落报表，且默认真实知识文档 UI 样本为 `document_family_admissible / doc_create_reopen_verify`。
- `intent:document-sample:scout` 不把 reference-only business flow 误算为 document-like。
- 受影响单测、构建、文档链接和 roadmap 检查通过。

## 验证命令

- `npx vitest run tests/unit/intent-e2e-document-real-click-seed.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/test-generator.spec.ts`
- `npm run intent:document-real-click:seed -- --project-uid proj_default --max-samples 1 --poll-interval-ms 3000`
- `npm run intent:document-sample:scout -- --project-uid proj_default --windows 30,90,365`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30 --json`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
