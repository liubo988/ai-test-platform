#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env.production}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "缺少环境文件: ${ENV_FILE}"
  exit 1
fi

cd "${PROJECT_ROOT}"

set -a
source "${ENV_FILE}"
set +a

export NODE_ENV=production
export PORT="${PORT:-3666}"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/playwright-browsers}"

mkdir -p "${PLAYWRIGHT_BROWSERS_PATH}"
mkdir -p "${INTENT_E2E_RUN_ARTIFACT_ROOT:-${PROJECT_ROOT}/reports/intent-e2e/runs}"
mkdir -p "${INTENT_E2E_PROJECT_ASSET_ROOT:-${PROJECT_ROOT}/reports/intent-e2e/projects}"

npm ci
npm run build
npm run build:web
npx playwright install chromium
npm run db:init

echo "deploy build completed"
