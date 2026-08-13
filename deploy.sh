#!/usr/bin/env bash
#
# Script de déploiement du backend MedFlow — à lancer DEPUIS LA VM
# (dans ~/MedFlow), pas depuis ton PC.
#
# Remplace la routine manuelle "git pull / docker compose build /
# docker compose up" — et surtout force un REBUILD COMPLET à chaque fois,
# ce qui a été la cause de plusieurs bugs cette session (nouvelles tables
# SQL ou nouvelles routes jamais réellement prises en compte parce que
# l'image Docker n'avait pas été reconstruite, juste redémarrée).
#
# Ce script :
#   1. Sauvegarde backend/.env et .env AVANT de toucher à quoi que ce soit
#      (rollback possible en une commande si besoin).
#   2. Refuse de continuer s'il y a des changements locaux non commit
#      sur la VM (évite d'écraser silencieusement un edit manuel).
#   3. Vérifie, APRÈS le pull, que les credentials GCP_*/FIREBASE_* sont
#      toujours bien présents dans les deux .env — s'arrête net avant de
#      rebuild si l'un des deux jeux de variables a disparu.
#   4. Rebuild avec --no-cache (jamais juste "up -d" seul) et redémarre.
#   5. Vérifie dans les logs que Firebase Admin s'est bien initialisé
#      SANS erreur "aud" — le bug qu'on a chassé plusieurs fois cette
#      session, maintenant détecté automatiquement à chaque déploiement.
#
# Usage : ./deploy.sh

set -euo pipefail

cd "$(dirname "$0")"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[deploy]${NC} $1"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $1"; }
fail()  { echo -e "${RED}[deploy] ÉCHEC :${NC} $1"; exit 1; }

# --- 1. Sauvegarde des .env avant de toucher à quoi que ce soit -----------

BACKUP_DIR="backups/env-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f backend/.env ]; then
  cp backend/.env "$BACKUP_DIR/backend.env"
fi
if [ -f .env ]; then
  cp .env "$BACKUP_DIR/root.env"
fi
info "Sauvegarde des .env dans $BACKUP_DIR"

# --- 2. Refuse de continuer s'il y a des changements locaux non commit ----

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  fail "Des changements locaux non commit existent sur la VM. Vérifie avec 'git status' avant de relancer — un 'git pull' pourrait les écraser silencieusement."
fi

# --- 3. Pull + vérification des credentials ---------------------------

info "git pull origin main..."
git pull origin main

check_env_vars() {
  local file="$1"
  local prefix="$2"
  local count
  count=$(grep -c "^${prefix}" "$file" 2>/dev/null || true)
  if [ "$count" -lt 1 ]; then
    fail "Aucune variable ${prefix}* trouvée dans $file après le pull. Restaure depuis $BACKUP_DIR avant de continuer (voir README section Rollback)."
  fi
  info "$file contient bien des variables ${prefix}* ($count lignes)"
}

check_env_vars backend/.env "GCP_"
check_env_vars backend/.env "FIREBASE_"
check_env_vars .env "GCP_"
check_env_vars .env "FIREBASE_"

# --- 4. Rebuild COMPLET (jamais juste redémarrer) ----------------------

info "Rebuild du backend (--no-cache)..."
docker compose build --no-cache backend

info "Redémarrage des conteneurs..."
docker compose up -d

# --- 5. Vérifie que Firebase s'est bien initialisé, sans erreur aud -----

info "Attente du démarrage du backend..."
sleep 8

LOGS=$(docker compose logs backend --tail=50)

if echo "$LOGS" | grep -q 'incorrect "aud"'; then
  warn "Le backend a démarré mais Firebase Admin rejette les tokens (erreur 'aud')."
  warn "Les credentials FIREBASE_* pointent probablement vers le mauvais projet."
  warn "Sauvegarde disponible dans $BACKUP_DIR si besoin de comparer/restaurer."
  fail "Vérification Firebase échouée — voir logs ci-dessus."
fi

if ! echo "$LOGS" | grep -q "Firebase Admin SDK initialised"; then
  warn "Impossible de confirmer que Firebase Admin s'est initialisé (message absent des logs récents)."
  fail "Vérification Firebase incertaine — inspecte manuellement : docker compose logs backend"
fi

info "Firebase Admin SDK initialisé correctement."
info "Déploiement terminé avec succès."