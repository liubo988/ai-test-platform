#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "请用 root 或 sudo 运行此脚本"
  exit 1
fi

if ! command -v yum >/dev/null 2>&1; then
  echo "当前环境未检测到 yum。"
  if command -v apt-get >/dev/null 2>&1; then
    echo "这台机器更像 Debian/Ubuntu 系，不是 CentOS 7 原生宿主机。"
    echo "如果你要走 Ubuntu 原生部署，请改用: sudo bash scripts/deploy/install-runtime-ubuntu.sh"
    echo "如果你要走 Docker 部署，请先按当前发行版单独安装 docker 和 nginx。"
  elif command -v dnf >/dev/null 2>&1; then
    echo "这台机器更像新版本 RHEL/Rocky/Alma/CentOS Stream，当前脚本只针对 CentOS 7 + yum。"
    echo "请改用 dnf 手工安装 docker、nginx，或迁到受支持的 Ubuntu/Debian 主机。"
  else
    echo "当前机器既没有 yum，也没有常见的 apt-get/dnf。请先执行: cat /etc/os-release"
  fi
  exit 1
fi

if [[ -f /etc/centos-release ]] && grep -q 'CentOS Linux release 7' /etc/centos-release; then
  echo "[0/7] rewrite CentOS 7 repos to vault"
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
fi

echo "[1/7] install base packages"
yum install -y yum-utils device-mapper-persistent-data lvm2 curl git nginx

echo "[2/7] configure docker repo"
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

echo "[3/7] install docker engine"
yum install -y docker-ce docker-ce-cli containerd.io

echo "[4/7] enable services"
systemctl daemon-reload
systemctl enable docker
systemctl restart docker
systemctl enable nginx
systemctl restart nginx

echo "[5/7] create runtime directories"
mkdir -p /var/www/certbot
mkdir -p /opt/ai-test-platform/shared
mkdir -p /opt/ai-test-platform/shared/reports

echo "[6/7] warm yum cache"
yum makecache fast

echo "[7/7] done"
docker --version
nginx -v
