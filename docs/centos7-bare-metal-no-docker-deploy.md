# CentOS 7 裸机部署脚本（非 Docker）

适用目标：

- 操作系统：CentOS Linux 7.x 物理机或普通 VM。
- 部署方式：直接部署到宿主机，不使用 Docker。
- 运行方式：Node.js + systemd + nginx 反向代理。
- 应用端口：默认 `127.0.0.1:3666`，由 nginx 对外暴露 80。
- 项目入口：`server.mjs`，生产启动命令等价于 `npm run start:web`。

> CentOS 7 已 EOL，这份脚本会把 yum 源切到 vault，并使用 Node.js 的 glibc-217 构建。长期生产环境仍建议迁移到 Ubuntu 22.04/24.04、Debian 12/13 或新版本 RHEL/Rocky/Alma。

## 目录约定

```bash
/opt/ai-test-platform/app                 # 项目代码目录
/opt/ai-test-platform/shared/.env.production
/opt/ai-test-platform/shared/reports
/opt/playwright-browsers                  # Playwright Chromium 浏览器目录
/etc/systemd/system/auto-test-platform.service
/etc/nginx/conf.d/auto-test-platform.conf
```

## 部署流程

先把当前项目代码放到服务器：

```bash
sudo mkdir -p /opt/ai-test-platform
sudo chown -R "$USER:$USER" /opt/ai-test-platform
git clone <你的仓库地址> /opt/ai-test-platform/app
cd /opt/ai-test-platform/app
```

如果你是手工上传代码，最终保证服务器上存在 `/opt/ai-test-platform/app/package.json` 即可。

## 环境变量文件

创建生产环境变量文件：

```bash
sudo mkdir -p /opt/ai-test-platform/shared
sudo tee /opt/ai-test-platform/shared/.env.production >/dev/null <<'EOF'
NODE_ENV=production
PORT=3666
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers

# LLM runtime
LLM_PROVIDER=openai
LLM_MODEL=api-proxy-codex/gpt-5.3-codex
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_API_STYLE=responses
LLM_VISION_ENABLED=true
LLM_SELF_HEAL_RETRIES=2
LLM_MAX_PLAN_STEPS=8

# OpenAI aliases
OPENAI_API_KEY=
OPENAI_MODEL=api-proxy-codex/gpt-5.3-codex
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_STYLE=responses
OPENAI_RESPONSES_MAX_ATTEMPTS=2
OPENAI_RETRY_DELAY_MS=350
OPENAI_REQUEST_TIMEOUT_MS=180000

# MySQL
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_PORT=3306
DB_POOL_SIZE=10

# 必须改成随机长密钥。可用：openssl rand -hex 32
APP_CRYPTO_KEY=

# Browser E2E default credentials，可留空，在项目内单独配置账号也可以
E2E_LOGIN_URL=
E2E_LOGIN_DESCRIPTION=
E2E_USERNAME=
E2E_PASSWORD=
E2E_COMPANY_KEYWORD=

# Persistent runtime assets
INTENT_E2E_PROJECT_ASSET_ROOT=/opt/ai-test-platform/shared/reports/intent-e2e/projects
INTENT_E2E_RUN_ARTIFACT_ROOT=/opt/ai-test-platform/shared/reports/intent-e2e/runs
EOF

sudo chmod 600 /opt/ai-test-platform/shared/.env.production
sudo vi /opt/ai-test-platform/shared/.env.production
```

至少补齐：

- `LLM_API_KEY` 或 `OPENAI_API_KEY`
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_PORT`
- `APP_CRYPTO_KEY`

生成 `APP_CRYPTO_KEY`：

```bash
openssl rand -hex 32
```

## 一键部署脚本

在服务器项目根目录 `/opt/ai-test-platform/app` 下创建脚本：

```bash
cat > /tmp/deploy-ai-test-centos7.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ai-test-platform/app}"
APP_USER="${APP_USER:-autotest}"
APP_GROUP="${APP_GROUP:-autotest}"
APP_SERVICE_NAME="${APP_SERVICE_NAME:-auto-test-platform}"
APP_PORT="${APP_PORT:-3666}"
DOMAIN_NAME="${DOMAIN_NAME:-_}"
ENV_FILE="${ENV_FILE:-/opt/ai-test-platform/shared/.env.production}"
PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/playwright-browsers}"
REPORTS_ROOT="${REPORTS_ROOT:-/opt/ai-test-platform/shared/reports}"

