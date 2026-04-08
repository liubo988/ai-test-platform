#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env.production}"
IMAGE_NAME="${IMAGE_NAME:-auto-test-platform:latest}"
REPORTS_DIR="${REPORTS_DIR:-${PROJECT_ROOT}/reports}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "缺少环境文件: ${ENV_FILE}"
  exit 1
fi

cd "${PROJECT_ROOT}"
mkdir -p "${REPORTS_DIR}"

docker build -f deploy/docker/Dockerfile.playwright -t "${IMAGE_NAME}" .

docker run --rm \
  --env-file "${ENV_FILE}" \
  -e NODE_ENV=production \
  -e PORT=3666 \
  -v "${REPORTS_DIR}:/app/reports" \
  "${IMAGE_NAME}" \
  npm run db:init

echo "docker image build completed: ${IMAGE_NAME}"
