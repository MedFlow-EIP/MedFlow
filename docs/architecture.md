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
                                    └─ Firebase Admin (vérification des tokens, liste des comptes)
```

## Mobile (`mobile/`)

- Expo 51, React Navigation (onglets Accueil, IA Chat, Stats, Compte + écrans empilés).
- Firebase Auth côté client ; chaque appel API envoie le token via `utils/authHeaders.ts`.
- Thème clair / sombre par tokens (`theme/colors.ts`), marges calculées depuis les safe areas (`components/navigation/constants.ts`).
- Contenu des leçons des parcours dans `content/lessons.ts` ; étapes dans `components/steps/`.
- Cache local par utilisateur (AsyncStorage) : conversations IA, cours consultables hors ligne (`utils/offlineCache.ts`).

## Backend (`backend/`)

- `app.py` : fabrique Flask, configuration (`config.py`), CORS, Firebase Admin, Swagger (`/api/docs`).
- `middleware/auth.py` : `@require_auth` vérifie le token Firebase (production) et inscrit l’utilisateur à sa première requête (classement, recherche d’amis).
- `routes/` : comptes, cours et upload, parcours et leçons, révision SM-2, amis et classement, chat IA, santé.
- `database.py` : accès SQLite (requêtes paramétrées), migrations légères au démarrage.
- `services/ai/` : fournisseurs IA (Vertex AI par défaut, Ollama en option).
- `sync_firebase_users.py` : importe les comptes Firebase existants (lancé par `deploy.sh`).

## Flux principal : import d’un cours

1. Le mobile envoie le PDF (`POST /api/process`, 20 Mo max).
2. Le backend extrait le texte (pypdf) et demande en parallèle à l’IA un titre, un résumé, des flashcards et un quiz.
3. Le cours est enregistré pour l’utilisateur ; ses questions entrent dans la révision SM-2.
4. Le mobile affiche le contenu et le met en cache pour la consultation hors ligne.

## Sécurité

- Docker force `FLASK_ENV=production` : tokens Firebase vérifiés, pas d’en-tête `X-User-UID`, pas de débogueur.
- L’API n’est exposée qu’en HTTPS via Caddy ; le port 8080 n’écoute que sur la VM.
- Les uid sont validés avant de servir à construire des chemins de fichiers.
- Les erreurs 500 renvoient un message générique ; le détail reste dans les logs.
- Routes `/api/debug/*` désactivées sauf `ENABLE_DEBUG_ROUTES=true`.
- Les `.env` et clés de comptes de service ne sont jamais commités.
