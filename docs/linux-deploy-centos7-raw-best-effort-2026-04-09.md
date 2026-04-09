# CentOS 7 裸机部署说明（best-effort）

适用前提：

- 宿主机：`CentOS Linux 7`
- 部署方式：`非 Docker`
- 进程管理：`systemd`
- 可接受这条路径是 `unsupported / best-effort`

## 先说明边界

这份方案不是官方支持路径，只是为了在现有 `CentOS 7` 物理机上尽量把系统跑起来。

当前仓库里的浏览器执行链路直接使用 Playwright 自带 Chromium；仓库内没有 system Chrome / remote browser server 的正式切换路径，所以裸机部署脚本必须同时处理：

- Node.js 运行时
- Playwright 依赖库
- Chromium 下载
- 应用 build / db init
- systemd 启动

如果你要的是长期稳定生产环境，优先迁到：

- `Ubuntu 22.04 / 24.04`
- `Debian 12 / 13`
- 或 `Rocky / Alma / RHEL` 新版本

## 对应物料

- `scripts/deploy/bootstrap-centos7-raw.sh`
- `scripts/deploy/deploy-web.sh`
- `deploy/systemd/auto-test-platform-centos7-raw.service.template`
- `deploy/env/production.env.example`

## 一、准备环境变量

优先用这个文件：

```bash
cp deploy/env/production.env.example .env.production
vi .env.production
```

至少补齐：

- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_PORT`
- `APP_CRYPTO_KEY`

如果数据库不在本机，`DB_HOST` 直接写远端 MySQL 地址即可。

## 二、执行一键脚本

在仓库根目录执行：

```bash
sudo ENV_FILE=/opt/ai-test-platform/.env.production bash scripts/deploy/bootstrap-centos7-raw.sh
```

脚本会做这些事情：

- 把 `CentOS 7` 源改到 `vault`
- 安装 `nginx`、浏览器运行库和基础命令
- 安装 `Node.js 22` 的 `glibc-217` 构建
- 创建 `autotest` 运行用户
- 生成并安装 `systemd` service
- 复用 `scripts/deploy/deploy-web.sh` 执行 `npm ci --include=dev`、`build`、`build:web`、`playwright install chromium` 和 `db:init`
- 做一次 Playwright Chromium 启动 smoke test
- 启动 `auto-test-platform`

## 三、常用可选参数

如果仓库目录、端口或域名不是默认值，可以这样传：

```bash
sudo \
  ENV_FILE=/data/ai-test/.env.production \
  APP_PORT=3666 \
  PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers \
  DOMAIN_NAME=super-test.example.com \
  bash scripts/deploy/bootstrap-centos7-raw.sh
```

说明：

- `SETUP_NGINX=1` 是默认值；如果只想先起本地服务，不想装 nginx，可传 `SETUP_NGINX=0`
- `APP_SERVICE_NAME` 默认是 `auto-test-platform`
- `NODE_VERSION` 默认是脚本里固定的 `22.22.2`

## 四、验证

```bash
systemctl status auto-test-platform --no-pager
journalctl -u auto-test-platform -n 200 --no-pager
curl -I http://127.0.0.1:3666
```

如果启用了 nginx，再看：

```bash
nginx -t
curl -I http://127.0.0.1
```

## 五、更新

每次更新代码后：

```bash
git pull --ff-only
sudo ENV_FILE=/opt/ai-test-platform/.env.production bash scripts/deploy/bootstrap-centos7-raw.sh
```

## 六、最常见故障

### 1. `yum: command not found`

这台机器不是 `CentOS 7 + yum` 环境，当前脚本不适用。

### 2. Playwright smoke test 失败并打印 `ldd ... not found`

说明浏览器运行库没装齐。脚本会把当前浏览器二进制的缺失 `.so` 直接打出来，按输出继续补包即可。

### 3. service 能起，但 nginx 反代失败

先检查：

```bash
nginx -t
getenforce
setsebool -P httpd_can_network_connect 1
```

### 4. `db:init` 失败

先确认远端 MySQL 可以从当前宿主机连通，再检查 `.env.production` 里的：

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
