# Task Brief

## 标题
- 草稿测试流程 auto-launch 初始化慢链路收口

## 背景
- 从项目里的意图草稿点击“测试流程”进入 `/intent-e2e` 后，真实体感上会出现“进入控制台但没有马上执行”的现象。
- 现网 trace 显示慢点主要集中在 `/api/intent-e2e/launch-decision`，同时工作台初始化期还会并发触发一轮 `/api/intent-e2e/insights`。
- 现有草稿 auto-launch 在真正进入 launch decision 之前缺少明确的“初始化中 / 正在评估启动条件”可见状态，容易被误判成没启动。

## 本轮目标
- 缩短草稿 test flow 进入控制台后的启动前等待。
- 修正草稿 auto-launch 在 payload 未就绪时的过早消费风险。
- 让控制台在 auto-launch 初始化期立即显示可见进度，而不是停留在“等待启动”。

## 验收标准
- [ ] `launch-decision` 在基础判定已可直接返回时，不再额外读取最近 run。
- [ ] 草稿 auto-launch 在 payload 未 ready 时会继续等待，不会提前报错并吞掉这次启动。
- [ ] 进入控制台后，live log 能尽快显示“正在评估启动条件 / 正在创建服务端运行”。

## 范围
- 会改：
  - `app/api/intent-e2e/launch-decision/route.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `lib/intent-e2e-draft-launch.ts`
  - `lib/db/repository.ts`
  - `tests/unit/api-intent-e2e-launch-decision-route.spec.ts`
  - `tests/unit/intent-e2e-draft-launch.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 执行 / repair 主链
  - 无关 UI 布局

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening close-out follow-up
- 对应小步：draft auto-launch / launch decision latency
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- `launch-decision` 先做一次 baseline decision，只有仍需判 repeated failure suppression 时才读取 recent terminal runs。
- 草稿 auto-launch 的 handled key 只在 payload 有效、准备真正 create run 时再消费。
- auto-launch 初始化时尽早写入 live feed，减少“看起来没启动”的空白期。

## 验证
- `npx vitest run tests/unit/api-intent-e2e-launch-decision-route.spec.ts tests/unit/intent-e2e-draft-launch.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮只压缩启动前链路，不承诺把整条真实 run 墙钟时间降到固定阈值。
- `insights` 本身的汇总计算仍可能偏重，本轮只避免它干扰草稿 auto-launch 初始化。

## 完成后动作
- 回写 roadmap
