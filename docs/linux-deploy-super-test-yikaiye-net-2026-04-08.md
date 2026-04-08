# Linux 部署说明（`super-test.yikaiye.net`）

适用前提：

- 系统：`Ubuntu 22.04 / 24.04`
- 域名：`super-test.yikaiye.net`
- 进程管理：`systemd`
- 反向代理：`nginx`
- 应用启动方式：`node server.mjs`
- 默认监听端口：`3666`

当前仓库原本没有现成的 Linux 部署脚本、`nginx` 配置或 `systemd` service。本文档对应本次补充的部署物料：

- `scripts/deploy/install-runtime-ubuntu.sh`
- `scripts/deploy/deploy-web.sh`
- `deploy/systemd/auto-test-platform.service`
- `deploy/nginx/super-test.yikaiye.net.conf`
- `deploy/env/production.env.example`

## 一、服务器准备

先在服务器上安装运行时：

```bash
sudo bash scripts/deploy/install-runtime-ubuntu.sh
```

这个脚本会安装：

- `git`
- `nginx`
- `certbot`
- `python3-certbot-nginx`
- `mysql-client`
- `Node.js 22`
- 常用构建工具与 Chromium 运行依赖

## 二、创建部署用户与目录

```bash
sudo useradd --system --create-home --shell /bin/bash autotest || true
sudo mkdir -p /opt/ai-test-platform/current
sudo mkdir -p /opt/ai-test-platform/shared
sudo mkdir -p /opt/playwright-browsers
sudo chown -R autotest:autotest /opt/ai-test-platform
sudo chown -R autotest:autotest /opt/playwright-browsers
```

## 三、拉代码

如果服务器还没拉过仓库：

```bash
sudo -u autotest git clone https://github.com/liubo988/ai-test-platform.git /opt/ai-test-platform/current
```

如果已经有代码：

```bash
cd /opt/ai-test-platform/current
sudo -u autotest git fetch origin
sudo -u autotest git checkout main
sudo -u autotest git pull --ff-only origin main
```

## 四、配置生产环境变量

复制示例：

```bash
sudo -u autotest cp /opt/ai-test-platform/current/deploy/env/production.env.example /opt/ai-test-platform/shared/.env.production
sudo -u autotest vi /opt/ai-test-platform/shared/.env.production
```

最少要填这些：

- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_PORT`
- `APP_CRYPTO_KEY`

如果你要启用 AI 生成链路，再填：

- `LLM_API_KEY` 或 `OPENAI_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL`

如果你要让服务器直接执行真实浏览器业务流，建议填：

- `E2E_USERNAME`
- `E2E_PASSWORD`
- `E2E_LOGIN_URL`
- `E2E_LOGIN_DESCRIPTION`

建议生产上额外设置：

- `INTENT_E2E_PROJECT_ASSET_ROOT=/opt/ai-test-platform/shared/reports/intent-e2e/projects`
- `INTENT_E2E_RUN_ARTIFACT_ROOT=/opt/ai-test-platform/shared/reports/intent-e2e/runs`
- `PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers`

`APP_CRYPTO_KEY` 可以直接这样生成：

```bash
openssl rand -hex 32
```

## 五、安装依赖并构建

切到仓库目录：

```bash
cd /opt/ai-test-platform/current
```

首次部署或更新后执行：

```bash
sudo -u autotest ENV_FILE=/opt/ai-test-platform/shared/.env.production bash scripts/deploy/deploy-web.sh
```

这个脚本会做：

- `npm ci`
- `npm run build`
- `npm run build:web`
- 安装 Chromium 浏览器到 `PLAYWRIGHT_BROWSERS_PATH`
- `npm run db:init`

## 六、配置 systemd

复制 service 文件：

```bash
sudo cp /opt/ai-test-platform/current/deploy/systemd/auto-test-platform.service /etc/systemd/system/auto-test-platform.service
sudo systemctl daemon-reload
sudo systemctl enable auto-test-platform
sudo systemctl restart auto-test-platform
```

查看服务状态：

```bash
sudo systemctl status auto-test-platform --no-pager
sudo journalctl -u auto-test-platform -n 200 --no-pager
```

本机自检：

```bash
curl -I http://127.0.0.1:3666
```

## 七、配置 nginx

复制站点配置：

```bash
sudo cp /opt/ai-test-platform/current/deploy/nginx/super-test.yikaiye.net.conf /etc/nginx/sites-available/super-test.yikaiye.net.conf
sudo ln -sf /etc/nginx/sites-available/super-test.yikaiye.net.conf /etc/nginx/sites-enabled/super-test.yikaiye.net.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

这个配置已经处理了：

- Next 页面反代
- `SSE`
- `/ws/screencast` WebSocket
- 大请求体

## 八、签发 HTTPS 证书

先保证域名已经解析到这台服务器，再执行：

```bash
sudo certbot --nginx -d super-test.yikaiye.net
```

如果要自动把 HTTP 跳转到 HTTPS，可以在 certbot 提示时选择 redirect。

证书续期自检：

```bash
sudo certbot renew --dry-run
```

## 九、上线后检查

建议依次确认：

```bash
curl -I http://127.0.0.1:3666
curl -I http://super-test.yikaiye.net
curl -I https://super-test.yikaiye.net
```

浏览器访问时至少确认：

- 首页能打开
- `/intent-e2e` 能打开
- 项目工作台能打开
- 发起一个最小任务时不报数据库连接错误

## 十、后续更新

每次发版：

```bash
cd /opt/ai-test-platform/current
sudo -u autotest git fetch origin
sudo -u autotest git checkout main
sudo -u autotest git pull --ff-only origin main
sudo -u autotest ENV_FILE=/opt/ai-test-platform/shared/.env.production bash scripts/deploy/deploy-web.sh
sudo systemctl restart auto-test-platform
sudo systemctl reload nginx
```

## 十一、常见问题

### 1. 服务能起来，但浏览器执行时报 Chromium 缺失

重新执行：

```bash
cd /opt/ai-test-platform/current
sudo -u autotest ENV_FILE=/opt/ai-test-platform/shared/.env.production bash scripts/deploy/deploy-web.sh
```

并确认：

```bash
sudo -u autotest env | grep PLAYWRIGHT_BROWSERS_PATH
ls -la /opt/playwright-browsers
```

### 2. 页面打开正常，但 AI 生成失败

先检查这些环境变量是否已配置：

- `LLM_API_KEY` / `OPENAI_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL`

### 3. 页面打开正常，但真实业务流登录失败

先检查这些环境变量：

- `E2E_USERNAME`
- `E2E_PASSWORD`
- `E2E_LOGIN_URL`

如果项目侧已经在 UI 里配置了项目认证，也要确认数据库里的项目认证没有损坏。
