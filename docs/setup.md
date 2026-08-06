# Guide d’installation - MedFlow

## Sommaire

1. [Prérequis](#prérequis)
2. [Installation du backend](#installation-du-backend)
3. [Installation du frontend web](#installation-du-frontend-web)
4. [Installation du mobile](#installation-du-mobile)
5. [Structure du projet](#structure-du-projet)
6. [Vérification du bon fonctionnement](#vérification-du-bon-fonctionnement)
7. [Astuce](#astuce)

## Prérequis

- **Node.js** ≥ 18
- **npm**
- **Python** ≥ 3.10
- **Expo CLI** ou `npx expo`
- Accès à une **clé API Google Cloud Vertex AI**
- Un **compte Firebase** pour l’authentification mobile

---

## Installation du backend

### 1. Ouvrir le dossier backend

```bash
cd backend
```

### 2. Créer un environnement virtuel

**Windows**

```bash
python -m venv venv
venv\Scripts\activate
```

**Linux / Mac**

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Installer les dépendances

```bash
pip install -r requirements.txt
```

### 4. Créer le fichier `.env`

Créez un fichier `backend/.env` avec les variables suivantes :

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

Ces variables sont utilisées par le backend pour se connecter à Google Cloud et Vertex AI.

### 5. Lancer le backend

```bash
python app.py
```

L’API est disponible sur : `http://localhost:8080`

---

## Installation du frontend web

### 1. Ouvrir le dossier frontend

```bash
cd frontend
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Créer le fichier `.env`

Créez un fichier `frontend/.env` avec ces variables :

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### 4. Lancer le frontend

```bash
npm run dev
```

Accédez à `http://localhost:5173`

---

## Installation du mobile

### 1. Ouvrir le dossier mobile

```bash
cd mobile
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Créer le fichier `.env`

Créez un fichier `mobile/.env` avec ces variables :

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

### 4. Lancer le mobile

```bash
npx expo start
```

Utilisez ensuite :
- `npm run android`
- `npm run ios`
- `npm run web`

---

## Structure du projet

```bash
MedFlow/
│
├── backend/               # API Flask, extraction PDF, IA, stockage local
├── frontend/              # Application web React / Vite
├── mobile/                # Application mobile Expo / React Native
├── docs/                  # Documentation technique
└── uploads/               # Fichiers PDF et JSON générés
```

---

## Vérification du bon fonctionnement

1. Démarrer le backend (`python app.py`)
2. Démarrer le frontend web (`npm run dev`)
3. Démarrer le mobile (`npx expo start`)
4. Aller sur `http://localhost:5173`
5. Uploader un PDF et vérifier la génération des flashcards, quiz et résumé

---

## Astuce

Si vous avez une erreur Google Cloud :
- vérifiez que `backend/.env` contient bien les variables GCP
- vérifiez la clé de service Google Cloud
- assurez-vous que le compte a les rôles **Vertex AI User** et **Storage Object Viewer**