NODE_VERSION="${NODE_VERSION:-22.22.2}"
NODE_DIST_URL="${NODE_DIST_URL:-https://unofficial-builds.nodejs.org/download/release/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64-glibc-217.tar.xz}"
NODE_INSTALL_ROOT="${NODE_INSTALL_ROOT:-/usr/local/lib/nodejs}"
NODE_BIN="${NODE_BIN:-/usr/local/bin/node}"

log() {
  echo
  echo "[deploy] $*"
}

fail() {
  echo "[deploy] $*" >&2
  exit 1
}

require_root() {
  [[ "${EUID}" -eq 0 ]] || fail "请用 root 或 sudo 执行"
}

require_centos7() {
  command -v yum >/dev/null 2>&1 || fail "未检测到 yum，这不是 CentOS 7 环境"
  [[ -f /etc/centos-release ]] || fail "缺少 /etc/centos-release"
  grep -q 'CentOS Linux release 7' /etc/centos-release || fail "当前脚本只支持 CentOS Linux 7"
}

rewrite_yum_to_vault() {
  log "rewrite CentOS 7 yum repos to vault"
  shopt -s nullglob
  for repo_file in /etc/yum.repos.d/CentOS-*.repo; do
    cp -n "${repo_file}" "${repo_file}.bak"
    sed -i \
      -e 's/^mirrorlist=/#mirrorlist=/g' \
      -e 's|^#baseurl=http://mirror.centos.org|baseurl=http://vault.centos.org|g' \
      -e 's|^#baseurl=https://mirror.centos.org|baseurl=https://vault.centos.org|g' \
      -e 's|^baseurl=http://mirror.centos.org|baseurl=http://vault.centos.org|g' \
      -e 's|^baseurl=https://mirror.centos.org|baseurl=https://vault.centos.org|g' \
      "${repo_file}"
  done
  shopt -u nullglob
  yum clean all
  yum makecache fast
}

install_packages() {
  log "install base packages, nginx, and Playwright runtime libs"
  yum install -y \
    ca-certificates curl findutils git nginx openssl procps-ng rsync shadow-utils tar unzip which xz yum-utils \
    alsa-lib atk at-spi2-atk cairo cups-libs dbus-glib dbus-libs gdk-pixbuf2 glib2 gtk3 \
    libdrm libX11 libX11-xcb libXcomposite libXcursor libXdamage libXext libXfixes libXi \
    libxkbcommon libXrandr libXrender libXScrnSaver libXtst libxcb libxshmfence mesa-libgbm nspr nss pango \
    liberation-fonts xorg-x11-fonts-Type1 xorg-x11-fonts-misc || true

  if command -v fc-cache >/dev/null 2>&1; then
    fc-cache -f >/dev/null 2>&1 || true
  fi
}

install_node() {
  export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"
  if [[ -x "${NODE_BIN}" ]] && [[ "$("${NODE_BIN}" -v 2>/dev/null || true)" == "v${NODE_VERSION}" ]]; then
    log "node ${NODE_VERSION} already installed"
    return
  fi

  log "install node ${NODE_VERSION}"
  tmp_dir="$(mktemp -d)"
  archive_path="${tmp_dir}/node.tar.xz"
  extract_dir="${NODE_INSTALL_ROOT}/node-v${NODE_VERSION}-linux-x64-glibc-217"

  curl -fsSL "${NODE_DIST_URL}" -o "${archive_path}"
  mkdir -p "${NODE_INSTALL_ROOT}"
  rm -rf "${extract_dir}"
  tar -xJf "${archive_path}" -C "${NODE_INSTALL_ROOT}"
  ln -sfn "${extract_dir}" "${NODE_INSTALL_ROOT}/current"

  mkdir -p /usr/local/bin
  ln -sfn "${NODE_INSTALL_ROOT}/current/bin/node" /usr/local/bin/node
  ln -sfn "${NODE_INSTALL_ROOT}/current/bin/npm" /usr/local/bin/npm
  ln -sfn "${NODE_INSTALL_ROOT}/current/bin/npx" /usr/local/bin/npx

  [[ -e /usr/bin/node ]] || ln -sfn /usr/local/bin/node /usr/bin/node
  [[ -e /usr/bin/npm ]] || ln -sfn /usr/local/bin/npm /usr/bin/npm
  [[ -e /usr/bin/npx ]] || ln -sfn /usr/local/bin/npx /usr/bin/npx

  rm -rf "${tmp_dir}"
  node -v
  npm -v
}

