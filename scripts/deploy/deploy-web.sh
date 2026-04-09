#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env.production}"
DEPLOY_ACTIVE_SERVICE_NAME="${DEPLOY_ACTIVE_SERVICE_NAME:-auto-test-platform}"
REQUIRED_PLAYWRIGHT_LIBS=(
  "libatk-1.0.so.0"
  "libatk-bridge-2.0.so.0"
  "libgbm.so.1"
  "libgtk-3.so.0"
  "libnss3.so"
)

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "缺少环境文件: ${ENV_FILE}"
  exit 1
fi

check_playwright_linux_runtime() {
  if ! command -v ldconfig >/dev/null 2>&1; then
    return 0
  fi

  local missing=()
  local lib=""
  for lib in "${REQUIRED_PLAYWRIGHT_LIBS[@]}"; do
    if ! ldconfig -p 2>/dev/null | grep -Fq "${lib}"; then
      missing+=("${lib}")
    fi
  done

  if [[ "${#missing[@]}" -gt 0 ]]; then
    echo "缺少 Playwright Linux 运行库: ${missing[*]}"
    echo "请先执行: sudo bash scripts/deploy/install-runtime-ubuntu.sh"
    echo "如果是 Debian/Ubuntu，也可按官方方式执行: sudo npx playwright install-deps chromium"
    exit 1
  fi
}

cd "${PROJECT_ROOT}"

set -a
source "${ENV_FILE}"
set +a

if command -v systemctl >/dev/null 2>&1 && [[ "${SKIP_SERVICE_ACTIVE_CHECK:-0}" != "1" ]]; then
  if systemctl is-active --quiet "${DEPLOY_ACTIVE_SERVICE_NAME}" 2>/dev/null; then
    echo "检测到服务仍在运行: ${DEPLOY_ACTIVE_SERVICE_NAME}"
    echo "请先执行: sudo systemctl stop ${DEPLOY_ACTIVE_SERVICE_NAME}"
    echo "构建完成后再执行: sudo systemctl start ${DEPLOY_ACTIVE_SERVICE_NAME}"
    exit 1
  fi
fi

export PORT="${PORT:-3666}"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/playwright-browsers}"

check_playwright_linux_runtime

mkdir -p "${PLAYWRIGHT_BROWSERS_PATH}"
mkdir -p "${INTENT_E2E_RUN_ARTIFACT_ROOT:-${PROJECT_ROOT}/reports/intent-e2e/runs}"
mkdir -p "${INTENT_E2E_PROJECT_ASSET_ROOT:-${PROJECT_ROOT}/reports/intent-e2e/projects}"

# Keep build-time toolchain available even when deploying with production env files.
# A clean reinstall also avoids noisy npm tar warnings from stale/corrupted node_modules.
rm -rf "${PROJECT_ROOT}/node_modules"
npm ci --include=dev
export NODE_ENV=production
npm run build
npm run build:web
npx playwright install chromium
npm run db:init

echo "deploy build completed"
