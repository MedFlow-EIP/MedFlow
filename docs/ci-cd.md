# CI/CD - Intégration et déploiement continus

## Pipeline GitHub Actions

Fichier : `.github/workflows/ci.yml`

### Objectif

Valider automatiquement le backend Python et le frontend web à chaque push ou pull request sur `main`.

---

## Étapes du workflow

1. `checkout` du dépôt
2. installation Python et dépendances backend
3. installation Node.js et dépendances frontend
4. build du frontend
5. build Docker sur branche `main`
6. test de démarrage des conteneurs Docker

---

## Contenu du workflow

```yaml
name: CI MedFlow

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.11"
      - name: Install Python dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"
      - name: Install Node dependencies and build
        run: |
          cd frontend
          npm install
          npm run build

  docker-build:
    runs-on: ubuntu-latest
    needs: build-and-test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Create credentials.json
        run: |
          echo '${{ secrets.GCP_CREDENTIALS_JSON }}' > backend/credentials.json
      - name: Create .env file for Docker
        run: |
          cat > backend/.env << EOF
          GOOGLE_APPLICATION_CREDENTIALS=/app/credentials.json
          EOF
      - name: Build Docker images
        run: |
          docker compose build
      - name: Test Docker startup
        run: |
          docker compose up -d
          sleep 15
          docker ps
          docker compose logs
          docker compose down
      - name: Upload Docker logs on failure
        if: failure()
        run: |
          docker compose logs
```

---

## Notes

- Le workflow utilise `docker compose` pour builder et vérifier les conteneurs.
- Les credentials Google Cloud sont fournis via `secrets.GCP_CREDENTIALS_JSON`.
