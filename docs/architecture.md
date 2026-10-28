# Architecture technique de MedFlow

## Vue d’ensemble

```
Application mobile (Expo / React Native)
        │  HTTPS + token Firebase (Authorization: Bearer)
        ▼
Caddy (HTTPS, Let's Encrypt) ──► Backend Flask (Docker, port 8080 interne)
                                    │
                                    ├─ SQLite (backend/data/medflow.db)
                                    ├─ Fichiers (backend/uploads : PDF, avatars)
                                    ├─ Vertex AI — Gemini 2.5 Pro (ou Ollama)
                                    ├─ Firebase Admin (vérification des tokens, liste des comptes)
                                    └─ Expo Push (notifications : cours ou cas prêt, amis, défis)

GitHub Actions ──► release « apk-latest » (APK) ◄── l'app vérifie s'il y a une version plus récente
```

## Mobile (`mobile/`)

- Expo 51, React Navigation (onglets Accueil, Cours, bouton « + », IA Chat, Compte + écrans empilés).
- Firebase Auth côté client ; chaque appel API envoie le token et le décalage horaire du téléphone (`X-TZ-Offset`, pour que « aujourd'hui » soit le jour de l'étudiant) via `utils/authHeaders.ts`.
- Travaux longs suivis en arrière-plan : imports (`utils/importJobs.ts`) et cas cliniques (`utils/caseJobs.ts`), avec un bandeau quand c'est prêt (`components/ui/JobDoneBanner.tsx`).
- Analytique sans effet visible : écrans vus et étapes clés (`utils/analytics.ts`).
- Mise à jour de l'APK proposée au lancement (`utils/appUpdate.ts`).
- Thème clair / sombre par tokens (`theme/colors.ts`), marges calculées depuis les safe areas (`components/navigation/constants.ts`).
- Contenu des leçons des parcours dans `content/lessons.ts` ; étapes dans `components/steps/`.
- Cache local par utilisateur (AsyncStorage) : conversations IA, cours consultables hors ligne (`utils/offlineCache.ts`).

## Backend (`backend/`)

- `app.py` : fabrique Flask, configuration (`config.py`), CORS, Firebase Admin, Swagger (`/api/docs`).
- `middleware/auth.py` : `@require_auth` vérifie le token Firebase (production) et inscrit l’utilisateur à sa première requête (classement, recherche d’amis).
- `middleware/ai_quota.py` : quotas IA par compte et plafond global ; `ai_usage_summary` pour l'affichage.
- `routes/` : comptes et analytique (`account.py`), cours et import (`courses.py`), parcours et leçons, révision SM-2 (`sessions.py`), flashcards SRS, examens, examen blanc, cas cliniques, quêtes, amis et défis, chat IA, santé.
- `database.py` : accès SQLite (requêtes paramétrées), migrations légères au démarrage.
- `services/ai/` : fournisseurs IA (Vertex AI par défaut, Ollama en option).
- `services/` : lecture des documents, spécialités, notifications push, cours d'exemple.
- `user_clock.py` : « aujourd'hui » selon le fuseau envoyé par l'app.
- `sync_firebase_users.py` : importe les comptes Firebase existants (lancé par `deploy.sh`).
- `export_analytics.py` : export CSV des données d'usage et des erreurs signalées (track EIP).

## Flux principal : import d’un cours

1. Le mobile envoie le document (`POST /api/process`, 20 Mo max ; PDF, photo, Word, PowerPoint).
2. Le backend répond tout de suite avec un identifiant de travail et génère en arrière-plan : texte (pypdf, ou lecture par Gemini pour les photos, scans et schémas), puis titre, résumé, flashcards et quiz en parallèle.
3. Le mobile interroge `GET /api/process/jobs/<id>` ; le serveur envoie aussi une notification push quand le cours est prêt.
4. Le cours est enregistré ; ses questions entrent dans la révision SM-2. Le mobile le met en cache pour la consultation hors ligne.

Les cas cliniques suivent le même principe (`POST /api/cases` avec `background: true`).

## Sécurité

- Docker force `FLASK_ENV=production` : tokens Firebase vérifiés, pas d’en-tête `X-User-UID`, pas de débogueur.
- L’API n’est exposée qu’en HTTPS via Caddy ; le port 8080 n’écoute que sur la VM.
- Les uid sont validés avant de servir à construire des chemins de fichiers.
- Les erreurs 500 renvoient un message générique ; le détail reste dans les logs.
- Routes `/api/debug/*` désactivées sauf `ENABLE_DEBUG_ROUTES=true` ; Swagger coupé en production.
- IA réservée aux emails vérifiés, avec quotas par compte (`429` au-delà).
- Avatars vérifiés sur leur contenu réel, recherches échappées, limites de requêtes, en-têtes de sécurité dans Caddy.
- Les `.env` et clés de comptes de service ne sont jamais commités.
