#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_DIR="${APP_DIR:-${PROJECT_ROOT}}"
APP_USER="${APP_USER:-autotest}"
APP_GROUP="${APP_GROUP:-${APP_USER}}"
APP_SERVICE_NAME="${APP_SERVICE_NAME:-auto-test-platform}"
APP_PORT="${APP_PORT:-3666}"
PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/playwright-browsers}"
REPORTS_ROOT="${REPORTS_ROOT:-${APP_DIR}/shared/reports}"
SETUP_NGINX="${SETUP_NGINX:-1}"
DOMAIN_NAME="${DOMAIN_NAME:-_}"
NODE_VERSION="${NODE_VERSION:-22.22.2}"
NODE_DIST_URL="${NODE_DIST_URL:-https://unofficial-builds.nodejs.org/download/release/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64-glibc-217.tar.xz}"
NODE_INSTALL_ROOT="${NODE_INSTALL_ROOT:-/usr/local/lib/nodejs}"
NODE_BIN="${NODE_BIN:-/usr/local/bin/node}"
SERVICE_TEMPLATE="${PROJECT_ROOT}/deploy/systemd/auto-test-platform-centos7-raw.service.template"
SYSTEMD_UNIT_PATH="/etc/systemd/system/${APP_SERVICE_NAME}.service"
NGINX_CONF_PATH="/etc/nginx/conf.d/${APP_SERVICE_NAME}.conf"
APP_HOME=""

DEFAULT_ENV_FILE=""
if [[ -f "${APP_DIR}/shared/.env.production" ]]; then
  DEFAULT_ENV_FILE="${APP_DIR}/shared/.env.production"
else
  DEFAULT_ENV_FILE="${APP_DIR}/.env.production"
fi
ENV_FILE="${ENV_FILE:-${DEFAULT_ENV_FILE}}"

BASE_PACKAGES=(
  ca-certificates
  curl
  findutils
  git
  nginx
  openssl
  procps-ng
  rsync
  shadow-utils
  tar
  unzip
  which
  xz
  yum-utils
)

PLAYWRIGHT_RUNTIME_PACKAGES=(
  alsa-lib
  atk
  at-spi2-atk
  cairo
  cups-libs
  dbus-glib
  dbus-libs
  gdk-pixbuf2
  glib2
  gtk3
  libdrm
  libX11
  libX11-xcb
  libXcomposite
  libXcursor
  libXdamage
  libXext
  libXfixes
  libXi
  libxkbcommon
  libXrandr
  libXrender
  libXScrnSaver
  libXtst
  libxcb
  libxshmfence
  mesa-libgbm
  nspr
  nss
  pango
)

OPTIONAL_PACKAGES=(
  epel-release
  liberation-fonts
  xorg-x11-fonts-Type1
  xorg-x11-fonts-misc
  xorg-x11-server-Xvfb
  xorg-x11-utils
)

log_step() {
  echo
  echo "[centos7-raw] $*"
}

fail() {
  echo "[centos7-raw] $*" >&2
  exit 1
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    fail "请用 root 或 sudo 运行此脚本"
  fi
}

require_centos7() {
  if ! command -v yum >/dev/null 2>&1; then
    fail "当前环境未检测到 yum。这个脚本只针对 CentOS 7 裸机。"
  fi
  if [[ ! -f /etc/centos-release ]] || ! grep -q 'CentOS Linux release 7' /etc/centos-release; then
    fail "当前系统不是 CentOS Linux 7。请先执行: cat /etc/centos-release"
  fi
}

