# Task Brief

## 标题
- launch-decision 兼容 legacy 项目冷启动资产

## 背景
- `launch-decision route` 上线后，项目上下文里的启动门禁会先检查 onboarding / 项目知识。
- 现有 `proj_default` 这类 legacy 项目虽然已经有历史知识与 repair 资产，但 `asset-readiness` 只看 project write path，不认 legacy knowledge fallback，导致草稿入口被误判成 `needs_bootstrap`。

## 本轮目标
- 只修复 legacy 项目在启动门禁上的兼容性回归。
- 让“已有历史项目资产”的旧项目不再被误拦，同时保持真正冷启动项目仍然返回 `needs_bootstrap`。

## 验收标准
- [ ] 真实冷启动项目在缺少 onboarding / 项目知识时仍返回 `asset_missing`
- [ ] 旧项目在存在 legacy knowledge 且已有项目级历史资产迹象时，不再被误判成 `asset_missing`
- [ ] 相关 unit tests 与 build 通过

## 范围
- 会改：
  - `lib/intent-e2e-asset-readiness.ts`
  - `tests/unit/intent-e2e-asset-readiness.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - `launch-decision` 决策优先级
  - workbench blocked card 文案
  - 数据库 schema / route contract

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening 期间的兼容性回归修复
- 对应小步：补齐 `launch-decision` 对 legacy project assets 的兼容
- 本轮完成后准备回写到哪一条更新：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条

## 计划修改点
- 在 `asset-readiness` 中引入最小 legacy 项目资产兼容判定
- 用独立 unit test 锁住“旧项目放行 / 新项目继续拦截”两侧语义

## 验证
- `npx vitest run tests/unit/intent-e2e-asset-readiness.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮只处理本地文件资产的兼容判定，不引入新的 onboarding 写入口
- 不处理 service 直调和真实 rerun 的其它失败簇

## 完成后动作
- 回写 roadmap
