# CI/CD

## `ci.yml` — à chaque push sur `main` et chaque pull request vers `main`

| Job | Étapes |
|-----|--------|
| `build-and-test` | Python 3.11, dépendances, `pytest` (backend) |
| `mobile-test` | Node 20, `npm ci`, `tsc --noEmit`, `jest` (mobile) |
| `docker-build` | Sur `main` uniquement : construit l’image et vérifie que le backend démarre (`/health`). Caddy n’est pas lancé ici : il demanderait le certificat de la VM depuis le runner. |

Les modifications limitées à `docs/` ou aux fichiers Markdown ne déclenchent pas la CI.

## `deploy.yml` — déploiement du backend

- Se lance quand `CI MedFlow` réussit sur un push sur `main`, ou à la main (*Run workflow*) avec le nom d’une branche.
- Se connecte en SSH à la VM et exécute `bash deploy.sh <branche>`.
- Secrets : `VM_HOST`, `VM_USER`, `VM_SSH_KEY` (clé privée **sans** phrase de passe, dédiée au déploiement), `VM_PORT` et `VM_SSH_PASSPHRASE` optionnels.

## `deploy.sh` — sur la VM

1. Sauvegarde `backend/.env` et `.env` dans `backups/`.
2. Refuse de continuer si la VM a des modifications non commitées.
3. Récupère la branche demandée (`main` par défaut).
4. Vérifie la présence des variables `GCP_*` et `FIREBASE_*`.
5. Sauvegarde la base SQLite (`backup_db.sh`), reconstruit l’image backend (`--no-cache`), récupère Caddy, redémarre.
6. Vérifie que Firebase Admin s’est initialisé.
7. Importe les comptes Firebase dans le classement.

## Autres workflows

- `mobile-build.yml` : APK Android compilé sur GitHub (`expo prebuild` puis Gradle), signé avec la clé EAS. Se lance à chaque push sur `main` qui touche `mobile/`, ou à la main. L'APK est publié dans la release `apk-latest` (lien fixe) ; le numéro de build est intégré à l'app, qui propose la mise à jour aux testeurs. Secrets : `MOBILE_ENV` (contenu de `mobile/.env`), `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `GOOGLE_SERVICES_JSON` (facultatif, pour les notifications push).
- `mirror.yml` : miroir de `main` vers le dépôt Epitech.