rewrite_centos7_repos_to_vault() {
  log_step "rewrite CentOS 7 repos to vault"
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

install_packages_best_effort() {
  local pkg=""
  local failed=()
  for pkg in "$@"; do
    if rpm -q "${pkg}" >/dev/null 2>&1; then
      continue
    fi
    if yum install -y "${pkg}"; then
      continue
    fi
    failed+=("${pkg}")
  done

  if [[ "${#failed[@]}" -gt 0 ]]; then
    echo "[centos7-raw] warning: these packages could not be installed automatically: ${failed[*]}"
  fi
}

install_runtime_packages() {
  log_step "install base packages"
  install_packages_best_effort "${BASE_PACKAGES[@]}"

  log_step "install optional repos and browser runtime packages"
  install_packages_best_effort "${OPTIONAL_PACKAGES[@]}"
  install_packages_best_effort "${PLAYWRIGHT_RUNTIME_PACKAGES[@]}"

  if command -v fc-cache >/dev/null 2>&1; then
    fc-cache -f >/dev/null 2>&1 || true
  fi
}

install_node_runtime() {
  export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"
  local expected_version="v${NODE_VERSION}"
  if [[ -x "${NODE_BIN}" ]] && [[ "$("${NODE_BIN}" -v 2>/dev/null || true)" == "${expected_version}" ]]; then
    log_step "node ${NODE_VERSION} already installed"
    return
  fi

  log_step "install node ${NODE_VERSION} from glibc-217 build"
  local tmp_dir=""
  local archive_path=""
  local extract_dir=""
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
  if [[ -x "${NODE_INSTALL_ROOT}/current/bin/corepack" ]]; then
    ln -sfn "${NODE_INSTALL_ROOT}/current/bin/corepack" /usr/local/bin/corepack
  fi

  if [[ ! -e /usr/bin/node ]]; then
    ln -sfn /usr/local/bin/node /usr/bin/node
  fi
  if [[ ! -e /usr/bin/npm ]]; then
    ln -sfn /usr/local/bin/npm /usr/bin/npm
  fi
  if [[ ! -e /usr/bin/npx ]]; then
    ln -sfn /usr/local/bin/npx /usr/bin/npx
  fi

  rm -rf "${tmp_dir}"

  node -v
  npm -v
}

ensure_app_user_and_dirs() {
  log_step "ensure runtime user and directories"
  if ! getent group "${APP_GROUP}" >/dev/null 2>&1; then
    groupadd --system "${APP_GROUP}"
  fi
  if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    useradd --system --gid "${APP_GROUP}" --create-home --shell /bin/bash "${APP_USER}"
  fi
  APP_HOME="$(getent passwd "${APP_USER}" | cut -d: -f6)"
  if [[ -z "${APP_HOME}" ]]; then
    fail "无法解析运行用户 home: ${APP_USER}"
  fi

  install -d -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" "${PLAYWRIGHT_BROWSERS_PATH}"
  install -d -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" "${REPORTS_ROOT}"
  install -d -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" "${REPORTS_ROOT}/intent-e2e"
  chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"
}

ensure_env_file() {
  if [[ -f "${ENV_FILE}" ]]; then
    return
  fi

  log_step "create env template"
  mkdir -p "$(dirname "${ENV_FILE}")"
  cp "${PROJECT_ROOT}/deploy/env/production.env.example" "${ENV_FILE}"
  chown "${APP_USER}:${APP_GROUP}" "${ENV_FILE}"
  fail "已创建环境文件模板: ${ENV_FILE}。请先补齐 DB_HOST / DB_USER / DB_PASSWORD / DB_NAME / APP_CRYPTO_KEY 后重跑。"
}

validate_env_file() {
  log_step "validate env file"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a

  local required_vars=(
    DB_HOST
    DB_USER
    DB_PASSWORD
    DB_NAME
    DB_PORT
    APP_CRYPTO_KEY
  )
  local missing=()
  local var_name=""
  for var_name in "${required_vars[@]}"; do
    if [[ -z "${!var_name:-}" ]]; then
      missing+=("${var_name}")
    fi
  done

  if [[ "${#missing[@]}" -gt 0 ]]; then
    fail "环境文件缺少必填项: ${missing[*]} (file: ${ENV_FILE})"
  fi
}

render_systemd_service() {
  log_step "install systemd service"
  if [[ ! -f "${SERVICE_TEMPLATE}" ]]; then
    fail "缺少 service 模板: ${SERVICE_TEMPLATE}"
  fi

  sed \
    -e "s#__APP_USER__#${APP_USER}#g" \
    -e "s#__APP_GROUP__#${APP_GROUP}#g" \
    -e "s#__APP_DIR__#${APP_DIR}#g" \
    -e "s#__APP_PORT__#${APP_PORT}#g" \
    -e "s#__PLAYWRIGHT_BROWSERS_PATH__#${PLAYWRIGHT_BROWSERS_PATH}#g" \
    -e "s#__ENV_FILE__#${ENV_FILE}#g" \
    -e "s#__NODE_BIN__#${NODE_BIN}#g" \
    "${SERVICE_TEMPLATE}" >"${SYSTEMD_UNIT_PATH}"

  chmod 0644 "${SYSTEMD_UNIT_PATH}"
  systemctl daemon-reload
  systemctl enable "${APP_SERVICE_NAME}"
}

configure_nginx() {
  if [[ "${SETUP_NGINX}" != "1" ]]; then
    return
  fi

  log_step "configure nginx"
  cat >"${NGINX_CONF_PATH}" <<EOF
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
EOF

  if command -v setsebool >/dev/null 2>&1; then
    setsebool -P httpd_can_network_connect 1 >/dev/null 2>&1 || true
  fi

  nginx -t
  systemctl enable nginx
  systemctl restart nginx
}

run_as_app_user() {
  local command="$1"
  if command -v runuser >/dev/null 2>&1; then
    runuser -u "${APP_USER}" -- env \
      "HOME=${APP_HOME}" \
      "PATH=/usr/local/bin:/usr/bin:/bin" \
      "PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH}" \
      "PORT=${APP_PORT}" \
      bash -lc "${command}"
    return
  fi

  su - "${APP_USER}" -s /bin/bash -c "export HOME='${APP_HOME}' PATH='/usr/local/bin:/usr/bin:/bin' PLAYWRIGHT_BROWSERS_PATH='${PLAYWRIGHT_BROWSERS_PATH}' PORT='${APP_PORT}'; ${command}"
}

build_application() {
  log_step "build application"
  systemctl stop "${APP_SERVICE_NAME}" >/dev/null 2>&1 || true
  run_as_app_user "cd '${APP_DIR}' && ENV_FILE='${ENV_FILE}' PORT='${APP_PORT}' PLAYWRIGHT_BROWSERS_PATH='${PLAYWRIGHT_BROWSERS_PATH}' bash scripts/deploy/deploy-web.sh"
}

smoke_launch_browser() {
  log_step "smoke test playwright chromium launch"
  local browser_path=""
  browser_path="$(run_as_app_user "cd '${APP_DIR}' && node --input-type=module -e \"import { chromium } from 'playwright'; console.log(chromium.executablePath());\"")"

  if run_as_app_user "cd '${APP_DIR}' && node --input-type=module -e \"import { chromium } from 'playwright'; const browser = await chromium.launch({ headless: true }); await browser.close();\""; then
    return
  fi

  echo "[centos7-raw] playwright smoke failed"
  if [[ -n "${browser_path}" ]] && [[ -x "${browser_path}" ]]; then
    echo "[centos7-raw] browser binary: ${browser_path}"
    ldd "${browser_path}" | grep 'not found' || true
  fi
  exit 1
}

start_application() {
  log_step "start application service"
  systemctl restart "${APP_SERVICE_NAME}"
  systemctl status "${APP_SERVICE_NAME}" --no-pager
}

main() {
  require_root
  require_centos7
  rewrite_centos7_repos_to_vault
  install_runtime_packages
  install_node_runtime
  ensure_app_user_and_dirs
  ensure_env_file
  validate_env_file
  render_systemd_service
  configure_nginx
  build_application
  smoke_launch_browser
  start_application

  echo
  echo "[centos7-raw] done"
  echo "[centos7-raw] app dir: ${APP_DIR}"
  echo "[centos7-raw] env file: ${ENV_FILE}"
  echo "[centos7-raw] service: ${APP_SERVICE_NAME}"
  echo "[centos7-raw] port: ${APP_PORT}"
}

main "$@"
