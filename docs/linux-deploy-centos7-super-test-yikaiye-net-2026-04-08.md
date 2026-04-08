# CentOS 7 部署说明（`super-test.yikaiye.net`）

这份说明只针对：

- 宿主机：`CentOS Linux 7`
- 域名：`super-test.yikaiye.net`
- 反向代理：`nginx`
- 运行方式：`Docker + systemd`

## 先说明边界

当前项目不适合做 CentOS 7 宿主机原生部署，原因很直接：

- 当前仓库依赖 `next@16.1.6`，Next.js 16 的官方最低 Node.js 要求是 `20.9`。
- 当前仓库依赖 `@playwright/test@1.58.2`，Playwright 当前官方支持的 Linux 发行版是 `Debian 12 / 13`、`Ubuntu 22.04 / 24.04`。
- Playwright 官方还明确给了“对不受支持的 Linux 发行版，用 Docker 镜像”的路径。
- `CentOS Linux 7` 已经在 `2024-06-30` EOL。

所以这里给你的不是“CentOS 7 本机直接跑 Node + Chromium”的方案，而是：

- `CentOS 7` 只负责：
  - `docker`
  - `nginx`
  - `systemd`
- 应用实际运行在：
  - `mcr.microsoft.com/playwright:v1.58.2-noble` 基础镜像里

这样最稳，也最贴近官方支持面。

对应仓库里的新增物料：

- `deploy/docker/Dockerfile.playwright`
- `deploy/systemd/auto-test-platform-docker.service`
- `scripts/deploy/build-docker-image.sh`
- `scripts/deploy/install-host-centos7-docker-nginx.sh`
- `deploy/env/production.docker.env.example`
- `deploy/nginx/super-test.yikaiye.net.conf`

## 一、宿主机安装基础环境

在 CentOS 7 上执行：

```bash
sudo bash scripts/deploy/install-host-centos7-docker-nginx.sh
```

这个脚本会尽量安装：

- `git`
- `curl`
- `nginx`
- `docker-ce`
- `docker-ce-cli`
- `containerd.io`

说明：

- CentOS 7 已 EOL，这一步属于 best-effort。
- 脚本会先把系统里的 `CentOS-*.repo` 从 `mirror.centos.org` 改到 `vault.centos.org`，尽量避免 EOL 后默认源失效。
- Docker 当前官方安装文档只列维护中的 `CentOS Stream 9 / 10`，不再把 CentOS 7 列为受支持系统。
- 但 Docker 下载仓库里仍然保留了 `centos/7` 的 RPM 仓库目录，所以当前还能尝试走这个路径。

## 二、准备目录

```bash
sudo useradd --system --create-home --shell /bin/bash autotest || true
sudo mkdir -p /opt/ai-test-platform/current
sudo mkdir -p /opt/ai-test-platform/shared
sudo mkdir -p /opt/ai-test-platform/shared/reports
sudo chown -R autotest:autotest /opt/ai-test-platform
```

## 三、拉取代码

首次：

```bash
sudo -u autotest git clone https://github.com/liubo988/ai-test-platform.git /opt/ai-test-platform/current
```

更新：

```bash
cd /opt/ai-test-platform/current
sudo -u autotest git fetch origin
sudo -u autotest git checkout main
sudo -u autotest git pull --ff-only origin main
```

## 四、配置生产环境变量

复制示例：

```bash
sudo -u autotest cp /opt/ai-test-platform/current/deploy/env/production.docker.env.example /opt/ai-test-platform/shared/.env.production
sudo -u autotest vi /opt/ai-test-platform/shared/.env.production
```

最少必须填：

- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_PORT`
- `APP_CRYPTO_KEY`

如果 MySQL 就跑在这台 CentOS 7 宿主机上：

- `DB_HOST` 不要写 `127.0.0.1`
- 建议写宿主机实际内网 IP，或 Docker bridge 网关（常见是 `172.17.0.1`）

如果要启用 AI 能力，再填：

- `LLM_API_KEY` 或 `OPENAI_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL`

如果要让服务器直接跑真实业务流，再填：

- `E2E_USERNAME`
- `E2E_PASSWORD`
- `E2E_LOGIN_URL`
- `E2E_LOGIN_DESCRIPTION`

生成加密密钥：

```bash
openssl rand -hex 32
```

## 五、构建 Docker 镜像

```bash
cd /opt/ai-test-platform/current
sudo ENV_FILE=/opt/ai-test-platform/shared/.env.production REPORTS_DIR=/opt/ai-test-platform/shared/reports bash scripts/deploy/build-docker-image.sh
```

这个脚本会做：

- 构建 `auto-test-platform:latest`
- 用同一份生产环境变量执行一次 `npm run db:init`

## 六、配置 systemd

```bash
sudo cp /opt/ai-test-platform/current/deploy/systemd/auto-test-platform-docker.service /etc/systemd/system/auto-test-platform.service
sudo systemctl daemon-reload
sudo systemctl enable auto-test-platform
sudo systemctl restart auto-test-platform
```

检查状态：

```bash
sudo systemctl status auto-test-platform --no-pager
sudo journalctl -u auto-test-platform -n 200 --no-pager
```

本机自检：

```bash
curl -I http://127.0.0.1:3666
```

## 七、配置 nginx

复用仓库里这份配置：

```bash
sudo cp /opt/ai-test-platform/current/deploy/nginx/super-test.yikaiye.net.conf /etc/nginx/conf.d/super-test.yikaiye.net.conf
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

这份配置已经处理了：

- 普通 HTTP 反代
- SSE 长连接
- `/ws/screencast` WebSocket
- 大请求体

## 八、HTTPS

CentOS 7 上的 certbot 生态已经比较旧，建议你优先选下面两种之一：

1. 在上层 LB / CDN 做 HTTPS 终止
2. 迁到受支持的 Ubuntu / Rocky / Alma 主机后，再本机 certbot

如果你当前环境里已经有可用 certbot，也可以按常规方式签发：

```bash
sudo certbot --nginx -d super-test.yikaiye.net
```

但这一步不作为这套 CentOS 7 方案的强依赖。

## 九、发版更新

```bash
cd /opt/ai-test-platform/current
sudo -u autotest git fetch origin
sudo -u autotest git checkout main
sudo -u autotest git pull --ff-only origin main
sudo ENV_FILE=/opt/ai-test-platform/shared/.env.production REPORTS_DIR=/opt/ai-test-platform/shared/reports bash scripts/deploy/build-docker-image.sh
sudo systemctl restart auto-test-platform
sudo systemctl reload nginx
```

## 十、最关键的现实建议

如果这是长期生产环境，建议尽快把宿主机换到：

- `Ubuntu 22.04 / 24.04`
- `Debian 12 / 13`
- 或新版本 `Rocky / Alma / RHEL` 系列

因为：

- CentOS 7 已 EOL
- Playwright 当前官方 Linux 支持面也不包含 CentOS 7
- Docker 当前官方 CentOS 安装文档也只列维护中的 CentOS Stream

这份 CentOS 7 方案的意义是“让你现网先跑起来”，不是“长期最优平台”。
