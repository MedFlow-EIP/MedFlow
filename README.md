# MedFlow — Application de révision médicale assistée par IA

MedFlow aide les étudiants en médecine à réviser : ils importent leurs cours PDF, l’IA en tire un résumé, des flashcards et un quiz, puis la répétition espacée (SM-2) leur propose chaque jour ce qu’il faut revoir. L’application est **mobile** (Expo / React Native) et s’appuie sur un **backend Flask**.

## Sommaire

1. [Structure du dépôt](#structure-du-dépôt)
2. [Technologies](#technologies)
3. [Fonctionnalités](#fonctionnalités)
4. [Lancer le projet en local](#lancer-le-projet-en-local)
5. [Variables d’environnement](#variables-denvironnement)
6. [Déploiement](#déploiement)
7. [CI/CD](#cicd)

---

## Structure du dépôt

```
backend/   → API Flask : PDF, génération IA, révision SM-2, comptes, amis, chat
mobile/    → application Expo / React Native
docs/      → documentation technique
Caddyfile  → HTTPS (Let's Encrypt) devant le backend
deploy.sh  → déploiement du backend sur la VM
```

## Technologies

| Côté | Technologie |
|------|-------------|
| Mobile | Expo 51, React Native, React Navigation |
| Backend | Flask, SQLite, pypdf |
| Authentification | Firebase Auth (tokens vérifiés côté backend) |
| IA | Google Vertex AI (Gemini 2.5 Pro), Ollama en option |
| Infra | Docker Compose, Caddy (HTTPS), GitHub Actions |

## Fonctionnalités

- Import de cours PDF (20 Mo max) → résumé, flashcards et quiz générés par l’IA
- Parcours gamifiés (leçons, cartes, quiz visuel, défi chronométré)
- Révision espacée SM-2 : cartes du jour, prévision par cours, cartes difficiles et maîtrisées
- Assistant IA médical (garde le fil de la conversation, accepte images et PDF, historique synchronisé entre appareils)
- XP, séries, badges, ligues, classement et amis
- Rappels de révision et de série à l’heure choisie
- Consultation des cours hors ligne
- Connexion par email ou Google (Android), vérification de l’email, suppression du compte
- Thème clair / sombre / système

---

## Lancer le projet en local

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows : venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

L’API répond sur `http://localhost:8080` (`/health` pour vérifier). En local, la configuration de développement est utilisée (tokens Firebase non vérifiés).

### Mobile

```bash
cd mobile
npm install
npx expo start            # téléphone (Expo Go) ou émulateur
npm run emu               # émulateur Android : adb reverse + expo start --localhost
```

Après une modification de `mobile/.env`, relancer avec `npx expo start -c`.

### Tests

```bash
cd backend && pytest -q
cd mobile && npx tsc --noEmit && npm test
```

---

## Variables d’environnement

### Backend — `backend/.env`

```env
FLASK_ENV=production              # imposé dans Docker ; "development" en local
GCP_TYPE=                         # compte de service Vertex AI
GCP_PROJECT_ID=
GCP_PRIVATE_KEY_ID=
GCP_PRIVATE_KEY=
GCP_CLIENT_EMAIL=
GCP_CLIENT_ID=
GCP_AUTH_URI=
GCP_TOKEN_URI=
GCP_AUTH_PROVIDER_X509_CERT_URL=
GCP_CLIENT_X509_CERT_URL=
GCP_UNIVERSE_DOMAIN=
FIREBASE_TYPE=                    # compte de service Firebase Admin (vérification des tokens)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_CLIENT_ID=
```

Optionnel : `AI_PROVIDER=ollama` (+ `OLLAMA_BASE_URL`, `OLLAMA_MODEL`), `ENABLE_DEBUG_ROUTES=true` pour les routes `/api/debug/*` en local.

**Garde-fous de coût IA** (valeurs par défaut entre parenthèses) :

| Variable | Rôle |
|---|---|
| `AI_CHAT_MODEL` (`gemini-2.5-pro`) | Modèle du chat |
| `AI_COURSE_MODEL` (`gemini-2.5-pro`) | Modèle de génération des cours |
| `AI_MAX_OUTPUT_TOKENS` (`8192`) | Plafond de tokens générés par appel |
| `AI_CHAT_PER_MINUTE` / `AI_CHAT_PER_DAY` (`6` / `60`) | Messages au chat par compte |
| `AI_PROCESS_PER_HOUR` / `AI_PROCESS_PER_DAY` (`5` / `10`) | Imports de PDF par compte |
| `AI_GLOBAL_PER_DAY` (`2000`) | Appels IA sur 24 h, tous comptes confondus |

Les modèles disponibles dépendent du projet Vertex AI : un modèle absent fait échouer toutes les générations (`404 Publisher model … was not found` dans les logs du backend).

Au-delà, l’API répond `429`. En production, l’IA est aussi réservée aux comptes dont l’email est vérifié (`403`). Pense à créer une **alerte budget** dans la console GCP (Facturation → Budgets et alertes).

### Mobile — `mobile/.env`

```env
EXPO_PUBLIC_API_URL=https://5-196-191-64.sslip.io   # sans : 10.0.2.2:8080 (émulateur)
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=      # connexion Google (facultatif)
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

**Connexion Google (Android)** : activer le fournisseur Google dans Firebase Authentication, puis dans Google Cloud Console → *Identifiants* récupérer l’ID client **Web** (créé par Firebase) et créer un ID client **Android** (package `com.wavitooo.medflowlearning` + empreinte SHA-1 de la clé de signature : `eas credentials` pour un build EAS). Le bouton n’apparaît que dans un build de l’app (APK), pas dans Expo Go. Pour un build EAS, ajouter aussi ces variables dans les variables d’environnement EAS : le `.env` n’est pas envoyé.

Les variables `EXPO_PUBLIC_*` sont intégrées à l’application : n’y mettre aucun secret. Les `.env` ne sont jamais commités.

---

## Déploiement

Le backend tourne sur la VM avec Docker Compose : le conteneur `backend` (Flask, toujours en production) et `caddy`, qui sert l’API en **HTTPS** sur `https://5-196-191-64.sslip.io` avec un certificat Let’s Encrypt gratuit, renouvelé automatiquement.

- **Automatique :** chaque merge sur `main` avec une CI verte lance le workflow *Deploy backend*, qui exécute `deploy.sh` sur la VM en SSH (secrets `VM_HOST`, `VM_USER`, `VM_SSH_KEY`).
- **À la main / une autre branche :** onglet Actions → *Deploy backend* → *Run workflow*, ou sur la VM `bash deploy.sh <branche>`.

`deploy.sh` sauvegarde les `.env` et la base SQLite, reconstruit l’image, vérifie que Firebase Admin démarre et importe les comptes Firebase dans le classement.

**Sauvegarde quotidienne de la base** (une fois, sur la VM, via `crontab -e`) :

```cron
0 3 * * * cd ~/MedFlow && bash backup_db.sh >> backups/backup.log 2>&1
```

Les 14 dernières copies sont gardées dans `backend/data/backups/`. Elles sont sur le même disque que la base : pour se protéger d’une perte de la VM, les copier aussi ailleurs de temps en temps (`scp`).

## CI/CD

GitHub Actions (`.github/workflows/`) :
- `ci.yml` : tests backend (pytest), typecheck et tests mobile, build et démarrage Docker sur `main` ;
- `deploy.yml` : déploiement sur la VM ;
- `mobile-build.yml` : build APK via EAS (manuel) ;
- `mirror.yml` : miroir vers le dépôt Epitech.

Voir [docs/ci-cd.md](docs/ci-cd.md) et [docs/docker.md](docs/docker.md).
