# Intent E2E Quality Gate Server Contract Task Brief（2026-05-07）

## 背景

`asset_missing / no_hit / blocked split` 已经在 workbench 和 insights 中显式展示，但 `no_hit` 仍会继续消耗自动 repair 配额。下一步需要把这些信号收口成服务端可复用的强门禁契约，避免继续盲跑或盲修。

## 目标

- 新增统一 quality gate contract，明确 asset readiness 与 quality split 对应的 bootstrap / fixture / draft-only 方向。
- 让 `no_hit` 和阻塞类 split 在 repair budget 中直接停止继续消耗自动修复。

## 范围

- 新增 `intent-e2e-quality-gate` 纯逻辑模块。
- 将 repair budget 接入 quality gate。
- 更新相关 unit tests、README 和 roadmap。
- 不改 launch-decision API response 结构，不改 insights 统计口径，不改 release-readiness / traffic-quality 报表语义。

## 验收

- `asset_missing` 映射为 `needs_bootstrap` / `asset_missing` repair reason。
- `no_hit` 映射为 `draft_only` / `knowledge_no_hit` repair reason，并停止盲修。
- auth / permission / env / data blocker 映射为对应 bootstrap / fixture 方向。

## 验证命令

- `npx vitest run tests/unit/intent-e2e-quality-gate.spec.ts tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:unit`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`
