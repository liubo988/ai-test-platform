# Runbook

## 本地前置
- Node.js：建议使用当前稳定 LTS。
- npm：随 Node 安装即可。
- MySQL：integration tests 与项目化工作台 API 需要。
- Playwright browsers：跑 E2E 前执行 `npx playwright install --with-deps`。

## 初始化
1. `npm ci`
2. 复制 `.env.example` 为 `.env`
3. 把数据库配置写入 `.env`
4. `npm run db:init`

## 常用命令
- 启动开发服务器：`npm run dev`
- TypeScript 检查：`npm run build`
- Next 构建检查：`npm run build:web`
- 单测：`npm run test:unit`
- 集成测：`npm run test:integration`
- E2E：`npm run test:e2e`
- 全量回归：`npm run test:all`
- 生成边缘用例测试：`npm run edge:generate`
- 批量沉淀历史 playbook 到项目 recipe：`npm run intent:playbook:promote -- --project-uid <projectUid>`
- 列出 benchmark holdout candidates：`npm run intent:benchmark:candidates -- --project-uid <projectUid>`
- 冻结 benchmark：`npm run intent:benchmark:freeze -- --project-uid <projectUid>`
- 对比当前 benchmark：`npm run intent:benchmark:compare -- --project-uid <projectUid>`

## 推荐工作流
### 改 AI / 业务逻辑
1. `npm run build`
2. `npm run test:unit`
3. 如果涉及 DB 或 route，再跑 `npm run db:init && npm run test:integration`

### 冻结 AI 生成 holdout
1. 若要先把历史成功 run 的 `playbookCandidates` 回填成项目 recipe，可执行：
   `npm run intent:playbook:promote -- --project-uid <projectUid> --module-uid <moduleUid> --run-limit 200`
2. `npm run intent:benchmark:candidates -- --project-uid <projectUid> --module-uid <moduleUid> --test-type browser_e2e`
3. 视需要用 `--eval-case-id` 明确挑选 case，或直接按推荐候选冻结：
   `npm run intent:benchmark:freeze -- --project-uid <projectUid> --module-uid <moduleUid> --test-type browser_e2e --max-cases 12 --release-candidate <label>`
4. 改完策略后跑：
   `npm run intent:benchmark:compare -- --project-uid <projectUid> --compared-label <label>`

### 改前端工作台
1. `npm run build`
2. `npm run build:web`
3. 需要时跑 `npm run test:e2e`

### 改生成器或边缘用例
1. `npm run edge:generate`
2. 检查 `tests/integration/generated/**`
3. `npm run test:unit`

## 常见问题
### integration tests 报缺少数据库配置
- 确认根目录 `.env` 存在。
- 确认 `.env` 里至少有 `DB_HOST`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`、`DB_PORT`。
- 跑一次 `npm run db:init`。

### E2E 报找不到浏览器
- 执行 `npx playwright install --with-deps`。

### `build:web` 或 smoke server 构建失败
- 先跑 `npm run build` 看 TypeScript 是否已经报错。
- 再检查 `app/**` 页面、`useSearchParams()`、服务端导入链和 Next 构建日志。

### product-create E2E 直接跳过
- 这是正常行为。该用例需要 `E2E_USERNAME` 与 `E2E_PASSWORD`。

## CI 期望
- CI 会验证生成产物、入口文档链接、分层边界、TypeScript / Next 构建、unit、integration 和 e2e。
- 集成测试 job 会在工作流内自建 MySQL，并写入一份最小 `.env`。
