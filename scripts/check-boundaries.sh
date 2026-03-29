#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

violations=0

report_matches() {
  local title="$1"
  local matches="$2"

  if [ -n "$matches" ]; then
    echo "[check-boundaries] ${title}"
    echo "$matches"
    echo
    violations=$((violations + 1))
  fi
}

ui_db_matches="$(rg -n "(@/lib/db/|mysql2/|app/api/)" components app --glob '!app/api/**' --glob '*.ts' --glob '*.tsx' || true)"
report_matches "UI 层不能直接依赖数据库实现、mysql2 或 route 文件" "$ui_db_matches"

ai_ui_matches="$(rg -n "(@/components/|@/app/|from '../components|from '../../components|from '../app|from '../../app')" lib/ai lib/services --glob '*.ts' --glob '*.tsx' || true)"
report_matches "lib/ai 和 lib/services 不能反向依赖 app/components" "$ai_ui_matches"

api_mysql_matches="$(rg -n "(mysql2/|@/lib/db/client)" app/api --glob '*.ts' --glob '*.tsx' || true)"
report_matches "API route 不能直接依赖 mysql2 或 db client" "$api_mysql_matches"

db_ui_matches="$(rg -n "(@/components/|@/app/|from '../components|from '../../components|from '../app|from '../../app')" lib/db --glob '*.ts' --glob '*.tsx' || true)"
report_matches "lib/db 不能反向依赖 UI 或 route 层" "$db_ui_matches"

if [ "$violations" -gt 0 ]; then
  echo "[check-boundaries] failed with ${violations} violation group(s)."
  exit 1
fi

echo "[check-boundaries] OK"
