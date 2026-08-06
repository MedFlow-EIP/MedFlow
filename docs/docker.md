# Docker - MedFlow

## Objectif

Ce guide explique comment exécuter **MedFlow** en mode conteneurisé avec **Docker Compose**.

---

## Architecture Docker actuelle

Le projet expose deux services principaux :

| Service | Rôle | Port |
|---------|------|------|
| backend | API Flask, traitement IA, extraction PDF | `8080` |
| frontend | Application web React servie via Nginx | `5173` |

Le mobile n’est pas conteneurisé dans ce dépôt ; son environnement est géré via Expo.

---

## `docker-compose.yml`

Le fichier Docker Compose actuel contient :

- `backend` : build depuis `./backend`
- `frontend` : build depuis `./frontend`

Il monte également :

- `./backend/uploads:/app/uploads`
- `./backend/data:/app/data`

Et expose :

- backend `8080`
- frontend `5173`

---

## Lancement du projet

### 1. Construire les images

```bash
docker-compose build
```

### 2. Démarrer les conteneurs

```bash
docker-compose up
```

### 3. Démarrer en arrière-plan

```bash
docker-compose up -d
```

### 4. Arrêter les services

```bash
docker-compose down
```

---

## Vérifier les services

| Service | URL | Note |
|---------|-----|------|
| backend | `http://localhost:8080` | API Flask |
| frontend | `http://localhost:5173` | Application web |

---

## Credentials Google Cloud

Le backend utilise des variables d’environnement Google Cloud.

- Le fichier `backend/.env` doit contenir les clés Google Cloud.
- Le fichier `backend/credentials.json` doit être présent si vous utilisez le mode de key file.

**Ne pas versionner** `backend/credentials.json`.

---

## CI/CD Docker

Le pipeline GitHub Actions inclut une étape Docker sur `main` :

- construction des images
- démarrage des services
- vérification des logs

Le workflow utilise :

- `docker/setup-buildx-action@v3`
- `docker compose build`
- `docker compose up -d`

---

## Astuces

- Reconstruire après une modification :

```bash
docker-compose up --build
```

- Voir les logs :

```bash
docker-compose logs -f
```

- Redémarrer uniquement le backend :

```bash
docker-compose restart backend
```
