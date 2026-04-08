#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "请用 root 或 sudo 运行此脚本"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y \
  apt-transport-https \
  build-essential \
  ca-certificates \
  certbot \
  curl \
  fonts-liberation \
  fonts-noto-color-emoji \
  git \
  gnupg \
  jq \
  libappindicator3-1 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libu2f-udev \
  libvulkan1 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  lsb-release \
  mysql-client \
  nginx \
  openssl \
  python3-certbot-nginx \
  rsync \
  software-properties-common \
  unzip \
  xvfb

if ! dpkg -s libasound2 >/dev/null 2>&1; then
  apt-get install -y libasound2t64 || apt-get install -y libasound2
fi

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" -lt 22 ]]; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" >/etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
fi

mkdir -p /var/www/certbot
mkdir -p /opt/playwright-browsers

echo "runtime install completed"
node -v
npm -v
