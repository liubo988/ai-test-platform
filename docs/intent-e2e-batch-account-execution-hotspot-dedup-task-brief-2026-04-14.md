# Task Brief

## 标题
- 订单批量入账执行期热点去重：modal 字段解析缓存 + 入账列表命中行复用

## 背景
- `analyzing` 阶段的缓存优化已经落地，最新真实证据显示真正慢点重新回到执行期本身。
- 批量入账 flow 的 Step 4/5/6 会重复运行同一段 modal 字段兜底逻辑，尤其 `readDetailField(... required: false)` 在 `服务项 / 服务项目 / 入账金额` 缺失时会反复吃满等待。
- Step 7 已经通过 placeholder 为“请输入关键词”的筛选框完成一次订单号搜索和行命中，但 Step 8 / final verification 仍会再次扫表找同一行，造成重复等待。
- 现有 sanitizer 还存在 `searchResp` / `searchRespPromise` 混名的脆弱点，说明执行期代码收口还不够严。

## 本轮目标
- 把 Step 4/5/6 的 modal 字段解析改成首次解析后写入 artifacts，后续步骤优先复用。
- 把 Step 8 / final verification 改成优先复用 Step 7 已命中的目标行，只在缺失时再 fallback 查表。
- 修掉搜索等待变量的混名问题，避免 sanitizer 局部改名后留下无效引用。

## 验收标准
- [ ] Step 4/5/6 生成代码里存在 modal 字段 snapshot 复用逻辑，后续步骤不会无条件重跑整段兜底解析。
- [ ] Step 7 仍保留“placeholder 为 `请输入关键词` 的筛选框搜索订单号”的动作忠实性。
- [ ] Step 8 / final verification 会优先复用 `plan_step_7_row / plan_step_7_record.row / plan_step_8_row`。
- [ ] `searchResp` / `searchRespPromise` 之类变量不会再出现声明名与引用名不一致。

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - 无关 UI / route

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：R7 后的高成功率收口与真实运行优化
- 对应小步：执行期热点去重，收敛批量入账 Step 4/5/6/7 的重复等待
- 本轮完成后准备回写到哪一条更新：2026-04-14 最新 roadmap 更新

## 计划修改点
- 在 `lib/test-generator.ts` 为批量入账 modal 字段兜底块新增 snapshot cache / hydration 逻辑。
- 在 Step 8 / verification 的存在性校验里优先复用前一步已命中的 row artifact。
- 给搜索 / 校验等待变量补一致性收口，并补 unit regression。

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 这轮只处理执行期重复等待，不处理执行器底层 helper 本身的等待策略。
- 本地 `scenario-task-smoke` readiness 仍不稳，完整 `npm run test:e2e` 可能继续受现有环境问题影响。
- 如果后续发现 Step 6 submit 后 URL 收敛仍占主要耗时，需要再单独拆 submit settle 策略。

## 完成后动作
- 回写 roadmap
- 用 unit/build 结果确认执行期 sanitizer 已经收口，再决定是否追加真实 rerun 验证
