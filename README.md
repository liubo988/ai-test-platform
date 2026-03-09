# 自动化测试中台（Node + Vitest + Playwright）

## 能力
- Unit / Integration / E2E 分层测试
- 市场边缘用例结构化沉淀（`edge-cases/cases.json`）
- 自动生成回归测试（`npm run edge:generate`）
- CI 自动执行全链路测试
- 支持 LLM 生成测试（有 API Key 时启用，无 Key 自动 fallback 模板）

## 快速开始
```bash
npm install
npm run edge:generate
npm run test:all
```

## 常用命令
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run test:smoke`
- `npm run test:all`
- `npm run edge:generate`
- `npm run edge:report`

## LLM 生成（可选）
默认推荐模型：`api-proxy-codex/gpt-5.3-codex`

1. 复制 `.env.example` 为 `.env` 并填入 key
2. 导出环境变量后执行：
```bash
npm run edge:generate
```
3. 结果会输出到：
- `tests/integration/generated/*.spec.ts`
- `reports/generation-summary.json`

## GitHub 自动化
- `ci.yml`：PR/main 自动跑 unit + integration + e2e
- `edge-case-intake.yml`：Issue 标签 `edge-case` 自动入库到 `edge-cases/cases.json`
- `ai-generate-tests.yml`：`edge-cases/**` 变更后自动生成测试并发 PR

## 下一步建议
1. 为每个业务模块增加明确 importPath/functionName（提升 LLM 生成准确率）
2. 增加 flaky rerun + 失败聚类
3. 接入真实预发环境 E2E（通过 `E2E_BASE_URL`）
4. 增加 contract 测试（核心交易链路）
