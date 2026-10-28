# MedFlow — Landing page

Site vitrine statique de MedFlow (HTML / CSS / JS vanilla), construit avec Vite.
Dossier indépendant du reste du dépôt : il n'est référencé ni par `docker-compose.yml` ni par la CI, pour éviter les conflits de merge.

## Structure

```
landing-page/
├── index.html          → page d'accueil
├── livre-blanc.html    → page du livre blanc
├── src/landing.css     → styles
├── src/landing.js      → preloader, animations, formulaires
└── public/images/      → logos, favicon, aperçu de l'app
```

## Lancement en local

```bash
cd landing-page
npm install
npm run dev
```

Ouvrir : `http://localhost:5174`

## Build de production

```bash
npm run build     # génère dist/
npm run preview   # sert dist/ en local
```

## Docker

```bash
cd landing-page
docker build -t medflow-landing .
docker run -p 8081:80 medflow-landing
```

Ouvrir : `http://localhost:8081`
