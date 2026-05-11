# Task Brief: Post Release Readiness CI Summary Artifact

## 背景
- `AI生成` 阶段性发布收尾已完成，release guard / knowledge-hit / release-status 都已有 CLI 与 UI 入口。
- CI 当前只执行 preflight / knowledge-hit / build / tests，缺少一份可下载、可读的 release readiness 摘要 artifact。
- 当前 reports 目录不进入 git，CI 上也没有本地 release compare report，因此 CI 摘要不能假装等价于发布前完整 compare。

## 目标
- 增加一个 CI 友好的 release readiness Markdown / JSON 摘要入口。
- 在 GitHub Actions 静态检查 job 中生成 step summary 和 artifact。
- 明确该摘要用于静态证据可见性，不替代发布前 `intent:release-guard` compare。

## 范围
- 新增 release-status Markdown renderer。
- 新增 `intent:release-summary` 脚本。
- 更新 CI、README、runbook。
- 补最小单测覆盖 Markdown 输出。

## 非目标
- 不新增 PR comment 写权限。
- 不在 CI 里执行数据库依赖的 traffic-quality。
- 不改变 `intent:release-status` 和 release guard 的既有判定语义。

## 验收
- `npm run intent:release-summary -- --skip-current-compare` 能写出 JSON / Markdown。
- CI static job 会上传 `intent-e2e-release-readiness` artifact。
- 受影响单测、build、doc/roadmap/diff 检查通过。
