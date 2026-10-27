#!/usr/bin/env bash
#
# Sauvegarde de la base SQLite du backend — à lancer DEPUIS LA VM (dans ~/MedFlow).
#
# Utilise l'API de sauvegarde de SQLite (copie cohérente même si le backend
# écrit en même temps), écrit dans backend/data/backups/ et garde les
# KEEP dernières copies.
#
# Appelé par deploy.sh avant chaque déploiement. Pour une sauvegarde
# quotidienne, ajouter à la crontab de la VM (crontab -e) :
#   0 3 * * * cd ~/MedFlow && bash backup_db.sh >> backups/backup.log 2>&1
#
# Usage : bash backup_db.sh

set -euo pipefail

cd "$(dirname "$0")"

KEEP="${KEEP:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

if ! docker compose ps --status running --services 2>/dev/null | grep -qx backend; then
  echo "[backup] Backend arrêté : rien à sauvegarder."
  exit 0
fi

docker compose exec -T backend python - "$STAMP" <<'EOF'
import os
import sqlite3
import sys

from config import Config

src_path = Config.DATABASE_PATH
if not os.path.exists(src_path):
    print("[backup] Base introuvable :", src_path)
    sys.exit(0)

backup_dir = os.path.join(os.path.dirname(src_path), "backups")
os.makedirs(backup_dir, exist_ok=True)
dest_path = os.path.join(backup_dir, f"medflow-{sys.argv[1]}.db")

src = sqlite3.connect(src_path)
dest = sqlite3.connect(dest_path)
with dest:
    src.backup(dest)
dest.close()
src.close()
print("[backup] Sauvegarde :", dest_path)
EOF

# Ne garde que les KEEP sauvegardes les plus récentes.
ls -1t backend/data/backups/medflow-*.db 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "[backup] $(ls -1 backend/data/backups/medflow-*.db 2>/dev/null | wc -l) sauvegarde(s) conservée(s)."
