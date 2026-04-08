#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "请用 root 或 sudo 运行此脚本"
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