create_runtime_user_and_dirs() {
  log "create runtime user and directories"
  getent group "${APP_GROUP}" >/dev/null 2>&1 || groupadd --system "${APP_GROUP}"
  id -u "${APP_USER}" >/dev/null 2>&1 || useradd --system --gid "${APP_GROUP}" --create-home --shell /bin/bash "${APP_USER}"

  install -d -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" "${PLAYWRIGHT_BROWSERS_PATH}"
  install -d -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" "${REPORTS_ROOT}"
  install -d -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" "${REPORTS_ROOT}/intent-e2e"
  chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"
}

validate_env() {
  log "validate env file"
  [[ -f "${ENV_FILE}" ]] || fail "缺少环境变量文件: ${ENV_FILE}"

  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a

  missing=()
  for name in DB_HOST DB_USER DB_PASSWORD DB_NAME DB_PORT APP_CRYPTO_KEY; do
    [[ -n "${!name:-}" ]] || missing+=("${name}")
  done
  [[ "${#missing[@]}" -eq 0 ]] || fail "环境变量缺少必填项: ${missing[*]}"
}

write_systemd_service() {
  log "write systemd service"
  cat >"/etc/systemd/system/${APP_SERVICE_NAME}.service" <<SERVICE
[Unit]
Description=AI Test Platform
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
Environment=PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH}
EnvironmentFile=${ENV_FILE}
ExecStart=${NODE_BIN} server.mjs
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=30
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
SERVICE

  chmod 0644 "/etc/systemd/system/${APP_SERVICE_NAME}.service"
  systemctl daemon-reload
  systemctl enable "${APP_SERVICE_NAME}"
}

write_nginx_conf() {
  log "write nginx conf"
  cat >"/etc/nginx/conf.d/${APP_SERVICE_NAME}.conf" <<NGINX
map \$http_upgrade \$connection_upgrade {
  default upgrade;
  '' close;
}

upstream ${APP_SERVICE_NAME}_upstream {
  server 127.0.0.1:${APP_PORT};
  keepalive 64;
}

server {
  listen 80;
  server_name ${DOMAIN_NAME};

  client_max_body_size 50m;

  location / {
    proxy_pass http://${APP_SERVICE_NAME}_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_connect_timeout 60s;
    proxy_buffering off;
  }
}
NGINX

  if command -v setsebool >/dev/null 2>&1; then
    setsebool -P httpd_can_network_connect 1 >/dev/null 2>&1 || true
  fi

  nginx -t
  systemctl enable nginx
  systemctl restart nginx
}

run_as_app_user() {
  local cmd="$1"
  local home_dir
  home_dir="$(getent passwd "${APP_USER}" | cut -d: -f6)"
  runuser -u "${APP_USER}" -- env \
    "HOME=${home_dir}" \
    "PATH=/usr/local/bin:/usr/bin:/bin" \
    "PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH}" \
    "PORT=${APP_PORT}" \
    bash -lc "${cmd}"
}

build_app() {
  log "build app"
  systemctl stop "${APP_SERVICE_NAME}" >/dev/null 2>&1 || true

  run_as_app_user "cd '${APP_DIR}' && set -a && source '${ENV_FILE}' && set +a && rm -rf node_modules && npm ci --include=dev"
  run_as_app_user "cd '${APP_DIR}' && set -a && source '${ENV_FILE}' && set +a && npm run build"
  run_as_app_user "cd '${APP_DIR}' && set -a && source '${ENV_FILE}' && set +a && npm run build:web"
  run_as_app_user "cd '${APP_DIR}' && set -a && source '${ENV_FILE}' && set +a && npx playwright install chromium"
  run_as_app_user "cd '${APP_DIR}' && set -a && source '${ENV_FILE}' && set +a && npm run db:init"
}

smoke_playwright() {
  log "smoke test Playwright Chromium"
  run_as_app_user "cd '${APP_DIR}' && node --input-type=module -e \"import { chromium } from 'playwright'; const browser = await chromium.launch({ headless: true }); await browser.close();\""
}

start_app() {
  log "start service"
  systemctl restart "${APP_SERVICE_NAME}"
  systemctl status "${APP_SERVICE_NAME}" --no-pager
}

