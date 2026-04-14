# Task Brief

## 标题
- `analyzing` 支撑数据加 TTL 内存缓存并在终态持久化后回填，减少重复 rerun 的启动等待

## 背景
- 真实 run `intent-run-f93697c4-1d27-412c-bd3b-332628d58eaf` 已经把 `analyzing` 拆成了可审计子步骤，证据显示真正慢点不在 planning，而在“规则 / Starter / recipe 反馈已加载”这一步。
- 上一轮已经把高层 insight getter 替换成轻量 data builder，并把 experience search 改成复用同一批 run snapshots，但用户连续 rerun 同一项目 / 模块时，仍会重复查询同一批 terminal runs 和 knowledge audits。
- 这类重复读取不会提升“复用最近成功脚本”的实时性，因为成功 / progressed run 的代码候选查询本来就走独立实时查询；它只会拖慢 analyze 启动。
- 短 TTL 首版落地后，真实人工 rerun 的间隔常常超过 30s / 5m；同时如果 cache 里保存的是旧 terminal runs，又没有在新 run 终态落库后回填，就会出现“连续 rerun 仍然 fresh”的体感。

## 本轮目标
- 给 `loadIntentE2EAnalyzeSupportData(...)` 增加短 TTL 的进程内缓存，减少连续 rerun 时重复加载同一批反馈数据。
- 保持 successful / progressed run code reuse 查询不进缓存，继续保证最新成功脚本的复用判断是实时的。
- 在 analyzing timing message 里显式透出这次反馈加载来自 `fresh` 还是 `memory_cache`。
- 默认 TTL 调整到适合人工重跑节奏的 15 分钟，避免用户隔几分钟重跑时仍重复冷加载。
- 新 terminal run 在持久化快照后立即回填 analyze support cache，避免长 TTL 反而把 cache 固定在旧快照上。

## 验收标准
- [ ] 同一 `projectUid + moduleUid` 的连续 run 在 TTL 内不会重复调用 analyze 支撑数据的 terminal run / audit 查询。
- [ ] analyzing 子步骤消息会显式输出 `source=fresh|memory_cache`。
- [ ] success / progressed run 代码候选复用逻辑不改成缓存读取。
- [ ] terminal run 持久化后会把最新快照回填到命中的 analyze cache entry，而不是等 TTL 过期。

## 范围
- 会改：
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - successful / progressed run candidate 的实时查询链路
  - 无关 UI / route

## 必读上下文
- `AGENTS.md`
- `docs/testing.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：R7 后的高成功率收口与真实运行优化
- 对应小步：`analyzing` 反馈加载去重，优先优化重复 rerun 的首轮等待
- 本轮完成后准备回写到哪一条更新：2026-04-14 最新 roadmap 更新

## 计划修改点
- 将 `loadIntentE2EAnalyzeSupportData(...)` 拆成 `fetch + cache` 两层。
- 用短 TTL 进程内缓存复用 project/module 级 analyze support data。
- 新增 unit regression，验证第二次 run 直接命中 `memory_cache`，并且不会重复打 repository。
- cache entry 保留 scope 元数据与 auditEntries，支持终态快照回填后原地重算 rule / starter / recipe map。
- 在 run registry 的 terminal snapshot 持久化路径接入 cache backfill，而不是清空 cache。

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-experience-search.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 这轮缓存只优化重复 rerun；第一次 cold load 的查询成本仍然存在。
- analyze support data 在 TTL 窗口内可能略旧，但最新 successful / progressed run code reuse 仍保持实时，不会阻断“复用刚跑通的脚本”。
- live 进程如果没有 reload，新代码不会体现在 `localhost:3666` 的真实 run 上；需要用重启后的进程验证 `source=memory_cache`。
- 未对 smoke/e2e 环境慢启动做处理；`scenario-task-smoke` 的本地 server ready 失败仍需单独排查。

## 完成后动作
- 回写 roadmap
- 下一条真实 run 到来时，直接对比 `source=fresh|memory_cache` 与 analyzing 耗时
