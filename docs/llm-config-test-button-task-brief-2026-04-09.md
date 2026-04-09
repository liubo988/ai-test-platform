# Task Brief

## 标题
- 团队共享 LLM 配置增加测试按钮

## 背景
- 当前 `团队共享 LLM 配置` 弹窗只能加载和保存配置，无法在保存前快速验证当前草稿是否能成功请求 LLM。
- 近期排查 401/网关配置问题时，需要一个就地测试入口，避免每次都去触发完整意图链路。

## 本轮目标
- 为共享 LLM 配置弹窗增加“测试配置”按钮。
- 新增轻量 API，用当前草稿发起最小 LLM 请求并返回结果摘要。

## 验收标准
- [ ] 弹窗中可直接测试当前草稿配置
- [ ] 测试不会写入数据库或修改共享配置
- [ ] 测试成功/失败都会给出明确反馈

## 范围
- 会改：
  - `components/LLMConfigDialog.tsx`
  - `app/api/llm/config/**`
  - `lib/llm-config-browser.ts`
  - `tests/unit/**`
- 不会改：
  - 数据库 schema
  - 业务主流程
  - 共享配置持久化语义

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`

## 计划修改点
- 抽共享 LLM 配置请求体验证 helper
- 新增 `POST /api/llm/config/test`
- UI 增加测试按钮与结果展示

## 验证
- `npm run build`
- `npx vitest run tests/unit/api-llm-config-route.spec.ts tests/unit/api-llm-config-test-route.spec.ts`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 测试请求仍依赖服务端环境里的真实 API key
- 上游网关限流或认证问题会直接暴露给 UI

## 完成后动作
- 保持 README / 稳定入口文档链接有效
