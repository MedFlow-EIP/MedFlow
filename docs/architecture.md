# Architecture technique de MedFlow

## Sommaire

1. [Vue d’ensemble](#vue-densemble)
2. [Description technique](#description-technique)
   - [Frontend web](#1-frontend-web)
   - [Mobile](#2-mobile)
   - [Backend](#3-backend)
   - [Intelligence artificielle](#4-intelligence-artificielle)
   - [Stockage local](#5-stockage-local)
3. [Flux de données](#flux-de-données)
4. [Schéma logique](#schéma-logique)
5. [Sécurité et confidentialité](#sécurité-et-confidentialité)

---

## Vue d’ensemble

```
Utilisateur
   │
   ├─ frontend web React/Vite
   │     • upload PDF
   │     • dashboard
   │     • lecture des cours
   │
   ├─ mobile Expo/React Native
   │     • parcours de révision
   │     • cours détaillés
   │     • settings / chat IA
   │
   └─ backend Flask
         • extraction PDF
         • génération IA
         • API REST
         • stockage local
```

---

## Description technique

### 1. Frontend web

- Application React / Vite pour l’interface utilisateur web.
- Permet d’uploader les cours et de consulter les résultats.
- Pages clés : `App.jsx`, `Navbar.jsx`, `Dashboard.jsx`, `CoursePath.jsx`, `ExamenBlanc.jsx`.
- Communication backend via appels HTTP.

---

### 2. Mobile

- Application Expo / React Native.
- Écrans principaux : Home, Dashboard, CourseDetail, UploadCourse, Account, Settings, AIChat.
- Utilise Firebase Auth pour l’authentification.
- Utilise `expo`, `react-native-render-html`, `react-native-voice`, `nativewind`.

---

### 3. Backend

- API Flask exposant des routes :
  - `/api/account`
  - `/api/courses`
  - `/api/health`
  - `/api/paths`
  - `/api/sessions`
  - `/api/chat`
- Organisation : `app.py`, `config.py`, `database.py`, `middleware/auth.py`, `routes/`, `services/ai/`.
- Stockage local des données dans `backend/uploads` et `backend/data`.
- Swagger / OpenAPI disponible à `/api/docs`.

---

### 4. Intelligence artificielle

- Intègre Google Vertex AI (Gemini 2.5 Pro) par défaut.
- Support alternatif : `ollama` local.
- Génère :
  - résumés structurés,
  - flashcards,
  - quiz.
- Le backend appelle l’IA via le provider configuré dans `services/ai`.

---

### 5. Stockage local

- `backend/uploads/` contient les PDFs uploadés et les fichiers JSON générés.
- `backend/data/` stocke les données structurées nécessaires à l’API.
- Le backend crée automatiquement les dossiers à l’exécution.

---

## Flux de données

1. L’utilisateur upload un PDF depuis web ou mobile.
2. Le frontend envoie le fichier au backend Flask.
3. Flask extrait le texte et appelle l’IA.
4. Gemini / Ollama génère flashcards, quiz et résumé.
5. Le backend sauvegarde le résultat en JSON.
6. Le frontend / mobile consomme les données et les affiche.

---

## Schéma logique

```
Frontend Web / Mobile
      │
      ├─ POST /api/courses      (upload PDF)
      ├─ GET /api/courses       (liste des cours)
      ├─ GET /api/course/<id>   (détail du cours)
      ├─ POST /api/sessions     (démarrer une session)
      └─ GET /api/account       (profil et stats)
             │
             ▼
         Backend Flask
             │
             ├─ Extraction PDF (PyPDF2)
             ├─ IA (Vertex AI / Ollama)
             ├─ Génération JSON
             └─ Stockage local
```

---

## Sécurité et confidentialité

- Les données utilisateurs sont traitées localement par le backend.
- Les fichiers de configuration Firebase et Google Cloud sont stockés hors dépôt.
- En production, la vérification Firebase est activée via `FIREBASE_VERIFY=true`.
- Les tokens Firebase sont transmis en Bearer Authorization ou via `X-User-UID` en mode dev.
