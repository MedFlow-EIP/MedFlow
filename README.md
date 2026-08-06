# MedFlow — Application de révision médicale assistée par IA

## Sommaire

1. [Objectif du projet](#objectif-du-projet)
2. [Structure du dépôt](#structure-du-dépôt)
3. [Technologies utilisées](#technologies-utilisées)
4. [Fonctionnalités principales](#fonctionnalités-principales)
5. [Installation & lancement](#installation--lancement)
   - [Cloner le projet](#1-cloner-le-projet)
   - [Backend](#2-backend)
   - [Frontend web](#3-frontend-web)
   - [Mobile](#4-mobile)
6. [Configuration des variables d’environnement](#configuration-des-variables-denvironnement)
   - [Backend](#backend--env)
   - [Frontend web](#frontend--env)
   - [Mobile](#mobile--env)
7. [Architecture du projet](#architecture-du-projet)
8. [CI/CD](#cicd)

MedFlow est une plateforme de révision médicale qui combine une application mobile Expo, une application web React et un backend Flask.  
Le projet produit des parcours de révision basés sur l’IA, en exploitant les cours PDF pour générer des résumés, des flashcards et des quiz.

---

## Objectif du projet

Permettre aux étudiants en médecine de réviser plus efficacement en offrant :

- une expérience mobile fluide et centrée sur l’apprentissage,
- la génération automatique de contenu pédagogique à partir de cours PDF,
- des modes de révision dynamiques (flashcards, quiz, parcours interactifs),
- une architecture full-stack prête à être déployée.

---

## Structure du dépôt

- `backend/` — API Flask, extraction PDF, génération IA, routes et tests
- `frontend/` — application web React + Vite
- `mobile/` — application mobile Expo / React Native
- `docs/` — documentation technique et guides
- `uploads/` — fichiers PDF et données JSON générées

---

## Technologies utilisées

| Côté | Technologie |
|------|-------------|
| Backend | Flask, Python, Flask-CORS, PyPDF2, Google Cloud AI |
| Frontend web | React, Vite, Tailwind CSS, Radix UI |
| Mobile | Expo, React Native, NativeWind |
| Authentification | Firebase Auth |
| IA | Google Vertex AI (Gemini) / Ollama optionnel |
| CI/CD | GitHub Actions |

---

## Fonctionnalités principales

- Import de cours en **PDF**
- Extraction automatique du contenu texte
- Génération automatique de :
  - résumés HTML
  - flashcards
  - quiz QCM
- Parcours de révision mobile :
  - écran Course Detail
  - flashcards, quiz, parcours de leçons
  - écran AI Chat
  - écran Settings / Account
- Dashboard de progression
- Backend API full-stack avec routes pour compte, cours, sessions, paths, chat

---

## Installation & lancement

### 1. Cloner le projet

```bash
git clone git@github.com:EpitechPromo2027/G-EIP-600-PAR-6-1-eip-armod.elegbede.git
cd G-EIP-600-PAR-6-1-eip-armod.elegbede
```

---

### 2. Backend

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux / Mac
# source venv/bin/activate
pip install -r requirements.txt
python app.py
```

L’API sera accessible sur : `http://localhost:8080`

---

### 3. Frontend web

```bash
cd frontend
npm install
npm run dev
```

Ouvrir : `http://localhost:5173`

---

### 4. Mobile

```bash
cd mobile
npm install
npx expo start
```

Options :
- `npm run android`
- `npm run ios`
- `npm run web`

---

## Configuration des variables d’environnement

### Backend — `backend/.env`

```env
GCP_TYPE=
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
```

Ces variables servent à authentifier le backend auprès de Google Cloud et Vertex AI.

---

### Frontend web — `frontend/.env`

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

---

### Mobile — `mobile/.env`

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

Le mobile utilise Expo et Firebase, avec des variables publiques exposées via `EXPO_PUBLIC_*`.

---

## Architecture du projet

```
backend/   → API Flask, génération IA, PDF, routes et stockage local
frontend/  → application web React/Vite
mobile/    → application Expo / React Native
docs/      → documentation technique et guides
uploads/   → fichiers PDF et JSON générés
```

Voir [docs/architecture.md](docs/architecture.md) pour la vue technique détaillée.

---

## CI/CD

Le dépôt contient un pipeline GitHub Actions qui :
- installe et vérifie le backend Python,
- installe et construit le frontend web,
- construit une image Docker sur `main`.

Voir [docs/ci-cd.md](docs/ci-cd.md).