main() {
  require_root
  require_centos7
  [[ -f "${APP_DIR}/package.json" ]] || fail "APP_DIR 不是项目根目录: ${APP_DIR}"

  rewrite_yum_to_vault
  install_packages
  install_node
  create_runtime_user_and_dirs
  validate_env
  write_systemd_service
  write_nginx_conf
  build_app
  smoke_playwright
  start_app

  echo
  echo "[deploy] done"
  echo "[deploy] app: ${APP_DIR}"
  echo "[deploy] env: ${ENV_FILE}"
  echo "[deploy] service: ${APP_SERVICE_NAME}"
  echo "[deploy] nginx: /etc/nginx/conf.d/${APP_SERVICE_NAME}.conf"
}

main "$@"
EOF

sudo bash /tmp/deploy-ai-test-centos7.sh
```

常用参数：

```bash
sudo \
  APP_DIR=/opt/ai-test-platform/app \
  ENV_FILE=/opt/ai-test-platform/shared/.env.production \
  APP_PORT=3666 \
  DOMAIN_NAME=super-test.example.com \
  bash /tmp/deploy-ai-test-centos7.sh
```

## nginx 配置

脚本会写入 `/etc/nginx/conf.d/auto-test-platform.conf`，核心配置如下：

```nginx
map $http_upgrade $connection_upgrade {
  default upgrade;
  '' close;
}

upstream auto-test-platform_upstream {
  server 127.0.0.1:3666;
  keepalive 64;
}

server {
  listen 80;
  server_name super-test.example.com;

  client_max_body_size 50m;

  location / {
    proxy_pass http://auto-test-platform_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_connect_timeout 60s;
    proxy_buffering off;
  }
}
```

如果前面还有 SLB / CDN / 企业网关负责 HTTPS，服务器本机保持 80 即可。如果要在本机终止 HTTPS，另行加证书和 `listen 443 ssl http2` 块，不要删除上面的 websocket / SSE proxy header。

## 验证命令

```bash
systemctl status auto-test-platform --no-pager
journalctl -u auto-test-platform -n 200 --no-pager
nginx -t
curl -I http://127.0.0.1:3666
curl -I http://127.0.0.1
```

浏览器访问：

```text
http://<服务器 IP 或域名>/
```

## 更新部署

代码更新后：

```bash
cd /opt/ai-test-platform/app
git pull --ff-only
sudo bash /tmp/deploy-ai-test-centos7.sh
```

如果 `/tmp/deploy-ai-test-centos7.sh` 已丢失，可以重新按本文“一键部署脚本”生成。

## 回滚

如果使用 git tag 或 commit 回滚：

```bash
cd /opt/ai-test-platform/app
git fetch --all --tags
git checkout <上一个稳定 tag 或 commit>
sudo bash /tmp/deploy-ai-test-centos7.sh
```

## 常见问题

### yum 源不可用

CentOS 7 默认 mirrorlist 已不可用，脚本会自动改到 `vault.centos.org`。如果机器无法访问外网，需要先配置内网 yum 源。

### Node 下载失败

默认下载 glibc-217 构建：

```text
https://unofficial-builds.nodejs.org/download/release/v22.22.2/node-v22.22.2-linux-x64-glibc-217.tar.xz
```

如果服务器无法访问该地址，可先把 tar 包下载到内网 HTTP，再执行：

```bash
sudo NODE_DIST_URL=http://你的内网地址/node-v22.22.2-linux-x64-glibc-217.tar.xz bash /tmp/deploy-ai-test-centos7.sh
```

### Playwright Chromium 启动失败

查看缺失库：

```bash
runuser -u autotest -- bash -lc "cd /opt/ai-test-platform/app && node --input-type=module -e \"import { chromium } from 'playwright'; console.log(chromium.executablePath())\""
ldd /opt/playwright-browsers/chromium-*/chrome-linux/chrome | grep 'not found'
```

按输出继续补 yum 包。

### nginx 502

检查应用服务：

```bash
systemctl status auto-test-platform --no-pager
journalctl -u auto-test-platform -n 200 --no-pager
curl -I http://127.0.0.1:3666
```

如果 SELinux 拦截 nginx 访问本机端口：

```bash
setsebool -P httpd_can_network_connect 1
systemctl restart nginx
```

### 数据库初始化失败

先在服务器上确认 MySQL 可达：

```bash
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e 'select 1'
```

如果没有 `mysql` 命令，可临时安装：

```bash
yum install -y mariadb
```
